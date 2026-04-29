# ☁️ SkyStore — Secure Cloud File Vault

> A full-stack, production-ready cloud storage application powered by **Convex**, **AWS S3**, and **React**, with a fully automated **CI/CD pipeline** using **Jenkins** and **Docker**.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Live Architecture](#-live-architecture)
- [Tech Stack](#-tech-stack)
- [Features](#-features)
- [Application Architecture](#-application-architecture)
  - [Frontend](#frontend)
  - [Backend (Convex)](#backend-convex)
  - [Database Schema](#database-schema)
  - [AWS S3 Integration](#aws-s3-integration)
- [DevOps Pipeline](#-devops-pipeline)
  - [Containerization (Docker)](#containerization-docker)
  - [CI/CD with Jenkins](#cicd-with-jenkins)
  - [Pipeline Stages](#pipeline-stages)
  - [Secrets Management](#secrets-management)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Local Development](#local-development)
  - [Docker Build & Run](#docker-build--run)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)

---

## 🔍 Overview

**SkyStore** is a minimalist, lightning-fast cloud storage platform that allows authenticated users to securely upload, organize, and access files from anywhere. Files are stored directly in **AWS S3** using pre-signed URLs, while metadata and user accounts are managed through **Convex**'s real-time backend.

The project is built with a strong DevOps focus — the entire lifecycle from code commit to production deployment is automated through a **Jenkins CI/CD pipeline** that builds a Docker image, runs smoke tests, and deploys the containerized application.

---

## 🏗️ Live Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                          │
│                    React + Vite (TypeScript)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                 │
          ▼                                 ▼
┌─────────────────┐              ┌─────────────────────┐
│  Convex Backend │              │     AWS S3 Bucket   │
│  (Real-time DB) │              │  (Binary File Store)│
│                 │              │                     │
│ • Auth          │◄─Pre-signed─►│ • Files stored as   │
│ • File metadata │   URLs       │   UUID-keyed objects│
│ • Folder tree   │              │ • 1hr expiring URLs │
│ • CRUD ops      │              │ • PUT/GET/DELETE     │
└─────────────────┘              └─────────────────────┘

          CI/CD Pipeline (Jenkins + Docker)
┌──────────────────────────────────────────────────────────────┐
│  Git Push → Jenkins → Docker Build → Smoke Test → Deploy     │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, TypeScript | UI framework |
| **Bundler** | Vite 6 | Fast builds & HMR |
| **Styling** | Tailwind CSS 3 | Utility-first styling |
| **Backend** | Convex | Real-time serverless backend |
| **Auth** | `@convex-dev/auth` | Password + anonymous auth |
| **Storage** | AWS S3 + SDK v3 | Binary file storage |
| **Containerization** | Docker (multi-stage) | Reproducible builds |
| **Web Server** | Nginx (Alpine) | Serving static assets in Docker |
| **CI/CD** | Jenkins | Automated pipeline |
| **Notifications** | Sonner | Toast notifications |

---

## ✨ Features

- 🔐 **Secure Authentication** — Email/password sign-up and sign-in, with anonymous access support
- 📁 **Nested Folder Structure** — Create folders and organize files in a recursive hierarchy
- ⚡ **Lightning-fast S3 Uploads** — Files are uploaded directly from the browser to AWS S3 using pre-signed PUT URLs
- 🔗 **Expiring Download Links** — Pre-signed GET URLs valid for 1 hour per access
- 🗑️ **Full Delete Support** — Removes both the S3 object and the database record atomically
- 🔒 **Per-user Isolation** — All files and folders are scoped to the authenticated user's identity
- 📱 **Responsive Design** — Works across all screen sizes
- 🌙 **Dark Mode** — A premium dark theme with glassmorphic UI elements

---

## 📐 Application Architecture

### Frontend

The frontend is a **React 19** single-page application written in **TypeScript** and bundled with **Vite**. It uses `convex/react` hooks for reactive, real-time data fetching — no manual polling or REST calls needed.

**Key Components:**

| Component | File | Description |
|---|---|---|
| `App` | `src/App.tsx` | Root layout, header, and authenticated/unauthenticated routing |
| `Content` | `src/App.tsx` | Core dashboard: file/folder CRUD, upload handling |
| `SignInForm` | `src/SignInForm.tsx` | Email/password + anonymous login form |
| `SignOutButton` | `src/SignOutButton.tsx` | Session termination |

**State Management:** Convex's `useQuery`, `useMutation`, and `useAction` hooks handle all server state reactively — the UI updates in real-time whenever the backend state changes.

---

### Backend (Convex)

Convex serves as both the **real-time database** and the **serverless functions** layer. All backend logic lives in the `convex/` directory.

| File | Type | Purpose |
|---|---|---|
| `convex/files.ts` | Mutations, Queries, Actions | All file/folder CRUD operations + S3 integration |
| `convex/auth.ts` | Auth config | User identity and session management |
| `convex/auth.config.ts` | Auth providers | Configures password-based authentication |
| `convex/schema.ts` | Schema | Defines `files` and `folders` tables with indexes |
| `convex/http.ts` | HTTP router | Handles Convex auth HTTP callbacks |

**Convex Function Types Used:**
- **`mutation`** — Writes to the database (create file/folder, delete file/folder)
- **`query`** — Reads from database + generates S3 signed GET URLs (real-time reactive)
- **`action`** — Calls external services; used for deleting objects directly from AWS S3

---

### Database Schema

```typescript
// convex/schema.ts
files: defineTable({
  name: string,
  size: number,
  storageId: string,        // UUID key in S3 bucket
  parentId: id("folders") | null,  // Enables nesting
  ownerId: id("users"),     // User-scoped isolation
})
  .index("by_parent", ["parentId"])   // Efficient folder queries
  .index("by_storageId", ["storageId"]) // Fast lookups for delete

folders: defineTable({
  name: string,
  parentId: id("folders") | null,  // Recursive nesting
  ownerId: id("users"),
}).index("by_parent", ["parentId"])
```

---

### AWS S3 Integration

Files are **never** routed through the Convex backend servers. Instead, a two-step pre-signed URL approach is used for maximum efficiency and security:

**Upload Flow:**
```
1. Browser → Convex mutation (generateUploadUrl)
               ↓ generates UUID key + pre-signed PUT URL (1hr expiry)
2. Browser → S3 directly (PUT binary data)
3. Browser → Convex mutation (createFile) — saves metadata to DB
```

**Download Flow:**
```
1. listItems query runs on page load
2. For each file, a pre-signed GET URL is generated (1hr expiry)
3. URLs are returned with the file list
4. Browser downloads directly from S3 via the signed URL
```

**Delete Flow:**
```
1. deleteFile mutation → removes DB record
2. deleteFileFromS3 action → sends DeleteObjectCommand to S3
```

---

## 🚀 DevOps Pipeline

This section is the cornerstone of the project's production readiness. The entire build, test, and deployment lifecycle is fully automated.

### Containerization (Docker)

The application uses a **multi-stage Docker build** to produce a lean, production-optimized image:

```dockerfile
# Stage 1: Node.js builder — compiles TypeScript & bundles with Vite
FROM node:24-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build          # Output: /app/dist

# Stage 2: Nginx Alpine — only the compiled static assets, no Node.js
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Why multi-stage?**
- The final image contains **only Nginx + static files** — no Node.js, no `node_modules`, no source code
- Dramatically smaller image size (Nginx Alpine is ~5 MB vs Node.js ~300 MB)
- Reduced attack surface in production

The Vite `VITE_CONVEX_URL` environment variable is injected at **build time** as a Docker build argument, so the production bundle is pre-configured with the correct backend URL.

---

### CI/CD with Jenkins

The `Jenkinsfile` in the repository root defines a **declarative pipeline** that runs on every code change.

**Pipeline Overview:**

```
┌──────────────┐    ┌──────────────────┐    ┌────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│   Checkout   │───►│  Build Docker    │───►│ Smoke Test │───►│  Stop Old Container │───►│  Run New         │
│   Code       │    │  Image           │    │ (curl)     │    │  (if exists)        │    │  Container       │
└──────────────┘    └──────────────────┘    └────────────┘    └─────────────────────┘    └──────────────────┘
```

---

### Pipeline Stages

#### 1. `Checkout Code`
Pulls the latest source code from the configured SCM (Source Control Management) repository.

```groovy
stage('Checkout Code') {
    steps {
        checkout scm
    }
}
```

#### 2. `Build Docker Image`
Builds the production Docker image, passing the `VITE_CONVEX_URL` secret as a build argument. The `--no-cache` flag ensures a clean, reproducible build.

```groovy
stage('Build Docker Image') {
    steps {
        sh '''
        docker build --no-cache \
            --build-arg VITE_CONVEX_URL=${VITE_CONVEX_URL} \
            -t ${IMAGE_NAME}:${IMAGE_TAG} .
        '''
    }
}
```

#### 3. `Smoke Test`
Starts a **temporary container** on port `8081` and uses `curl` to verify the app is serving correctly by checking for the expected `<title>SkyStore</title>` tag in the HTML response. If the check fails, Docker logs are printed and the pipeline aborts.

```groovy
stage('Smoke Test') {
    steps {
        sh 'docker run --name temp-${CONTAINER_NAME} -d -p 8081:80 ${IMAGE_NAME}:${IMAGE_TAG}'
        sh 'sleep 5'
        sh 'curl -s http://localhost:8081 | grep -q "<title>SkyStore</title>" || (docker logs ... && exit 1)'
        sh 'docker stop temp-${CONTAINER_NAME} && docker rm temp-${CONTAINER_NAME}'
    }
}
```

#### 4. `Stop Existing Container`
Safely removes any previously running container with the same name. The script checks for the container's existence first to avoid errors on first-time deployments.

```groovy
stage('Stop Existing Container') {
    steps {
        sh '''
        if [ $(docker ps -a -q -f name=${CONTAINER_NAME}) ]; then
            docker rm -f ${CONTAINER_NAME}
        fi
        '''
    }
}
```

#### 5. `Run New Container`
Deploys the newly built image as a background container, mapping port `80` on the host. The `VITE_CONVEX_URL` secret is also passed as a runtime environment variable.

```groovy
stage('Run New Container') {
    steps {
        sh 'docker run -e VITE_CONVEX_URL=${VITE_CONVEX_URL} -d --name ${CONTAINER_NAME} -p 80:80 ${IMAGE_NAME}:${IMAGE_TAG}'
    }
}
```

---

### Secrets Management

Sensitive credentials are **never hard-coded** in the repository. Jenkins's built-in credential store is used:

| Secret ID | Used In | Purpose |
|---|---|---|
| `VITE_CONVEX_URL` | Jenkinsfile | Convex backend URL injected at build & runtime |
| `CONVEX_AWS_REGION` | Convex environment | AWS region for S3 |
| `CONVEX_AWS_ACCESS_KEY_ID` | Convex environment | AWS IAM access key |
| `CONVEX_AWS_SECRET_ACCESS_KEY` | Convex environment | AWS IAM secret key |
| `CONVEX_AWS_S3_BUCKET` | Convex environment | Target S3 bucket name |

The `VITE_CONVEX_URL` is retrieved via `credentials('VITE_CONVEX_URL')` in the Jenkinsfile environment block, ensuring it is masked in all console output.

---

## 🚦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [npm](https://npmjs.com/) v9+
- A [Convex](https://convex.dev/) account and project
- An [AWS](https://aws.amazon.com/) account with an S3 bucket and IAM credentials
- [Docker](https://www.docker.com/) (for containerized deployment)
- [Jenkins](https://www.jenkins.io/) (for CI/CD automation)

---

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Convex
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud

# These are set in the Convex dashboard environment variables:
# CONVEX_AWS_REGION=ap-south-1
# CONVEX_AWS_ACCESS_KEY_ID=AKIA...
# CONVEX_AWS_SECRET_ACCESS_KEY=...
# CONVEX_AWS_S3_BUCKET=your-bucket-name
```

> ⚠️ **Important:** `CONVEX_AWS_*` variables must be configured in your **Convex project's environment variable settings** (dashboard → Settings → Environment Variables), not in your local `.env` file. They are accessed by Convex server-side functions only.

---

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/SkyStore.git
cd SkyStore

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env .env.local
# Edit .env.local with your VITE_CONVEX_URL

# 4. Start the dev server (runs Vite + Convex backend in parallel)
npm run dev
```

The app will be available at `http://localhost:5173`.

The `dev` script runs three processes in parallel:
- `vite --open` — frontend dev server with HMR
- `convex dev` — Convex backend watcher (pushes schema/function changes)
- `node setup.mjs --once` — one-time setup tasks

---

### Docker Build & Run

```bash
# Build the production image
docker build \
  --build-arg VITE_CONVEX_URL=https://<your-deployment>.convex.cloud \
  -t SkyStore:latest .

# Run the container
docker run -d \
  --name SkyStore-container \
  -p 80:80 \
  SkyStore:latest

# App is now live at http://localhost
```

---

## 📁 Project Structure

```
SkyStore/
├── convex/                     # Convex backend (serverless functions + schema)
│   ├── auth.config.ts          # Auth provider configuration
│   ├── auth.ts                 # Auth mutation handlers
│   ├── files.ts                # File/folder CRUD + S3 operations
│   ├── http.ts                 # HTTP endpoint router
│   ├── router.ts               # Convex HTTP router
│   └── schema.ts               # Database schema definition
│
├── src/                        # React frontend source
│   ├── App.tsx                 # Main app component (layout + dashboard)
│   ├── SignInForm.tsx           # Authentication form
│   ├── SignOutButton.tsx        # Sign-out component
│   ├── index.css               # Global styles + Tailwind layers
│   ├── main.tsx                # React entry point
│   └── lib/                    # Shared utilities
│
├── Dockerfile                  # Multi-stage production Docker build
├── Jenkinsfile                 # Declarative CI/CD pipeline definition
├── .dockerignore               # Files excluded from Docker build context
├── .env                        # Default environment (VITE_CONVEX_URL)
├── .gitignore                  # Git exclusions
├── index.html                  # HTML entry point
├── package.json                # Dependencies and npm scripts
├── tailwind.config.js          # Tailwind CSS configuration + design tokens
├── tsconfig.json               # TypeScript root config
├── tsconfig.app.json           # Frontend TypeScript config
├── vite.config.ts              # Vite bundler configuration
└── setup.mjs                   # One-time dev setup script
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

<div align="center">

Built with ❤️ using **Convex**, **AWS S3**, **React**, **Docker**, and **Jenkins**

</div>
