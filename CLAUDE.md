# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start with nodemon (auto-restart on changes)
npm start        # Production start
```

No test or lint commands are configured.

## Architecture

Node.js + Express backend for a Flutter chat app. Provides REST API + Socket.IO real-time messaging with MongoDB storage. Supports email/password, Google, and Apple sign-in.

**Entry point:** `server.js` — creates Express app, HTTP server, and Socket.IO instance. Connects to MongoDB, registers routes under `/api/`, and exposes Socket.IO to route handlers via `app.set('io', io)`.

### Key patterns

- **Auth**: JWT tokens issued on register/login/OAuth. `middleware/auth.js` verifies `Authorization: Bearer <token>` and attaches `req.user`. Socket.IO uses the same JWT via `socket.handshake.auth.token`.
- **OAuth**: Google/Apple sign-in via ID token verification (`config/oauth.js`). Flutter handles the sign-in UI; server verifies tokens server-side. OAuth users get `isProfileComplete: false` until they provide gender + batch.
- **Account linking**: If a local user signs in via Google/Apple with the same email, the account is linked (authProvider updated). Different OAuth providers with the same email are rejected (409).
- **Dual message delivery**: Messages can be sent via REST (`POST /api/messages`) or Socket.IO (`send-message` event). Both paths save to MongoDB, emit to the receiver's Socket.IO room, and trigger FCM push notifications.
- **Socket.IO rooms**: Each user joins a room named by their `userId`. To send to a specific user: `io.to(userId).emit(...)`.
- **Route-to-socket bridge**: Routes access Socket.IO via `req.app.get('io')` to emit events after REST operations (e.g., image upload via HTTP triggers a real-time `new-message` event).
- **Firebase is optional**: `config/firebase.js` exports `null` if `serviceAccountKey.json` is missing. All FCM call sites guard against null. The server runs fully without Firebase — push notifications are simply disabled.
- **Image uploads**: Handled via Multer (`middleware/upload.js`) through REST only (not Socket.IO). Files saved to `uploads/` with unique names, served as static files at `/uploads/`.

### Data models (MongoDB/Mongoose)

- **User** — `fname`, `lname`, `email`, optional `password` (only for local auth), `authProvider` (local/google/apple), `oauthId`, `gender`, `batch`, `isProfileComplete`, `avatar`, `fcmToken`, `isOnline`, `lastSeen`. Has bcrypt pre-save hook, `toJSON()` strips password and oauthId. Compound unique index on `{authProvider, oauthId}`.
- **Conversation** — `participants` array (exactly 2 users for 1-to-1), `lastMessage` ref updated on each new message. Indexed on `participants`.
- **Message** — refs `conversation` and `sender`, `type` enum (`text`/`image`), `readBy` array for read receipts. Indexed on `(conversation, createdAt)`.

### Auth routes (`/api/auth`)

- `POST /register` — local signup with `fname, lname, email, password, gender, batch`
- `POST /login` — email/password login (rejects OAuth-only users)
- `POST /google` — verify Google ID token, create/find/link user
- `POST /apple` — verify Apple identity token, accepts `fname, lname` from body
- `POST /complete-profile` — (auth required) set `gender, batch` after OAuth signup

### Environment variables (.env)

- `PORT` — server port (default 3000)
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — signing key for JWT tokens
- `GOOGLE_CLIENT_ID` — Google OAuth client ID (for ID token verification)
- `APPLE_CLIENT_ID` — Apple Services ID / Bundle ID (for token verification)
