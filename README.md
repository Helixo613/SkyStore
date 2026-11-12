# ☁️ iris-ops — Secure Cloud File Vault

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
  - [1. Install](#1-install)
  - [2. Create the Convex backend](#2-create-the-convex-backend)
  - [3. Create the S3 bucket and connect it to Convex](#3-create-the-s3-bucket-and-connect-it-to-convex)
  - [4. Set up sign-in and run the app](#4-set-up-sign-in-and-run-the-app)
  - [5. Build and run with Docker](#5-build-and-run-with-docker)
  - [6. Set up the Jenkins pipeline](#6-set-up-the-jenkins-pipeline)
  - [Day-to-day](#day-to-day)
  - [Shutting down and costs](#shutting-down-and-costs)
  - [Troubleshooting](#troubleshooting)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)

---

## 🔍 Overview

**iris-ops** is a minimalist, lightning-fast cloud storage platform that allows authenticated users to securely upload, organize, and access files from anywhere. Files are stored directly in **AWS S3** using pre-signed URLs, while metadata and user accounts are managed through **Convex**'s real-time backend.

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
Starts a **temporary container** on port `8081` and uses `curl` to verify the app is serving correctly by checking for the expected `<title>iris-ops</title>` tag in the HTML response. If the check fails, Docker logs are printed and the pipeline aborts.

```groovy
stage('Smoke Test') {
    steps {
        sh 'docker run --name temp-${CONTAINER_NAME} -d -p 8081:80 ${IMAGE_NAME}:${IMAGE_TAG}'
        sh 'sleep 5'
        sh 'curl -s http://localhost:8081 | grep -q "<title>iris-ops</title>" || (docker logs ... && exit 1)'
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
Deploys the newly built image as a background container, mapping port `80` on the host. No runtime variables are needed: the Convex URL was compiled into the bundle at build time.

```groovy
stage('Run New Container') {
    steps {
        sh 'docker run -d --restart unless-stopped --name ${CONTAINER_NAME} -p 80:80 ${IMAGE_NAME}:${IMAGE_TAG}'
    }
}
```

---

### Secrets Management

Sensitive credentials are **never hard-coded** in the repository. Jenkins's built-in credential store is used:

| Secret ID | Used In | Purpose |
|---|---|---|
| `VITE_CONVEX_URL` | Jenkinsfile | Convex backend URL compiled into the frontend at build time |
| `CONVEX_AWS_REGION` | Convex environment | AWS region for S3 |
| `CONVEX_AWS_ACCESS_KEY_ID` | Convex environment | AWS IAM access key |
| `CONVEX_AWS_SECRET_ACCESS_KEY` | Convex environment | AWS IAM secret key |
| `CONVEX_AWS_S3_BUCKET` | Convex environment | Target S3 bucket name |

The `VITE_CONVEX_URL` is retrieved via `credentials('VITE_CONVEX_URL')` in the Jenkinsfile environment block, ensuring it is masked in all console output.

---

## 🚦 Getting Started

This section takes you from a fresh clone to the full stack running: the app, the Convex backend, the S3 bucket and the Jenkins pipeline. Steps 1–4 are enough to use the app; steps 5–6 add the Docker and CI/CD parts.

### Prerequisites

| Tool | Needed for | Check |
|---|---|---|
| Node.js 18+ and npm 9+ | everything | `node -v` |
| A [Convex](https://convex.dev/) account (free tier is enough) | backend | `npx convex login` |
| AWS CLI v2, signed in to your account | S3 bucket setup | `aws sts get-caller-identity` |
| Docker | container build | `docker ps` |
| Jenkins with the Pipeline, Git and Credentials Binding plugins | CI/CD | open `http://localhost:8080` |

---

### 1. Install

```bash
git clone https://github.com/<your-username>/SkyStore.git
cd SkyStore
npm install
```

---

### 2. Create the Convex backend

```bash
npx convex login                 # one-time, opens the browser
npx convex dev --configure=new   # choose a cloud deployment, name it e.g. "skystore"
```

When it prints **Convex functions ready**, it has written `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` to `.env.local`. Leave this terminal running: it deploys every change you make in `convex/`.

> `.env.local` is gitignored. The committed `.env` points at the original author's deployment and is overridden by `.env.local`.

---

### 3. Create the S3 bucket and connect it to Convex

One script does all of it, and it's safe to run again:

```bash
./infra/setup.sh
```

It:

- creates a private bucket `skystore-<account-id>-aps1` in `ap-south-1` with public access blocked, default encryption, CORS for `http://localhost`, `:5173` and `:8081`, and a rule that clears unfinished uploads after a day
- creates an IAM user `skystore-app` that can only put, get and delete objects in that bucket
- creates an access key for that user and stores it, with the region and bucket name, as Convex environment variables (`CONVEX_AWS_*`). The secret goes straight from AWS to Convex and is never written to disk.

Optional: `BUDGET_EMAIL=you@example.com ./infra/setup.sh` also creates a $5/month AWS budget that emails you at 60%. An AWS budget only alerts; it does not stop spending.

**Permissions the AWS CLI user needs.** If you don't run this as an admin, attach this inline policy to your CLI user. It's scoped to `skystore-*` buckets and the one app user. Replace `<account-id>`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["s3:CreateBucket","s3:DeleteBucket","s3:ListBucket","s3:DeleteObject",
                 "s3:PutBucketCors","s3:PutEncryptionConfiguration",
                 "s3:PutBucketPublicAccessBlock","s3:PutLifecycleConfiguration"],
      "Resource": ["arn:aws:s3:::skystore-*","arn:aws:s3:::skystore-*/*"] },
    { "Effect": "Allow",
      "Action": ["iam:GetUser","iam:CreateUser","iam:DeleteUser","iam:PutUserPolicy",
                 "iam:DeleteUserPolicy","iam:CreateAccessKey","iam:ListAccessKeys","iam:DeleteAccessKey"],
      "Resource": "arn:aws:iam::<account-id>:user/skystore-app" }
  ]
}
```

To use a different region, change `REGION` at the top of `infra/setup.sh` and `infra/teardown.sh`.

---

### 4. Set up sign-in and run the app

Convex Auth needs a signing key pair (`JWT_PRIVATE_KEY`, `JWKS`) and a `SITE_URL`. Generate them once per deployment:

```bash
npx @convex-dev/auth          # accept the defaults; use http://localhost:5173 as the site URL
```

Then, in a second terminal:

```bash
npm run dev:frontend          # http://localhost:5173
```

Check it works: create an account (any email; no verification mail is sent), create a folder, upload a file, open it, then delete the folder.

`npx convex env list` should now show 7 variables: the 4 `CONVEX_AWS_*` values, `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL`.

> `npm run dev` starts the frontend, `convex dev` and `setup.mjs` (which runs the auth setup on first launch) all together. Running them separately, as above, makes errors easier to read.

---

### 5. Build and run with Docker

The Convex URL is compiled into the frontend, so pass it at build time:

```bash
docker build \
  --build-arg VITE_CONVEX_URL=$(grep '^VITE_CONVEX_URL=' .env.local | cut -d= -f2 | cut -d' ' -f1) \
  -t iris-ops:latest .

docker run -d --restart unless-stopped --name iris-ops-container -p 80:80 iris-ops:latest
# http://localhost
```

The container only serves static files. The backend is still your Convex deployment.

---

### 6. Set up the Jenkins pipeline

**a. Let Jenkins use Docker** (one-time):

```bash
sudo usermod -aG docker jenkins && sudo systemctl restart jenkins
```

**b. Add the credential.** In Jenkins, go to *Manage Jenkins → Credentials → System → Global → Add credentials*:

- Kind: **Secret text**
- ID: `VITE_CONVEX_URL`
- Secret: your `https://<name>.convex.cloud` URL from `.env.local`

**c. Create the job.** Go to *New Item → Pipeline* and name it `skystore`. Under *Pipeline*:

- Definition: **Pipeline script from SCM**
- SCM: **Git**, Repository URL: your fork's HTTPS URL, Branch: `*/main`
- Script Path: `Jenkinsfile`

**d. Run it once** with *Build Now*. The stages are checkout → Docker build → smoke test on port 8081 → remove the old container → run the new one on port 80.

After that first run, Jenkins checks the repository every 5 minutes (`pollSCM` in the `Jenkinsfile`) and rebuilds when there's a new commit. A Jenkins running on your own machine can't receive GitHub webhooks, which is why it polls.

---

### Day-to-day

| To… | Do this |
|---|---|
| Change backend code | keep `npx convex dev` running; it redeploys on save |
| Change frontend code | `npm run dev:frontend` for live reload |
| Deploy the container | push to your fork; Jenkins rebuilds within ~5 minutes |
| Rotate the AWS key | delete `CONVEX_AWS_ACCESS_KEY_ID` in the Convex dashboard, then rerun `./infra/setup.sh` |
| Switch Convex deployments | rerun steps 3 and 4 against the new deployment and update the Jenkins credential |

---

### Shutting down and costs

The running costs are S3 storage (about $0.025 per GB per month) and requests (fractions of a cent). Convex's free tier and a local Jenkins cost nothing.

To remove every AWS resource:

```bash
./infra/teardown.sh   # asks first, then deletes the bucket, all files in it, and the skystore-app user
```

Afterwards, remove the bootstrap policy from your CLI user if you added one.

---

### Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Upload fails with a CORS or "Failed to fetch" error | The page's address isn't in the bucket's CORS list. Add it in `infra/setup.sh` and rerun. |
| `Missing AWS configuration environment variables` in the Convex logs | Step 3 hasn't run against this deployment. Run `./infra/setup.sh`. |
| Sign-in fails right away | The auth keys are missing. Run `npx @convex-dev/auth` (step 4). |
| `setup.sh` reports `AccessDenied` | Your AWS CLI user lacks the permissions listed in step 3. |
| Jenkins: `permission denied ... docker.sock` | Jenkins isn't in the `docker` group. See step 6a. |
| Jenkins: `port is already allocated` | Something else is on port 80 or 8081. Stop it, e.g. `docker rm -f <old-container>`. |
| The container loads but shows no data | The image was built without `VITE_CONVEX_URL`, or with the wrong value. Check the Jenkins credential. |

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
├── infra/
│   ├── setup.sh                # Creates S3 bucket + scoped IAM user, sets Convex env vars
│   └── teardown.sh             # Deletes the bucket, its files and the IAM user
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
