# Deployment Guide

Step-by-step guide to host the Chat API and set up CI/CD.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Docker Setup](#2-local-docker-setup)
3. [Hosting Options](#3-hosting-options)
   - [Option A: Railway (Easiest)](#option-a-railway-easiest)
   - [Option B: Render](#option-b-render)
   - [Option C: VPS (Full Control)](#option-c-vps-full-control)
4. [CI/CD Pipeline Setup](#4-cicd-pipeline-setup)
5. [Environment Variables Reference](#5-environment-variables-reference)
6. [Post-Deployment Checklist](#6-post-deployment-checklist)

---

## 1. Prerequisites

Before deploying, make sure you have:

- **GitHub repository** with your code pushed
- **MongoDB Atlas** account (free tier works) — [https://cloud.mongodb.com](https://cloud.mongodb.com)
- **Docker** installed locally (for testing) — [https://docker.com](https://docker.com)
- **Node.js 20+** installed

### Set up MongoDB Atlas (Production Database)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and create a free account
2. Create a new cluster (free M0 tier)
3. Go to **Database Access** → Add a database user (username + password)
4. Go to **Network Access** → Add `0.0.0.0/0` (allow from anywhere)
5. Go to **Database** → Click **Connect** → Choose **Drivers** → Copy the connection string
6. It looks like: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/chat_api`

Save this — you'll need it as `MONGODB_URI`.

---

## 2. Local Docker Setup

Test everything locally before deploying:

```bash
# Build and run with Docker Compose
docker compose up --build

# App runs at http://localhost:3000
# MongoDB runs at localhost:27017

# Stop everything
docker compose down

# Stop and delete data
docker compose down -v
```

To use MongoDB Atlas instead of local MongoDB:

```bash
# Create .env file
echo "MONGODB_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/chat_api" > .env
echo "JWT_SECRET=your-secret-key-here" >> .env

# Run only the app (no local MongoDB)
docker build -t chat-api .
docker run -p 3000:3000 --env-file .env chat-api
```

---

## 3. Hosting Options

### Option A: Railway (Easiest)

Railway auto-detects Dockerfiles and deploys with zero config.

**Step 1: Create Railway account**

- Go to [railway.app](https://railway.app) and sign up with GitHub

**Step 2: Create new project**

- Click **New Project** → **Deploy from GitHub repo**
- Select your repository
- Railway auto-detects the Dockerfile

**Step 3: Add MongoDB**

- In your Railway project, click **+ New** → **Database** → **MongoDB**
- Railway automatically sets `MONGODB_URI` for you

**Step 4: Add environment variables**

- Click on your service → **Variables** tab
- Add these variables:
  ```
  JWT_SECRET=your-super-secret-jwt-key-change-this
  GOOGLE_CLIENT_ID=your-google-client-id (if using Google auth)
  APPLE_CLIENT_ID=your-apple-client-id (if using Apple auth)
  PORT=3000
  ```

**Step 5: Deploy**

- Railway deploys automatically on every push to `main`
- Get your public URL from **Settings** → **Domains** → **Generate Domain**

**Cost**: Free tier gives $5/month credit. Hobby plan is $5/month.

---

### Option B: Render

**Step 1: Create Render account**

- Go to [render.com](https://render.com) and sign up with GitHub

**Step 2: Create Web Service**

- Click **New** → **Web Service**
- Connect your GitHub repository
- Settings:
  - **Runtime**: Docker
  - **Instance Type**: Free (or Starter $7/month)
  - **Region**: Pick closest to your users

**Step 3: Add MongoDB**

- Use **MongoDB Atlas** (Render doesn't have built-in MongoDB)
- Copy your Atlas connection string

**Step 4: Add environment variables**

- In the service dashboard → **Environment** tab:
  ```
  MONGODB_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/chat_api
  JWT_SECRET=your-super-secret-jwt-key-change-this
  GOOGLE_CLIENT_ID=your-google-client-id
  APPLE_CLIENT_ID=your-apple-client-id
  PORT=3000
  ```

**Step 5: Deploy**

- Render deploys automatically on push to `main`
- Get your URL: `https://your-service.onrender.com`

**Note**: Free tier spins down after 15 min of inactivity (cold starts). Starter plan ($7/month) keeps it running.

---

### Option C: VPS (Full Control)

For a VPS (DigitalOcean, Hetzner, AWS EC2, etc.):

**Step 1: Get a VPS**

- DigitalOcean: $6/month droplet (1GB RAM, Ubuntu 24.04)
- Hetzner: $4/month CX22

**Step 2: SSH into your server**

```bash
ssh root@your-server-ip
```

**Step 3: Install Docker**

```bash
curl -fsSL https://get.docker.com | sh
```

**Step 4: Clone your repo**

```bash
mkdir -p /opt/chat-api && cd /opt/chat-api
git clone https://github.com/YOUR_USERNAME/chat_api.git .
```

**Step 5: Create environment file**

```bash
cat > .env << 'EOF'
PORT=3000
MONGODB_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/chat_api
JWT_SECRET=your-super-secret-jwt-key-change-this
GOOGLE_CLIENT_ID=your-google-client-id
APPLE_CLIENT_ID=your-apple-client-id
EOF
```

**Step 6: Start the app**

```bash
docker compose up -d --build
```

**Step 7: Set up reverse proxy (Nginx + SSL)**

```bash
# Install Nginx and Certbot
apt install -y nginx certbot python3-certbot-nginx

# Create Nginx config
cat > /etc/nginx/sites-available/chat-api << 'EOF'
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/chat-api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Get SSL certificate (free)
certbot --nginx -d your-domain.com
```

**Step 8: Set up auto-renewal for SSL**

```bash
# Certbot auto-renews via systemd timer (already set up)
systemctl status certbot.timer
```

---

## 4. CI/CD Pipeline Setup

The GitHub Actions workflow is already created at `.github/workflows/ci-cd.yml`. Here's how to set it up:

### Step 1: Push your code to GitHub

```bash
git add .
git commit -m "Add Docker and CI/CD configuration"
git push origin main
```

### Step 2: Add GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

**Required secrets (for Docker Hub push):**

| Secret            | Value                        |
| ----------------- | ---------------------------- |
| `DOCKER_USERNAME` | Your Docker Hub username     |
| `DOCKER_PASSWORD` | Your Docker Hub access token |

**Create a Docker Hub access token:**

1. Go to [hub.docker.com](https://hub.docker.com) → Account Settings → Security
2. Click **New Access Token** → name it "github-actions" → Generate
3. Copy the token and add it as `DOCKER_PASSWORD` secret

### Step 3: Choose your deploy target

Go to **Settings** → **Secrets and variables** → **Actions** → **Variables** tab → **New repository variable**

Add: `DEPLOY_TARGET` = one of: `railway`, `render`, or `vps`

Then add the secrets for your chosen platform:

**For Railway:**

| Secret            | Value                                                   |
| ----------------- | ------------------------------------------------------- |
| `RAILWAY_TOKEN`   | Railway API token (from railway.app → Account → Tokens) |
| `RAILWAY_SERVICE` | Your Railway service ID                                 |

**For Render:**

| Secret                   | Value                                                                 |
| ------------------------ | --------------------------------------------------------------------- |
| `RENDER_DEPLOY_HOOK_URL` | Deploy hook URL (Render dashboard → Service → Settings → Deploy Hook) |

**For VPS:**

| Secret        | Value                                              |
| ------------- | -------------------------------------------------- |
| `VPS_HOST`    | Your server IP (e.g., `142.93.xx.xx`)              |
| `VPS_USER`    | SSH user (e.g., `root`)                            |
| `VPS_SSH_KEY` | Your private SSH key (contents of `~/.ssh/id_rsa`) |

### Step 4: Test the pipeline

```bash
# Make a change and push
git add .
git commit -m "Test CI/CD pipeline"
git push origin main
```

Go to your GitHub repo → **Actions** tab to watch the pipeline run.

### How the pipeline works

```
Push to main
    │
    ▼
┌──────────────┐
│  Build Job   │  ← Installs deps, builds server + client
│  (2-3 min)   │     Uploads build artifacts
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Docker Job  │  ← Builds Docker image, pushes to Docker Hub
│  (3-5 min)   │     Tags: latest + commit SHA
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Deploy Job  │  ← Deploys to Railway/Render/VPS
│  (1-2 min)   │     Based on DEPLOY_TARGET variable
└──────────────┘
```

On **pull requests**, only the Build job runs (no Docker push, no deploy).

---

## 5. Environment Variables Reference

| Variable           | Required | Description                       |
| ------------------ | -------- | --------------------------------- |
| `PORT`             | No       | Server port (default: 3000)       |
| `MONGODB_URI`      | Yes      | MongoDB connection string         |
| `JWT_SECRET`       | Yes      | Secret key for signing JWT tokens |
| `GOOGLE_CLIENT_ID` | No       | Google OAuth client ID            |
| `APPLE_CLIENT_ID`  | No       | Apple Services/Bundle ID          |

**Generating a strong JWT_SECRET:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 6. Post-Deployment Checklist

After deploying, verify everything works:

- [ ] **Health check**: `curl https://your-domain.com/` returns the app
- [ ] **API works**: `curl https://your-domain.com/api/auth/login` returns error (not 502/503)
- [ ] **WebSocket works**: Open the web client, check Socket.IO connects
- [ ] **Image uploads work**: Send an image in chat, verify it displays
- [ ] **Seed data** (optional): Run seed against production DB
  ```bash
  MONGODB_URI="your-prod-uri" npm run seed
  ```
- [ ] **Monitor logs**:
  - Railway: Dashboard → Service → Logs
  - Render: Dashboard → Service → Logs
  - VPS: `docker compose logs -f`

### Updating the Flutter app

Update the base URL in your Flutter app to point to your deployed server:

```dart
// lib/config.dart
const String apiBaseUrl = 'https://your-domain.com/api';
const String socketUrl = 'https://your-domain.com';
```
