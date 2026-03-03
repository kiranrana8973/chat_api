# Chat API

A NestJS (TypeScript) backend for a Flutter chat application supporting real-time 1-to-1 messaging, image sharing, read receipts, typing indicators, user presence, and push notifications.

## Tech Stack

| Layer              | Technology                          |
| ------------------ | ----------------------------------- |
| Framework          | NestJS 11 (TypeScript)              |
| Runtime            | Node.js (v18+)                      |
| Real-time          | Socket.IO 4 (`@nestjs/websockets`)  |
| Database           | MongoDB + Mongoose 9                |
| Auth               | JWT (Passport) + bcryptjs + Google/Apple OAuth |
| Validation         | class-validator + class-transformer |
| File Uploads       | Multer (local disk)                 |
| Push Notifications | Firebase Admin SDK (FCM) — optional |

---

## Architecture Overview

```
┌──────────────────┐         ┌──────────────────────────────────────────────┐
│   Flutter App    │         │            NestJS Server                     │
│                  │         │                                              │
│  ┌────────────┐  │  HTTP   │  ┌──────────────┐    ┌───────────────────┐  │
│  │  REST API  │──┼────────►│  │  Controllers  │───►│     Services      │  │
│  │  (http pkg)│  │         │  │  (auth, users │    │  (business logic) │  │
│  └────────────┘  │         │  │  conversations│    └─────────┬─────────┘  │
│                  │         │  │  messages)    │              │            │
│  ┌────────────┐  │  WS     │  └──────────────┘              │            │
│  │ Socket.IO  │──┼────────►│  ┌──────────────┐              │            │
│  │  (client)  │  │         │  │ ChatGateway   │              │            │
│  └────────────┘  │         │  │ (WebSocket)   │              │            │
│                  │         │  └──────┬───────┘              │            │
│  ┌────────────┐  │  Push   │         │       ┌──────────────▼─────────┐  │
│  │  Firebase  │◄─┼─────────┼─────────┼──────►│       MongoDB          │  │
│  │ Messaging  │  │         │         │       │  Users, Conversations, │  │
│  └────────────┘  │         │         │       │  Messages              │  │
└──────────────────┘         │         │       └────────────────────────┘  │
                             │  ┌──────▼───────┐   ┌──────────────────┐   │
                             │  │  FCM Push     │   │  Static Files    │   │
                             │  │  Notifications│   │  /uploads/*.jpg  │   │
                             │  └──────────────┘   └──────────────────┘   │
                             └──────────────────────────────────────────────┘
```

The server provides **two communication channels**:

1. **REST API** (`/api` prefix) — CRUD operations: register/login, list users, manage conversations, send messages (especially images), update profile.
2. **Socket.IO** — Real-time features: instant message delivery, typing indicators, read receipts, and online/offline presence.

Both channels share the same MongoDB database and JWT authentication.

---

## How Chatting Works — End to End

### 1. User Registers / Logs In

The user can sign up in three ways:

- **Email + Password** — `POST /api/auth/register` with `fname, lname, email, password, gender, batch`
- **Google Sign-In** — Flutter handles Google Sign-In UI, sends the ID token to `POST /api/auth/google`
- **Apple Sign-In** — Flutter handles Apple Sign-In UI, sends the identity token to `POST /api/auth/apple`

All three return a **JWT token** (valid for 7 days) and the user object. OAuth users get `isProfileComplete: false` — the Flutter app should check this and show a profile completion screen to collect `gender` and `batch` via `POST /api/auth/complete-profile`.

### 2. Socket.IO Connection

After login, the app connects to Socket.IO with the JWT token:

```dart
final socket = IO.io('http://SERVER_IP:3000', {
  'transports': ['websocket'],
  'auth': {'token': jwtToken},
});
socket.connect();
```

The server verifies the JWT, joins the user into a **personal room** (named by their userId), and broadcasts `user-online` to everyone. This room system is how the server delivers messages to specific users.

### 3. Starting a Conversation

When User A wants to chat with User B, the app calls `POST /api/conversations` with User B's ID. The server either returns an existing conversation or creates a new one. Conversations are strictly 1-to-1 (two participants).

### 4. Sending a Text Message (via Socket.IO)

```
User A (Flutter)                Server                     User B (Flutter)
      │                           │                              │
      │── emit 'send-message' ──►│                              │
      │   {conversationId,        │                              │
      │    text, type:'text'}     │                              │
      │                           │── Save to MongoDB           │
      │                           │── Update conversation       │
      │                           │   lastMessage               │
      │                           │                              │
      │◄── emit 'new-message' ── │── emit 'new-message' ──────►│
      │   (confirmation)          │                              │
      │                           │── FCM push notification ───►│
      │                           │   (if B has fcmToken)        │
```

The server saves the message to MongoDB, updates the conversation's `lastMessage` reference, then emits the message to both sender (confirmation) and receiver (via their personal Socket.IO room). If the receiver has an FCM token, a push notification is also sent.

### 5. Sending an Image (via REST API)

Images must go through REST because Socket.IO doesn't handle file uploads. The app sends a `multipart/form-data` POST to `/api/messages` with the image file. The server saves the file to `uploads/`, creates the message, and delivers it via Socket.IO to the receiver — same as text messages.

```
User A (Flutter)                Server                     User B (Flutter)
      │                           │                              │
      │── POST /api/messages ───►│                              │
      │   (multipart form-data)   │── Save file to uploads/     │
      │                           │── Save message to MongoDB   │
      │                           │── Update conversation       │
      │◄── 201 JSON response ─── │                              │
      │                           │── emit 'new-message' ──────►│
      │                           │── FCM push ────────────────►│
```

### 6. Read Receipts

When User B opens a conversation and reads messages, the app emits `mark-read`. The server adds User B to the `readBy` array of all unread messages in that conversation, then emits `messages-read` to User A so their UI can show read indicators (e.g., blue double checkmarks).

### 7. Typing Indicators

When a user starts typing, the app emits `typing` with the receiver's ID. The server forwards this to the receiver's room. When they stop, the app emits `stop-typing`. These are real-time only — nothing is saved to the database.

### 8. Presence (Online/Offline)

Online status is managed by Socket.IO connection lifecycle:
- **Connect** → `isOnline: true`, broadcast `user-online`
- **Disconnect** → `isOnline: false`, set `lastSeen`, broadcast `user-offline`

No heartbeat or polling needed — Socket.IO handles connection tracking automatically.

---

## Data Models

### User

| Field              | Type    | Description                                             |
| ------------------ | ------- | ------------------------------------------------------- |
| `fname`            | String  | First name (required)                                   |
| `lname`            | String  | Last name (required)                                    |
| `email`            | String  | Unique, lowercase (required)                            |
| `password`         | String  | bcrypt hashed, only for local auth (optional for OAuth) |
| `authProvider`     | Enum    | `'local'`, `'google'`, or `'apple'`                     |
| `oauthId`          | String  | OAuth provider user ID (stripped from JSON output)       |
| `gender`           | Enum    | `'male'`, `'female'`, or `'other'`                      |
| `batch`            | String  | Group/section name (e.g., "Batch A")                    |
| `isProfileComplete`| Boolean | `false` until OAuth users provide gender + batch        |
| `avatar`           | String  | Profile image URL                                       |
| `fcmToken`         | String  | Firebase device token for push notifications            |
| `isOnline`         | Boolean | Current online status                                   |
| `lastSeen`         | Date    | Last disconnect timestamp                               |

> `password` and `oauthId` are automatically stripped from JSON responses via `toJSON()`.

**Indexes:** Compound unique index on `{authProvider, oauthId}` (partial, where oauthId is not null).

### Conversation

| Field          | Type      | Description                                      |
| -------------- | --------- | ------------------------------------------------ |
| `participants` | [User]    | Exactly 2 user references                        |
| `lastMessage`  | Message   | Reference to the most recent message             |
| `createdAt`    | Date      | Auto-generated timestamp                         |
| `updatedAt`    | Date      | Auto-generated timestamp                         |

**Indexes:** `{participants: 1}` for fast lookups.

### Message

| Field          | Type         | Description                                           |
| -------------- | ------------ | ----------------------------------------------------- |
| `conversation` | Conversation | Which conversation this belongs to                    |
| `sender`       | User         | Who sent the message                                  |
| `type`         | Enum         | `'text'` or `'image'`                                 |
| `text`         | String       | Message text or image caption                         |
| `image`        | String       | File path (e.g., `uploads/1704067200000-123456789.jpg`) |
| `readBy`       | [User]       | Array of user IDs who have read this message          |
| `createdAt`    | Date         | Auto-generated timestamp                              |
| `updatedAt`    | Date         | Auto-generated timestamp                              |

**Indexes:** `{conversation: 1, createdAt: -1}` for fast chronological retrieval.

---

## Setup

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [MongoDB](https://www.mongodb.com/try/download/community) running locally, or a [MongoDB Atlas](https://www.mongodb.com/atlas) connection string

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/chat_api
JWT_SECRET=your-super-secret-key-change-this-in-production
GOOGLE_CLIENT_ID=your-google-client-id
APPLE_CLIENT_ID=your-apple-bundle-id
```

| Variable          | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `PORT`            | Server port (default: 3000)                                |
| `MONGODB_URI`     | MongoDB connection string                                  |
| `JWT_SECRET`      | A long, random secret for signing JWT tokens. **Change this!** |
| `GOOGLE_CLIENT_ID`| Google OAuth client ID (from Google Cloud Console)         |
| `APPLE_CLIENT_ID` | Apple Services ID or Bundle ID                             |

### 4. Firebase Setup (Optional — for push notifications)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create one)
3. Go to **Project Settings > Service Accounts**
4. Click **Generate New Private Key**
5. Save the downloaded JSON file as `serviceAccountKey.json` in the project root

> The server works without this file — push notifications will simply be disabled with a console message.

### 5. Run the Server

```bash
# Development (auto-restarts on file changes)
npm run dev

# Build TypeScript
npm run build

# Production
npm start
```

You should see:

```
Server running on port 3000
```

---

## API Reference

### Base URL

```
http://localhost:3000/api
```

### Health Check

```
GET http://localhost:3000/
```

**Response (200):**

```json
{
  "message": "Chat API is running."
}
```

> This endpoint is outside the `/api` prefix.

### Authentication Header

All authenticated endpoints require:

```
Authorization: Bearer <your-jwt-token>
```

### Error Format

All errors follow a consistent format:

```json
{
  "error": "Description of what went wrong."
}
```

| Status | Meaning                                                       |
| ------ | ------------------------------------------------------------- |
| 400    | Bad request — missing or invalid fields (validation errors)   |
| 401    | Unauthorized — missing, invalid, or expired JWT token         |
| 404    | Not found — conversation or resource doesn't exist            |
| 409    | Conflict — email already registered with a different provider |
| 500    | Internal server error                                         |

---

### Auth Endpoints

#### `POST /api/auth/register`

Register a new user with email and password.

**Request Body:**

```json
{
  "fname": "Kiran",
  "lname": "Kumar",
  "email": "kiran@example.com",
  "password": "password123",
  "gender": "male",
  "batch": "Batch A"
}
```

| Field      | Type   | Required | Validation                         |
| ---------- | ------ | -------- | ---------------------------------- |
| `fname`    | string | Yes      | Non-empty string                   |
| `lname`    | string | Yes      | Non-empty string                   |
| `email`    | string | Yes      | Valid email format                 |
| `password` | string | Yes      | Non-empty string                   |
| `gender`   | string | Yes      | One of: `male`, `female`, `other`  |
| `batch`    | string | Yes      | Non-empty string                   |

**Response `201 Created`:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "fname": "Kiran",
    "lname": "Kumar",
    "email": "kiran@example.com",
    "authProvider": "local",
    "gender": "male",
    "batch": "Batch A",
    "isProfileComplete": true,
    "avatar": "",
    "fcmToken": "",
    "isOnline": false,
    "lastSeen": "2025-01-01T00:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "__v": 0
  }
}
```

**Error Responses:**

| Status | Condition             | Response                               |
| ------ | --------------------- | -------------------------------------- |
| 400    | Email already in use  | `{ "error": "Email already in use." }` |
| 400    | Validation failure    | `{ "error": "email must be an email" }`|

---

#### `POST /api/auth/login`

Login with email and password.

**Request Body:**

```json
{
  "email": "kiran@example.com",
  "password": "password123"
}
```

| Field      | Type   | Required | Validation         |
| ---------- | ------ | -------- | ------------------ |
| `email`    | string | Yes      | Valid email format |
| `password` | string | Yes      | Non-empty string   |

**Response `200 OK`:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "fname": "Kiran",
    "lname": "Kumar",
    "email": "kiran@example.com",
    "authProvider": "local",
    "gender": "male",
    "batch": "Batch A",
    "isProfileComplete": true,
    "avatar": "",
    "fcmToken": "",
    "isOnline": false,
    "lastSeen": "2025-01-01T00:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "__v": 0
  }
}
```

**Error Responses:**

| Status | Condition                            | Response                                                                |
| ------ | ------------------------------------ | ----------------------------------------------------------------------- |
| 401    | Wrong email or password              | `{ "error": "Invalid email or password." }`                             |
| 401    | Account uses OAuth (not local)       | `{ "error": "This account uses google sign-in. Please use google to log in." }` |

---

#### `POST /api/auth/google`

Authenticate with a Google ID token. Creates a new account or logs into an existing one.

**Request Body:**

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

| Field     | Type   | Required | Description                                 |
| --------- | ------ | -------- | ------------------------------------------- |
| `idToken` | string | Yes      | Google ID token from `google_sign_in` Flutter package |

**Response `201 Created` (new user) or `200 OK` (existing user):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "fname": "Kiran",
    "lname": "Kumar",
    "email": "kiran@gmail.com",
    "authProvider": "google",
    "isProfileComplete": false,
    "avatar": "https://lh3.googleusercontent.com/...",
    "isOnline": false,
    "lastSeen": "2025-01-01T00:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "__v": 0
  },
  "isNewUser": true
}
```

> When `isNewUser: true` or `isProfileComplete: false`, show a profile completion screen.

**Error Responses:**

| Status | Condition                              | Response                                                                            |
| ------ | -------------------------------------- | ----------------------------------------------------------------------------------- |
| 401    | Invalid or expired Google token        | `{ "error": "Invalid or expired Google token." }`                                   |
| 409    | Email registered with another provider | `{ "error": "This email is already registered with apple sign-in." }`               |

**Account Linking:** If a local (email+password) user signs in via Google with the same email, the account is automatically linked — `authProvider` switches to `google`.

---

#### `POST /api/auth/apple`

Authenticate with an Apple identity token. Creates a new account or logs into an existing one.

**Request Body:**

```json
{
  "identityToken": "eyJraWQiOiI4NkQ4...",
  "fname": "Kiran",
  "lname": "Kumar"
}
```

| Field           | Type   | Required | Description                                      |
| --------------- | ------ | -------- | ------------------------------------------------ |
| `identityToken` | string | Yes      | Apple identity token from `sign_in_with_apple`   |
| `fname`         | string | No       | First name (Apple only provides this on first auth) |
| `lname`         | string | No       | Last name (Apple only provides this on first auth)  |

**Response:** Same format as Google auth (includes `token`, `user`, `isNewUser`).

**Error Responses:**

| Status | Condition                              | Response                                                                  |
| ------ | -------------------------------------- | ------------------------------------------------------------------------- |
| 401    | Invalid or expired Apple token         | `{ "error": "Invalid or expired Apple token." }`                          |
| 409    | Email registered with another provider | `{ "error": "This email is already registered with google sign-in." }`    |

---

#### `POST /api/auth/complete-profile`

Complete profile for OAuth users who need to provide `gender` and `batch`. **Requires authentication.**

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "gender": "male",
  "batch": "Batch A",
  "fname": "Kiran",
  "lname": "Kumar"
}
```

| Field   | Type   | Required | Validation                        |
| ------- | ------ | -------- | --------------------------------- |
| `gender`| string | Yes      | One of: `male`, `female`, `other` |
| `batch` | string | Yes      | Non-empty string                  |
| `fname` | string | No       | Optional name update              |
| `lname` | string | No       | Optional name update              |

**Response `200 OK`:**

```json
{
  "user": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "fname": "Kiran",
    "lname": "Kumar",
    "email": "kiran@gmail.com",
    "authProvider": "google",
    "gender": "male",
    "batch": "Batch A",
    "isProfileComplete": true,
    "avatar": "https://lh3.googleusercontent.com/...",
    "isOnline": false,
    "lastSeen": "2025-01-01T00:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "__v": 0
  }
}
```

---

### Users Endpoints

> All user endpoints require authentication: `Authorization: Bearer <token>`

#### `GET /api/users`

List all users except the currently authenticated user. Used for the "start new chat" screen.

**Query Parameters:**

| Param    | Type   | Required | Description                                        |
| -------- | ------ | -------- | -------------------------------------------------- |
| `search` | string | No       | Filter by first name, last name, or email (regex, case-insensitive) |

**Example:** `GET /api/users?search=kiran`

**Response `200 OK`:**

```json
[
  {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
    "fname": "Amit",
    "lname": "Sharma",
    "email": "amit@example.com",
    "authProvider": "local",
    "gender": "male",
    "batch": "Batch A",
    "isProfileComplete": true,
    "avatar": "",
    "fcmToken": "",
    "isOnline": true,
    "lastSeen": "2025-01-01T12:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T12:00:00.000Z",
    "__v": 0
  }
]
```

> Results are sorted alphabetically by first name, then last name. Password field is excluded.

---

#### `GET /api/users/me`

Get the authenticated user's profile.

**Response `200 OK`:**

```json
{
  "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
  "fname": "Kiran",
  "lname": "Kumar",
  "email": "kiran@example.com",
  "authProvider": "local",
  "gender": "male",
  "batch": "Batch A",
  "isProfileComplete": true,
  "avatar": "",
  "fcmToken": "",
  "isOnline": true,
  "lastSeen": "2025-01-01T00:00:00.000Z",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z",
  "__v": 0
}
```

---

#### `PUT /api/users/me`

Update the authenticated user's profile. Only whitelisted fields can be updated.

**Request Body (all fields optional):**

```json
{
  "fname": "New First Name",
  "lname": "New Last Name",
  "avatar": "https://example.com/avatar.jpg",
  "fcmToken": "firebase-device-token-here",
  "gender": "male",
  "batch": "Batch B"
}
```

| Field      | Type   | Description                              |
| ---------- | ------ | ---------------------------------------- |
| `fname`    | string | First name                               |
| `lname`    | string | Last name                                |
| `avatar`   | string | Profile image URL                        |
| `fcmToken` | string | Firebase Cloud Messaging device token    |
| `gender`   | string | `male`, `female`, or `other`             |
| `batch`    | string | Group/section name                       |

> **Important:** After login, call this endpoint with the FCM device token to enable push notifications:
> ```json
> { "fcmToken": "your-firebase-device-token" }
> ```

**Response `200 OK`:** Returns the updated user object (same format as `GET /api/users/me`).

---

### Conversations Endpoints

> All conversation endpoints require authentication: `Authorization: Bearer <token>`

#### `POST /api/conversations`

Create a new conversation or get an existing one between the authenticated user and another user.

**Request Body:**

```json
{
  "participantId": "64f1a2b3c4d5e6f7a8b9c0d2"
}
```

| Field           | Type   | Required | Description                |
| --------------- | ------ | -------- | -------------------------- |
| `participantId` | string | Yes      | The other user's `_id`     |

**Response `201 Created` (new) or `200 OK` (existing):**

```json
{
  "_id": "64f1a2b3c4d5e6f7a8b9c0d3",
  "participants": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "fname": "Kiran",
      "lname": "Kumar",
      "email": "kiran@example.com",
      "authProvider": "local",
      "gender": "male",
      "batch": "Batch A",
      "isProfileComplete": true,
      "avatar": "",
      "fcmToken": "",
      "isOnline": true,
      "lastSeen": "2025-01-01T00:00:00.000Z"
    },
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
      "fname": "Amit",
      "lname": "Sharma",
      "email": "amit@example.com",
      "authProvider": "local",
      "gender": "male",
      "batch": "Batch A",
      "isProfileComplete": true,
      "avatar": "",
      "fcmToken": "",
      "isOnline": false,
      "lastSeen": "2025-01-01T12:00:00.000Z"
    }
  ],
  "lastMessage": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z",
  "__v": 0
}
```

**Error Responses:**

| Status | Condition                          | Response                                                    |
| ------ | ---------------------------------- | ----------------------------------------------------------- |
| 400    | Missing participantId              | `{ "error": "participantId is required." }`                 |
| 400    | Same user as participant           | `{ "error": "Cannot create conversation with yourself." }`  |

---

#### `GET /api/conversations`

List all conversations for the authenticated user, sorted by most recently updated.

**Response `200 OK`:**

```json
[
  {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d3",
    "participants": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "fname": "Kiran",
        "lname": "Kumar",
        "email": "kiran@example.com",
        "authProvider": "local",
        "isProfileComplete": true,
        "avatar": "",
        "isOnline": true,
        "lastSeen": "2025-01-01T00:00:00.000Z"
      },
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
        "fname": "Amit",
        "lname": "Sharma",
        "email": "amit@example.com",
        "authProvider": "local",
        "isProfileComplete": true,
        "avatar": "",
        "isOnline": false,
        "lastSeen": "2025-01-01T12:00:00.000Z"
      }
    ],
    "lastMessage": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d4",
      "conversation": "64f1a2b3c4d5e6f7a8b9c0d3",
      "sender": "64f1a2b3c4d5e6f7a8b9c0d1",
      "type": "text",
      "text": "Hello!",
      "image": "",
      "readBy": ["64f1a2b3c4d5e6f7a8b9c0d1"],
      "createdAt": "2025-01-01T12:30:00.000Z",
      "updatedAt": "2025-01-01T12:30:00.000Z"
    },
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T12:30:00.000Z",
    "__v": 0
  }
]
```

> `participants` are populated with user objects (password excluded). `lastMessage` is populated for conversation list previews.

---

### Messages Endpoints

> All message endpoints require authentication: `Authorization: Bearer <token>`

#### `GET /api/messages/:conversationId`

Get paginated messages for a conversation. Only participants can access messages.

**Path Parameters:**

| Param            | Description          |
| ---------------- | -------------------- |
| `conversationId` | The conversation ID  |

**Query Parameters:**

| Param   | Type   | Default | Description       |
| ------- | ------ | ------- | ----------------- |
| `page`  | number | 1       | Page number       |
| `limit` | number | 30      | Messages per page |

**Example:** `GET /api/messages/64f1a2b3c4d5e6f7a8b9c0d3?page=1&limit=20`

**Response `200 OK`:**

```json
{
  "messages": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d5",
      "conversation": "64f1a2b3c4d5e6f7a8b9c0d3",
      "sender": {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "fname": "Kiran",
        "lname": "Kumar",
        "email": "kiran@example.com",
        "authProvider": "local",
        "gender": "male",
        "batch": "Batch A",
        "isProfileComplete": true,
        "avatar": "",
        "fcmToken": "",
        "isOnline": true,
        "lastSeen": "2025-01-01T00:00:00.000Z"
      },
      "type": "text",
      "text": "Hello!",
      "image": "",
      "readBy": ["64f1a2b3c4d5e6f7a8b9c0d1"],
      "createdAt": "2025-01-01T12:30:00.000Z",
      "updatedAt": "2025-01-01T12:30:00.000Z",
      "__v": 0
    },
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d6",
      "conversation": "64f1a2b3c4d5e6f7a8b9c0d3",
      "sender": {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
        "fname": "Amit",
        "lname": "Sharma",
        "email": "amit@example.com"
      },
      "type": "image",
      "text": "Check this out",
      "image": "uploads/1704067200000-123456789.jpg",
      "readBy": ["64f1a2b3c4d5e6f7a8b9c0d2", "64f1a2b3c4d5e6f7a8b9c0d1"],
      "createdAt": "2025-01-01T12:35:00.000Z",
      "updatedAt": "2025-01-01T12:36:00.000Z",
      "__v": 0
    }
  ],
  "page": 1,
  "totalPages": 3,
  "total": 85
}
```

> Messages are sorted by `createdAt` descending (newest first). `sender` is populated with the user object (password excluded).

**Error Responses:**

| Status | Condition                   | Response                                     |
| ------ | --------------------------- | -------------------------------------------- |
| 404    | Conversation not found or user is not a participant | `{ "error": "Conversation not found." }` |

---

#### `POST /api/messages`

Send a message (text or image). Supports both JSON and multipart form-data. After saving, the server emits the message via Socket.IO to the receiver and sends an FCM push notification.

##### Sending a Text Message

**Content-Type:** `application/json`

**Request Body:**

```json
{
  "conversationId": "64f1a2b3c4d5e6f7a8b9c0d3",
  "type": "text",
  "text": "Hello!"
}
```

##### Sending an Image Message

**Content-Type:** `multipart/form-data`

| Field            | Type   | Required | Description                                         |
| ---------------- | ------ | -------- | --------------------------------------------------- |
| `conversationId` | string | Yes      | Conversation ID                                     |
| `type`           | string | No       | Set to `"image"` (auto-detected if file is attached)|
| `text`           | string | No       | Optional caption                                    |
| `image`          | file   | Yes      | Image file (jpeg, jpg, png, gif, webp — max 5MB)    |

**Response `201 Created`:**

```json
{
  "_id": "64f1a2b3c4d5e6f7a8b9c0d7",
  "conversation": "64f1a2b3c4d5e6f7a8b9c0d3",
  "sender": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "fname": "Kiran",
    "lname": "Kumar",
    "email": "kiran@example.com",
    "authProvider": "local",
    "gender": "male",
    "batch": "Batch A",
    "isProfileComplete": true,
    "avatar": ""
  },
  "type": "image",
  "text": "Check this out",
  "image": "uploads/1704067200000-123456789.jpg",
  "readBy": ["64f1a2b3c4d5e6f7a8b9c0d1"],
  "createdAt": "2025-01-01T12:35:00.000Z",
  "updatedAt": "2025-01-01T12:35:00.000Z",
  "__v": 0
}
```

**Accessing uploaded images:**

```
GET http://localhost:3000/uploads/1704067200000-123456789.jpg
```

> Static files are served at `/uploads/` (no `/api` prefix).

**Error Responses:**

| Status | Condition                  | Response                                         |
| ------ | -------------------------- | ------------------------------------------------ |
| 400    | Missing conversationId     | `{ "error": "conversationId is required." }`     |
| 400    | Invalid image format       | `{ "error": "Only image files (jpeg, jpg, png, gif, webp) are allowed." }` |
| 404    | Conversation not found     | `{ "error": "Conversation not found." }`         |

**Side Effects:**
- Emits `new-message` Socket.IO event to the receiver
- Sends FCM push notification to the receiver (if they have an `fcmToken`)
- Updates the conversation's `lastMessage` field

---

## Socket.IO — Real-Time Events

### Connection

Connect to the Socket.IO server with JWT authentication:

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

final socket = IO.io('http://YOUR_SERVER_IP:3000', <String, dynamic>{
  'transports': ['websocket'],
  'autoConnect': false,
  'auth': {'token': 'your-jwt-token-here'},
});

socket.connect();
```

On connection, the server:
1. Verifies the JWT token
2. Joins the user to a personal room (named by their `userId`)
3. Sets `isOnline: true` in the database
4. Broadcasts `user-online` to all connected clients

On disconnection, the server:
1. Sets `isOnline: false` and `lastSeen` to current time
2. Broadcasts `user-offline` to all connected clients

> Invalid or missing tokens cause immediate disconnection.

---

### Client → Server Events (Emit)

#### `send-message`

Send a text message through Socket.IO (preferred for text — lower latency than REST).

**Payload:**

```json
{
  "conversationId": "64f1a2b3c4d5e6f7a8b9c0d3",
  "text": "Hello!",
  "type": "text"
}
```

| Field            | Type   | Required | Description                     |
| ---------------- | ------ | -------- | ------------------------------- |
| `conversationId` | string | Yes      | Conversation ID                 |
| `text`           | string | No       | Message text (default: `""`)    |
| `type`           | string | No       | `"text"` (default) or `"image"` |

**Server Actions:**
1. Verifies sender is a participant of the conversation
2. Saves message to MongoDB
3. Updates conversation `lastMessage`
4. Emits `new-message` to the receiver's room
5. Emits `new-message` back to the sender (confirmation)
6. Sends FCM push notification to receiver (if available)

---

#### `typing`

Notify the receiver that you are typing.

**Payload:**

```json
{
  "conversationId": "64f1a2b3c4d5e6f7a8b9c0d3",
  "receiverId": "64f1a2b3c4d5e6f7a8b9c0d2"
}
```

---

#### `stop-typing`

Notify the receiver that you stopped typing.

**Payload:**

```json
{
  "conversationId": "64f1a2b3c4d5e6f7a8b9c0d3",
  "receiverId": "64f1a2b3c4d5e6f7a8b9c0d2"
}
```

---

#### `mark-read`

Mark all messages in a conversation as read by the current user.

**Payload:**

```json
{
  "conversationId": "64f1a2b3c4d5e6f7a8b9c0d3"
}
```

**Server Actions:**
1. Adds the user's ID to the `readBy` array of all unread messages in the conversation
2. Emits `messages-read` to the other participant

---

### Server → Client Events (Listen)

#### `new-message`

Received when a message is sent to a conversation you're part of (or as confirmation for your own sent message).

**Payload:** Full message object with `sender` populated:

```json
{
  "_id": "64f1a2b3c4d5e6f7a8b9c0d7",
  "conversation": "64f1a2b3c4d5e6f7a8b9c0d3",
  "sender": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "fname": "Kiran",
    "lname": "Kumar",
    "email": "kiran@example.com"
  },
  "type": "text",
  "text": "Hello!",
  "image": "",
  "readBy": ["64f1a2b3c4d5e6f7a8b9c0d1"],
  "createdAt": "2025-01-01T12:30:00.000Z",
  "updatedAt": "2025-01-01T12:30:00.000Z"
}
```

---

#### `user-online`

Broadcast when a user connects to Socket.IO.

**Payload:**

```json
{
  "userId": "64f1a2b3c4d5e6f7a8b9c0d2"
}
```

---

#### `user-offline`

Broadcast when a user disconnects from Socket.IO.

**Payload:**

```json
{
  "userId": "64f1a2b3c4d5e6f7a8b9c0d2",
  "lastSeen": "2025-01-01T12:45:00.000Z"
}
```

---

#### `typing`

Received when another user is typing in a shared conversation.

**Payload:**

```json
{
  "conversationId": "64f1a2b3c4d5e6f7a8b9c0d3",
  "senderId": "64f1a2b3c4d5e6f7a8b9c0d2"
}
```

---

#### `stop-typing`

Received when another user stopped typing.

**Payload:**

```json
{
  "conversationId": "64f1a2b3c4d5e6f7a8b9c0d3",
  "senderId": "64f1a2b3c4d5e6f7a8b9c0d2"
}
```

---

#### `messages-read`

Received when the other participant has read your messages.

**Payload:**

```json
{
  "conversationId": "64f1a2b3c4d5e6f7a8b9c0d3",
  "readByUserId": "64f1a2b3c4d5e6f7a8b9c0d2"
}
```

---

## Push Notifications (FCM)

When a message is sent (via either REST or Socket.IO), the server sends a Firebase Cloud Messaging push notification to the receiver if they have an `fcmToken` stored.

**Notification format:**

```json
{
  "token": "<receiver's fcmToken>",
  "notification": {
    "title": "Kiran Kumar",
    "body": "Hello!"
  },
  "data": {
    "conversationId": "64f1a2b3c4d5e6f7a8b9c0d3",
    "senderId": "64f1a2b3c4d5e6f7a8b9c0d1",
    "messageType": "text"
  }
}
```

- For image messages, the body is `"Sent you an image"`
- The `data` payload can be used in Flutter to navigate to the correct conversation on tap

> Firebase is optional. If `serviceAccountKey.json` is not present, the server starts normally with push notifications disabled.

---

## Flutter Integration — Quick Start

### Required Flutter Packages

```yaml
dependencies:
  http: ^1.2.0
  socket_io_client: ^3.0.2
  firebase_core: ^3.8.1
  firebase_messaging: ^15.1.6
  flutter_secure_storage: ^9.2.4
  image_picker: ^1.1.2
  google_sign_in: ^6.2.2
  sign_in_with_apple: ^6.1.4
```

### Typical Flutter Flow

1. **Register/Login** → `POST /api/auth/register`, `/login`, `/google`, or `/apple` → store JWT token securely
2. **Complete profile** (OAuth only) → if `isProfileComplete: false`, call `POST /api/auth/complete-profile` with `gender` and `batch`
3. **Save FCM token** → `FirebaseMessaging.instance.getToken()` → `PUT /api/users/me` with `{ "fcmToken": "..." }`
4. **Connect Socket.IO** → pass JWT in auth → listen for events
5. **Load conversations** → `GET /api/conversations` → display list
6. **Open a chat** → `GET /api/messages/:conversationId` → display messages
7. **Send text** → emit `send-message` via Socket.IO
8. **Send image** → `POST /api/messages` with multipart form data
9. **Receive messages** → listen for `new-message` Socket.IO event
10. **Handle notifications** → use `firebase_messaging` for background/foreground notifications

### Flutter Code Examples

#### Send a message via Socket.IO

```dart
socket.emit('send-message', {
  'conversationId': '64f1a2b3c4d5e6f7a8b9c0d3',
  'text': 'Hello!',
  'type': 'text',
});
```

#### Listen for new messages

```dart
socket.on('new-message', (data) {
  print('New message: ${data['text']}');
});
```

#### Typing indicators

```dart
// Start typing
socket.emit('typing', {
  'conversationId': '64f1a2b3c4d5e6f7a8b9c0d3',
  'receiverId': 'other-user-id',
});

// Stop typing
socket.emit('stop-typing', {
  'conversationId': '64f1a2b3c4d5e6f7a8b9c0d3',
  'receiverId': 'other-user-id',
});

// Listen
socket.on('typing', (data) {
  print('User ${data['senderId']} is typing...');
});
socket.on('stop-typing', (data) {
  // Hide typing indicator
});
```

#### Read receipts

```dart
// Mark messages as read when opening a conversation
socket.emit('mark-read', {
  'conversationId': '64f1a2b3c4d5e6f7a8b9c0d3',
});

// Listen for read confirmations
socket.on('messages-read', (data) {
  print('Read by ${data['readByUserId']} in ${data['conversationId']}');
});
```

#### Online/offline presence

```dart
socket.on('user-online', (data) {
  print('User ${data['userId']} is online');
});

socket.on('user-offline', (data) {
  print('User ${data['userId']} went offline at ${data['lastSeen']}');
});
```

---

## Key Design Decisions

### Dual Message Delivery
Messages can be sent via both REST API and Socket.IO. Both paths save to MongoDB, emit via Socket.IO, and trigger FCM push. REST is required for image uploads (file handling), while Socket.IO is preferred for text messages (lower latency).

### Route-to-Socket Bridge
The `MessagesController` injects the `ChatGateway` and uses `chatGateway.server` to emit Socket.IO events after REST operations. This allows HTTP-only operations (like image upload) to still trigger real-time events to the receiver.

### Socket.IO Room Per User
Each user joins a room named by their `userId` on connect. To send a message to a specific user, the server calls `server.to(userId).emit(...)`. This avoids broadcasting to all connected clients.

### Optional Firebase
Firebase Admin SDK is initialized only if `serviceAccountKey.json` exists. The `FirebaseService` gracefully disables itself on `onModuleInit()` if the file is missing. The server runs fully without Firebase — push notifications are simply disabled.

### lastMessage Reference
Each conversation stores a reference to its latest message. This avoids querying all messages just to show a preview in the conversation list screen.

### Global Exception Filter
All HTTP exceptions are mapped to a consistent `{ error: string }` format via `HttpExceptionFilter`. Validation errors from `class-validator` return the first error message. This makes error handling predictable for the Flutter client.

### ValidationPipe with Whitelist
The global `ValidationPipe` is configured with `whitelist: true` and `transform: true`. This strips unknown properties from request bodies and auto-transforms types, preventing clients from injecting unexpected fields.

---

## Project Structure

```
chat_api/
├── src/
│   ├── main.ts                              # Entry point — NestJS bootstrap
│   ├── app.module.ts                        # Root module
│   ├── auth/
│   │   ├── auth.module.ts                   # Auth module
│   │   ├── auth.controller.ts               # POST /register, /login, /google, /apple, /complete-profile
│   │   ├── auth.service.ts                  # Auth business logic
│   │   ├── oauth.service.ts                 # Google + Apple token verification
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts              # Passport JWT strategy
│   │   └── dto/
│   │       ├── register.dto.ts              # Registration validation
│   │       ├── login.dto.ts                 # Login validation
│   │       ├── google-auth.dto.ts           # Google auth validation
│   │       ├── apple-auth.dto.ts            # Apple auth validation
│   │       └── complete-profile.dto.ts      # Profile completion validation
│   ├── users/
│   │   ├── users.module.ts                  # Users module (exported)
│   │   ├── users.controller.ts              # GET /, GET /me, PUT /me
│   │   ├── users.service.ts                 # User CRUD operations
│   │   └── schemas/
│   │       └── user.schema.ts               # Mongoose User schema
│   ├── conversations/
│   │   ├── conversations.module.ts          # Conversations module
│   │   ├── conversations.controller.ts      # POST /, GET /
│   │   ├── conversations.service.ts         # Conversation logic
│   │   └── schemas/
│   │       └── conversation.schema.ts       # Mongoose Conversation schema
│   ├── messages/
│   │   ├── messages.module.ts               # Messages module
│   │   ├── messages.controller.ts           # GET /:conversationId, POST /
│   │   ├── messages.service.ts              # Message CRUD + pagination
│   │   └── schemas/
│   │       └── message.schema.ts            # Mongoose Message schema
│   ├── chat/
│   │   ├── chat.module.ts                   # Chat module
│   │   └── chat.gateway.ts                  # Socket.IO WebSocket gateway
│   ├── firebase/
│   │   ├── firebase.module.ts               # Global Firebase module
│   │   └── firebase.service.ts              # FCM push notification service
│   └── common/
│       ├── guards/
│       │   └── jwt-auth.guard.ts            # JWT authentication guard
│       ├── decorators/
│       │   └── current-user.decorator.ts    # @CurrentUser() parameter decorator
│       └── filters/
│           └── http-exception.filter.ts     # Global { error: string } filter
├── uploads/                                 # Uploaded images (gitignored)
├── dist/                                    # Compiled JavaScript (gitignored)
├── .env                                     # Environment variables
├── nest-cli.json                            # NestJS CLI config
├── tsconfig.json                            # TypeScript config
├── tsconfig.build.json                      # TypeScript build config
├── package.json
└── README.md
```

---

## License

ISC
