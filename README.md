# Chat API

A Node.js backend for a Flutter chat application supporting real-time 1-to-1 messaging, image sharing, read receipts, typing indicators, user presence, and push notifications.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (v18+) |
| Server | Express.js |
| Real-time | Socket.IO |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs + Google/Apple OAuth |
| File Uploads | Multer (local disk) |
| Push Notifications | Firebase Admin SDK (FCM) |

---

## How It Works — Architecture Overview

```
┌──────────────────┐         ┌──────────────────────────────────────────┐
│   Flutter App    │         │              Node.js Server              │
│                  │         │                                          │
│  ┌────────────┐  │  HTTP   │  ┌────────────┐    ┌─────────────────┐  │
│  │  REST API  │──┼────────►│  │   Express   │───►│  Route Handlers │  │
│  │  (http pkg)│  │         │  │  (REST API) │    │  auth, users,   │  │
│  └────────────┘  │         │  └────────────┘    │  conversations, │  │
│                  │         │                     │  messages        │  │
│  ┌────────────┐  │  WS     │  ┌────────────┐    └────────┬────────┘  │
│  │ Socket.IO  │──┼────────►│  │ Socket.IO  │             │           │
│  │  (client)  │  │         │  │  (server)  │             │           │
│  └────────────┘  │         │  └─────┬──────┘             │           │
│                  │         │        │                     │           │
│  ┌────────────┐  │  Push   │        │    ┌───────────────▼────────┐  │
│  │  Firebase  │◄─┼────────────────────── │      MongoDB           │  │
│  │ Messaging  │  │         │        │    │  Users, Conversations, │  │
│  └────────────┘  │         │        │    │  Messages              │  │
└──────────────────┘         │        │    └────────────────────────┘  │
                             │        │                                │
                             │  ┌─────▼──────┐   ┌──────────────────┐ │
                             │  │   FCM Push  │   │  Static Files    │ │
                             │  │ Notifications│   │  /uploads/*.jpg  │ │
                             │  └─────────────┘   └──────────────────┘ │
                             └──────────────────────────────────────────┘
```

The server provides **two communication channels**:

1. **REST API** — For CRUD operations: register/login, list users, manage conversations, send messages (especially images), update profile.
2. **Socket.IO** — For real-time features: instant message delivery, typing indicators, read receipts, and online/offline presence.

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

| Field | Type | Description |
|-------|------|-------------|
| `fname` | String | First name (required) |
| `lname` | String | Last name (required) |
| `email` | String | Unique, lowercase (required) |
| `password` | String | bcrypt hashed, only for local auth (optional for OAuth users) |
| `authProvider` | Enum | `'local'`, `'google'`, or `'apple'` |
| `gender` | Enum | `'male'`, `'female'`, or `'other'` |
| `batch` | String | Group/section name (e.g., "Batch A") |
| `isProfileComplete` | Boolean | `false` until OAuth users provide gender + batch |
| `avatar` | String | Profile image URL |
| `fcmToken` | String | Firebase device token for push notifications |
| `isOnline` | Boolean | Current online status |
| `lastSeen` | Date | Last disconnect timestamp |

### Conversation

| Field | Type | Description |
|-------|------|-------------|
| `participants` | [User] | Exactly 2 user references |
| `lastMessage` | Message | Reference to the most recent message (for conversation list preview) |

Indexed on `participants` for fast lookups.

### Message

| Field | Type | Description |
|-------|------|-------------|
| `conversation` | Conversation | Which conversation this belongs to |
| `sender` | User | Who sent the message |
| `type` | Enum | `'text'` or `'image'` |
| `text` | String | Message text or image caption |
| `image` | String | File path (e.g., `uploads/1704067200000-123456789.jpg`) |
| `readBy` | [User] | Array of user IDs who have read this message |

Indexed on `(conversation, createdAt)` for fast chronological retrieval.

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

Edit the `.env` file in the project root:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/chat_api
JWT_SECRET=your-super-secret-key-change-this-in-production
GOOGLE_CLIENT_ID=your-google-client-id
APPLE_CLIENT_ID=your-apple-bundle-id
```

- **PORT** — Server port (default: 3000)
- **MONGODB_URI** — Your MongoDB connection string
- **JWT_SECRET** — A long, random secret string for signing JWT tokens. Change this!
- **GOOGLE_CLIENT_ID** — Your Google OAuth client ID (from Google Cloud Console)
- **APPLE_CLIENT_ID** — Your Apple Services ID or Bundle ID

### 4. Firebase Setup (Optional — for push notifications)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create one)
3. Go to **Project Settings > Service Accounts**
4. Click **Generate New Private Key**
5. Save the downloaded JSON file as `serviceAccountKey.json` in the project root

> The server works without this file — push notifications will simply be disabled.

### 5. Run the Server

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

You should see:

```
Server running on port 3000
MongoDB connected: localhost
Firebase Admin SDK initialized.
```

---

## API Reference

### Base URL

```
http://localhost:3000/api
```

All authenticated endpoints require the header:

```
Authorization: Bearer <your-jwt-token>
```

---

### Authentication

#### Register (Email + Password)

```
POST /api/auth/register
```

**Body (JSON):**

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

**Response (201):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
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
    "lastSeen": "2025-01-01T00:00:00.000Z"
  }
}
```

#### Login (Email + Password)

```
POST /api/auth/login
```

**Body (JSON):**

```json
{
  "email": "kiran@example.com",
  "password": "password123"
}
```

**Response (200):** Same format as register.

> If the account was created via Google/Apple, login returns an error telling the user to sign in with their OAuth provider.

#### Google Sign-In

```
POST /api/auth/google
```

**Body (JSON):**

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

The `idToken` is the Google ID token obtained from `google_sign_in` Flutter package.

**Response (201 for new user, 200 for existing):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "...",
    "fname": "Kiran",
    "lname": "Kumar",
    "email": "kiran@gmail.com",
    "authProvider": "google",
    "isProfileComplete": false,
    "avatar": "https://lh3.googleusercontent.com/..."
  },
  "isNewUser": true
}
```

> When `isNewUser: true` or `isProfileComplete: false`, show a profile completion screen.

#### Apple Sign-In

```
POST /api/auth/apple
```

**Body (JSON):**

```json
{
  "identityToken": "eyJraWQiOiI4NkQ4...",
  "fname": "Kiran",
  "lname": "Kumar"
}
```

> Apple only provides the user's name on the **first** authorization. The Flutter app must capture it from `AuthorizationCredentialAppleID` and send it alongside the token. On subsequent sign-ins, `fname`/`lname` can be omitted.

**Response:** Same format as Google.

#### Complete Profile (after OAuth sign-up)

```
POST /api/auth/complete-profile
Authorization: Bearer <token>
```

**Body (JSON):**

```json
{
  "gender": "male",
  "batch": "Batch A",
  "fname": "Kiran",
  "lname": "Kumar"
}
```

`fname` and `lname` are optional (useful if Apple didn't provide a name). `gender` and `batch` are required.

**Response (200):**

```json
{
  "user": {
    "_id": "...",
    "fname": "Kiran",
    "lname": "Kumar",
    "gender": "male",
    "batch": "Batch A",
    "isProfileComplete": true
  }
}
```

#### Account Linking

- If a user signs up with email+password, then later signs in with Google/Apple using the **same email**, the accounts are automatically linked. The `authProvider` switches to the OAuth provider.
- If the email is already registered with a **different OAuth provider**, the request is rejected with a 409 error.

---

### Users

#### List All Users

```
GET /api/users
```

Returns all users except the currently authenticated user. Use this for the "start new chat" screen.

**Query Parameters:**

| Param    | Description                              |
| -------- | ---------------------------------------- |
| `search` | Filter users by first name, last name, or email (optional) |

**Example:** `GET /api/users?search=kiran`

**Response (200):**

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
    "avatar": "",
    "isOnline": true,
    "lastSeen": "2025-01-01T12:00:00.000Z"
  }
]
```

#### Get My Profile

```
GET /api/users/me
```

**Response (200):** Returns the authenticated user object.

#### Update My Profile

```
PUT /api/users/me
```

**Body (JSON):**

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

All fields are optional. Send only what you want to update.

> **Important:** After login in your Flutter app, call this endpoint with your FCM device token to enable push notifications.

**Response (200):** Returns the updated user object.

---

### Conversations

#### Create or Get Conversation

```
POST /api/conversations
```

If a conversation already exists between the two users, it returns the existing one instead of creating a duplicate.

**Body (JSON):**

```json
{
  "participantId": "64f1a2b3c4d5e6f7a8b9c0d2"
}
```

**Response (201 or 200):**

```json
{
  "_id": "64f1a2b3c4d5e6f7a8b9c0d3",
  "participants": [
    { "_id": "...", "fname": "Kiran", "lname": "Kumar" },
    { "_id": "...", "fname": "Amit", "lname": "Sharma" }
  ],
  "lastMessage": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

#### List My Conversations

```
GET /api/conversations
```

Returns all conversations for the authenticated user, sorted by most recent activity.

**Response (200):**

```json
[
  {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d3",
    "participants": [
      { "_id": "...", "fname": "Kiran", "lname": "Kumar" },
      { "_id": "...", "fname": "Amit", "lname": "Sharma" }
    ],
    "lastMessage": {
      "_id": "...",
      "text": "Hello!",
      "type": "text",
      "sender": "...",
      "createdAt": "2025-01-01T12:30:00.000Z"
    },
    "updatedAt": "2025-01-01T12:30:00.000Z"
  }
]
```

---

### Messages

#### Get Messages

```
GET /api/messages/:conversationId
```

**Query Parameters:**

| Param   | Default | Description       |
| ------- | ------- | ----------------- |
| `page`  | 1       | Page number       |
| `limit` | 30      | Messages per page |

**Example:** `GET /api/messages/64f1a2b3c4d5e6f7a8b9c0d3?page=1&limit=20`

**Response (200):**

```json
{
  "messages": [
    {
      "_id": "...",
      "conversation": "64f1a2b3c4d5e6f7a8b9c0d3",
      "sender": { "_id": "...", "fname": "Kiran", "lname": "Kumar" },
      "type": "text",
      "text": "Hello!",
      "image": "",
      "readBy": ["..."],
      "createdAt": "2025-01-01T12:30:00.000Z"
    }
  ],
  "page": 1,
  "totalPages": 3,
  "total": 85
}
```

#### Send a Text Message

```
POST /api/messages
Content-Type: application/json
```

**Body (JSON):**

```json
{
  "conversationId": "64f1a2b3c4d5e6f7a8b9c0d3",
  "type": "text",
  "text": "Hello!"
}
```

#### Send an Image Message

```
POST /api/messages
Content-Type: multipart/form-data
```

**Form Fields:**

| Field            | Type   | Required | Description                                          |
| ---------------- | ------ | -------- | ---------------------------------------------------- |
| `conversationId` | string | Yes      | Conversation ID                                      |
| `type`           | string | No       | Set to `"image"` (auto-detected if file is attached) |
| `text`           | string | No       | Optional caption                                     |
| `image`          | file   | Yes      | Image file (jpeg, jpg, png, gif, webp — max 5MB)     |

**Response (201):**

```json
{
  "_id": "...",
  "conversation": "64f1a2b3c4d5e6f7a8b9c0d3",
  "sender": { "_id": "...", "fname": "Kiran", "lname": "Kumar" },
  "type": "image",
  "text": "Check this out",
  "image": "uploads/1704067200000-123456789.jpg",
  "readBy": ["..."],
  "createdAt": "2025-01-01T12:35:00.000Z"
}
```

**Accessing uploaded images:**

```
GET http://localhost:3000/uploads/1704067200000-123456789.jpg
```

---

## Socket.IO — Real-Time Events

### Connecting from Flutter

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

final socket = IO.io('http://YOUR_SERVER_IP:3000', <String, dynamic>{
  'transports': ['websocket'],
  'autoConnect': false,
  'auth': {'token': 'your-jwt-token-here'},
});

socket.connect();
```

### Events Reference

#### Client → Server (Emit)

| Event | Payload | Description |
|-------|---------|-------------|
| `send-message` | `{ conversationId, text, type }` | Send a text message |
| `typing` | `{ conversationId, receiverId }` | Notify receiver you're typing |
| `stop-typing` | `{ conversationId, receiverId }` | Notify receiver you stopped typing |
| `mark-read` | `{ conversationId }` | Mark all messages in conversation as read |

#### Server → Client (Listen)

| Event | Payload | Description |
|-------|---------|-------------|
| `new-message` | Full message object with sender populated | A message was sent or received |
| `user-online` | `{ userId }` | A user connected |
| `user-offline` | `{ userId, lastSeen }` | A user disconnected |
| `typing` | `{ conversationId, senderId }` | Another user is typing |
| `stop-typing` | `{ conversationId, senderId }` | Another user stopped typing |
| `messages-read` | `{ conversationId, readByUserId }` | Your messages were read |

### Flutter Code Examples

#### Send a message

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
  // data contains the full message object with sender info
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

---

## Key Design Decisions

### Dual Message Delivery
Messages can be sent via both REST API and Socket.IO. Both paths save to MongoDB, emit via Socket.IO, and trigger FCM push. REST is required for image uploads (file handling), while Socket.IO is preferred for text messages (lower latency).

### Route-to-Socket Bridge
REST route handlers access the Socket.IO instance via `req.app.get('io')`. This allows HTTP-only operations (like image upload) to still trigger real-time events to the receiver.

### Socket.IO Room Per User
Each user joins a room named by their `userId` on connect. To send a message to a specific user, the server calls `io.to(userId).emit(...)`. This avoids broadcasting to all connected clients.

### Optional Firebase
Firebase Admin SDK is initialized only if `serviceAccountKey.json` exists. All FCM call sites guard with `if (admin)` checks. The server runs fully without Firebase — push notifications are simply disabled.

### lastMessage Reference
Each conversation stores a reference to its latest message. This avoids querying all messages just to show a preview in the conversation list screen.

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Description of what went wrong."
}
```

| Status | Meaning                                            |
| ------ | -------------------------------------------------- |
| 400    | Bad request — missing or invalid fields            |
| 401    | Unauthorized — missing or invalid JWT token        |
| 404    | Not found — conversation or resource doesn't exist |
| 409    | Conflict — email already registered with a different OAuth provider |
| 500    | Server error                                       |

---

## Project Structure

```
chat_api/
├── server.js                  # Entry point — Express + Socket.IO + MongoDB
├── .env                       # Environment variables
├── .gitignore
├── config/
│   ├── db.js                  # MongoDB connection
│   ├── firebase.js            # Firebase Admin SDK (optional)
│   └── oauth.js               # Google + Apple token verification
├── middleware/
│   ├── auth.js                # JWT verification → attaches req.user
│   └── upload.js              # Multer config — 5MB, images only
├── models/
│   ├── User.js                # User schema + password hashing
│   ├── Conversation.js        # Conversation schema (2 participants)
│   └── Message.js             # Message schema (text/image + readBy)
├── routes/
│   ├── auth.routes.js         # POST /api/auth/register, /login, /google, /apple, /complete-profile
│   ├── user.routes.js         # GET/PUT /api/users
│   ├── conversation.routes.js # GET/POST /api/conversations
│   └── message.routes.js      # GET/POST /api/messages
├── socket/
│   └── index.js               # Socket.IO auth + event handlers
└── uploads/                   # Uploaded images (gitignored)
```
