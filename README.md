# Chat API

A Node.js backend for a Flutter chat application supporting real-time 1-to-1 messaging, image sharing, and push notifications.

## Tech Stack

- **Node.js + Express** — REST API
- **MongoDB + Mongoose** — Database
- **Socket.IO** — Real-time communication
- **JWT** — Authentication
- **Multer** — Image uploads (local storage)
- **Firebase Admin SDK** — Push notifications (FCM)

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
```

- **PORT** — Server port (default: 3000)
- **MONGODB_URI** — Your MongoDB connection string
- **JWT_SECRET** — A long, random secret string for signing JWT tokens. Change this!

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

#### Register

```
POST /api/auth/register
```

**Body (JSON):**

```json
{
  "name": "Kiran",
  "email": "kiran@example.com",
  "password": "password123"
}
```

**Response (201):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Kiran",
    "email": "kiran@example.com",
    "avatar": "",
    "fcmToken": "",
    "isOnline": false,
    "lastSeen": "2025-01-01T00:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

#### Login

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
| `search` | Filter users by name or email (optional) |

**Example:** `GET /api/users?search=kiran`

**Response (200):**

```json
[
  {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
    "name": "Amit",
    "email": "amit@example.com",
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
  "name": "New Name",
  "avatar": "https://example.com/avatar.jpg",
  "fcmToken": "firebase-device-token-here"
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
    { "_id": "...", "name": "Kiran", "email": "kiran@example.com" },
    { "_id": "...", "name": "Amit", "email": "amit@example.com" }
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
      { "_id": "...", "name": "Kiran" },
      { "_id": "...", "name": "Amit" }
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
      "sender": { "_id": "...", "name": "Kiran" },
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
  "sender": { "_id": "...", "name": "Kiran" },
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

### Events Your Flutter App Should Emit (Client → Server)

#### `join`

Call after connecting to mark yourself as online.

```dart
socket.emit('join', {'userId': currentUserId});
```

#### `send-message`

Send a text message in real-time (use REST API for image messages).

```dart
socket.emit('send-message', {
  'conversationId': '64f1a2b3c4d5e6f7a8b9c0d3',
  'text': 'Hello!',
  'type': 'text',
});
```

#### `typing`

Show typing indicator to the other user.

```dart
socket.emit('typing', {
  'conversationId': '64f1a2b3c4d5e6f7a8b9c0d3',
  'receiverId': 'other-user-id',
});
```

#### `stop-typing`

Hide typing indicator.

```dart
socket.emit('stop-typing', {
  'conversationId': '64f1a2b3c4d5e6f7a8b9c0d3',
  'receiverId': 'other-user-id',
});
```

#### `mark-read`

Mark all messages in a conversation as read.

```dart
socket.emit('mark-read', {
  'conversationId': '64f1a2b3c4d5e6f7a8b9c0d3',
});
```

### Events Your Flutter App Should Listen For (Server → Client)

#### `new-message`

A new message was received.

```dart
socket.on('new-message', (data) {
  // data contains the full message object with sender info
  print('New message: ${data['text']}');
});
```

#### `user-online`

A user came online.

```dart
socket.on('user-online', (data) {
  print('User ${data['userId']} is online');
});
```

#### `user-offline`

A user went offline.

```dart
socket.on('user-offline', (data) {
  print('User ${data['userId']} is offline, last seen: ${data['lastSeen']}');
});
```

#### `typing` / `stop-typing`

Typing indicator events.

```dart
socket.on('typing', (data) {
  // Show "User is typing..." in conversation
  print('User ${data['senderId']} is typing in ${data['conversationId']}');
});

socket.on('stop-typing', (data) {
  // Hide typing indicator
});
```

#### `messages-read`

The other user has read your messages.

```dart
socket.on('messages-read', (data) {
  // Update read receipts in UI
  print('Messages read by ${data['readByUserId']} in ${data['conversationId']}');
});
```

---

## Flutter Integration — Quick Start

### Required Flutter Packages

Add these to your Flutter `pubspec.yaml`:

```yaml
dependencies:
  http: ^1.2.0
  socket_io_client: ^3.0.2
  firebase_core: ^3.8.1
  firebase_messaging: ^15.1.6
  flutter_secure_storage: ^9.2.4
  image_picker: ^1.1.2
```

### Typical Flutter Flow

1. **Register/Login** → call `POST /api/auth/register` or `/login` → store JWT token securely
2. **Save FCM token** → get FCM token from `FirebaseMessaging.instance.getToken()` → call `PUT /api/users/me` with `{ "fcmToken": "..." }`
3. **Connect Socket.IO** → pass JWT in auth → listen for events
4. **Load conversations** → call `GET /api/conversations` → display list
5. **Open a chat** → call `GET /api/messages/:conversationId` → display messages
6. **Send text** → emit `send-message` via Socket.IO
7. **Send image** → call `POST /api/messages` with multipart form data
8. **Receive messages** → listen for `new-message` Socket.IO event
9. **Handle notifications** → use `firebase_messaging` to handle background/foreground notifications

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
| 500    | Server error                                       |

---

## Project Structure

```
chat_api/
├── server.js                  # Entry point
├── .env                       # Environment variables
├── .gitignore
├── config/
│   ├── db.js                  # MongoDB connection
│   └── firebase.js            # Firebase Admin SDK
├── middleware/
│   ├── auth.js                # JWT authentication
│   └── upload.js              # Multer image upload config
├── models/
│   ├── User.js                # User schema
│   ├── Conversation.js        # Conversation schema
│   └── Message.js             # Message schema
├── routes/
│   ├── auth.routes.js         # /api/auth/*
│   ├── user.routes.js         # /api/users/*
│   ├── conversation.routes.js # /api/conversations/*
│   └── message.routes.js      # /api/messages/*
├── socket/
│   └── index.js               # Socket.IO event handlers
└── uploads/                   # Uploaded images (gitignored)
```
