# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start with --watch (auto-restart on changes)
npm run build    # Compile TypeScript to dist/
npm start        # Production start (runs dist/main.js)
```

No test or lint commands are configured.

## Architecture

NestJS (TypeScript) backend for a Flutter chat app. Provides REST API + Socket.IO real-time messaging with MongoDB storage. Supports email/password, Google, and Apple sign-in.

**Entry point:** `src/main.ts` — bootstraps the NestJS app with CORS, global `/api` prefix, ValidationPipe, static file serving for `/uploads`, and a root health check at `GET /`.

### Module structure

- **AppModule** (`src/app.module.ts`) — Root module. Imports ConfigModule (global), MongooseModule, and all feature modules.
- **AuthModule** (`src/auth/`) — JWT strategy (Passport), OAuth service (Google/Apple token verification), auth controller (register, login, google, apple, complete-profile), DTOs with class-validator.
- **UsersModule** (`src/users/`) — User schema (Mongoose with bcrypt hooks), users service, users controller (list, me, update profile). Exported for use by Auth and other modules.
- **ConversationsModule** (`src/conversations/`) — Conversation schema, service (createOrGet, findAll), controller.
- **MessagesModule** (`src/messages/`) — Message schema, service (paginated get, create), controller with Multer file upload via FileInterceptor.
- **ChatModule** (`src/chat/`) — Socket.IO gateway (`@WebSocketGateway`). Handles connection auth, send-message, typing, stop-typing, mark-read, and presence (online/offline).
- **FirebaseModule** (`src/firebase/`) — Global module. Optional FCM push notifications (gracefully disabled if `serviceAccountKey.json` missing).

### Key patterns

- **Auth**: JWT tokens issued on register/login/OAuth. Passport JWT strategy (`src/auth/strategies/jwt.strategy.ts`) verifies `Authorization: Bearer <token>` and attaches user to request. `@UseGuards(JwtAuthGuard)` protects routes. Socket.IO uses the same JWT via `client.handshake.auth.token` in the gateway's `handleConnection`.
- **OAuth**: Google/Apple sign-in via ID token verification (`src/auth/oauth.service.ts`). Flutter handles the sign-in UI; server verifies tokens server-side. OAuth users get `isProfileComplete: false` until they provide gender + batch.
- **Account linking**: If a local user signs in via Google/Apple with the same email, the account is linked (authProvider updated). Different OAuth providers with the same email are rejected (409).
- **Dual message delivery**: Messages can be sent via REST (`POST /api/messages`) or Socket.IO (`send-message` event). Both paths save to MongoDB, emit to the receiver's Socket.IO room, and trigger FCM push notifications.
- **Socket.IO rooms**: Each user joins a room named by their `userId`. Gateway uses `this.server.to(userId).emit(...)`.
- **Route-to-socket bridge**: `MessagesController` injects `ChatGateway` and uses `chatGateway.server` to emit Socket.IO events after REST operations.
- **Firebase is optional**: `FirebaseService` checks for `serviceAccountKey.json` in `onModuleInit()`. Push notifications are simply disabled if missing.
- **Image uploads**: Handled via Multer (`FileInterceptor`) through REST only (not Socket.IO). Files saved to `uploads/` with unique names, served as static files at `/uploads/`.
- **Error format**: Global `HttpExceptionFilter` maps all errors to `{ error: string }` format for Flutter client compatibility.

### Data models (MongoDB/Mongoose)

- **User** (`src/users/schemas/user.schema.ts`) — `fname`, `lname`, `email`, optional `password`, `authProvider` (local/google/apple), `oauthId`, `gender`, `batch`, `isProfileComplete`, `avatar`, `fcmToken`, `isOnline`, `lastSeen`. Has bcrypt pre-save hook, `comparePassword()` method, `toJSON()` strips password and oauthId. Compound unique index on `{authProvider, oauthId}`.
- **Conversation** (`src/conversations/schemas/conversation.schema.ts`) — `participants` array (2 users), `lastMessage` ref. Indexed on `participants`.
- **Message** (`src/messages/schemas/message.schema.ts`) — refs `conversation` and `sender`, `type` enum (`text`/`image`), `readBy` array for read receipts. Indexed on `(conversation, createdAt)`.

### API routes

All routes are prefixed with `/api/`.

- **Auth** (`/api/auth`): `POST /register`, `POST /login`, `POST /google`, `POST /apple`, `POST /complete-profile` (auth required)
- **Users** (`/api/users`): `GET /` (search), `GET /me`, `PUT /me` — all auth required
- **Conversations** (`/api/conversations`): `POST /`, `GET /` — all auth required
- **Messages** (`/api/messages`): `GET /:conversationId`, `POST /` (with file upload) — all auth required

### Environment variables (.env)

- `PORT` — server port (default 3000)
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — signing key for JWT tokens
- `GOOGLE_CLIENT_ID` — Google OAuth client ID (for ID token verification)
- `APPLE_CLIENT_ID` — Apple Services ID / Bundle ID (for token verification)
