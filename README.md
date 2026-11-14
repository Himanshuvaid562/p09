# Heard in Class, Lost After the class

**A faculty–student doubt-resolution platform.** Students ask academic questions with course context, the system triages and routes each one to the right faculty, and faculty answer, schedule office hours, or run **one Google Meet for every student who has the same doubt** and save the recording for everyone.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-47a248?logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ed?logo=docker&logoColor=white)

> Project **P09 – Heard in Class, Lost After** (Faculty–Student Communication).

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [MongoDB Atlas setup](#mongodb-atlas-setup)
- [Creating accounts](#creating-accounts)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [How triage works](#how-triage-works)
- [Group sessions and recordings](#group-sessions-and-recordings)
- [Authentication and security](#authentication-and-security)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)

## Features

| Module | What it does | Where |
|---|---|---|
| **1. Student Query Service** | Submit questions with course info, track status, see answers, Meet links and recordings. A shared **class doubt board** shows what classmates asked. | `/student` |
| **2. Faculty Response Service** | See queries ordered by priority, filter by status, answer, schedule a slot, or open a group session. | `/faculty` |
| **3. Triage & Appointment Service** | Auto-categorises each query, sets priority, routes it to the faculty of that course, and finds similar doubts. | `lib/triage.js` |

**Integration:** student query → triage and routing → faculty response, appointment or group session.

- **Login with roles:** separate student and faculty accounts, checked on the server for every page and every API call.
- **Self signup:** students register with their roll number and courses. Faculty can register with a secret invite code, or an administrator can create the account.
- **Class doubt board:** students see public doubts from the courses they are enrolled in, **anonymously**, and can tap **"I have this doubt too"** instead of posting a duplicate.
- **Private doubts:** questions can be marked private. Marks and attendance questions are always private.
- **Similar-doubt suggestions:** while a student types, matching doubts already on the board are suggested.
- **Group sessions:** faculty select students with the same doubt and create one Google Meet. Everyone who asked or tapped "me too" gets the link. The recording link is saved for everyone.
- **Optional AI matching:** with a local Ollama server, similar doubts are matched by *meaning*. Without it, the app falls back to keywords automatically.
- **MongoDB Atlas storage:** users, queries, sessions and cached embeddings live in the cloud database.

## Tech stack

- **Next.js 14.2** (App Router) and **React 18** — plain JavaScript, plain CSS
- **MongoDB Atlas** through the official `mongodb` Node.js driver
- **Node `crypto`** for password hashing (scrypt) and signed session cookies (HMAC)
- **Ollama** with `nomic-embed-text` for optional meaning-based matching
- **Docker / Docker Compose** and **Vercel** deployment support

## Quick start

### Prerequisites

| Tool | Needed for | Notes |
|---|---|---|
| **Node.js 20.19 or newer** and npm | running the app | required by the MongoDB driver |
| A **MongoDB Atlas** account | the database | free tier is enough |
| Docker + Docker Compose | optional | for container deployment |
| [Ollama](https://ollama.com) | optional | meaning-based matching |
| A Google account | creating Meet links | faculty only |

### Run locally

```bash
# 1. install dependencies
npm install

# 2. create your environment file
cp .env.example .env.local

# 3. edit .env.local: set MONGODB_URI and AUTH_SECRET (see below)

# 4. start the dev server
npm run dev
```

Open **http://localhost:3000**.

There are **no built-in demo accounts**. Students can create their own account at
**http://localhost:3000/signup**. Faculty accounts are created by an administrator
with the [user management script](#creating-accounts).

### npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | development server with hot reload |
| `npm run build` | production build |
| `npm start` | run the production build |
| `npm run users -- <command>` | create, list or remove accounts in MongoDB Atlas |

## MongoDB Atlas setup

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. **Database Access** → add a database user with a strong password.
3. **Network Access** → add an IP address:
   - For local development, add your own IP.
   - For Vercel or another cloud host, add `0.0.0.0/0` (or the provider's egress IPs).
4. **Connect** → **Drivers** → **Node.js** → copy the connection string. It looks like:

   ```text
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

5. Put the string in `.env.local` (local) or in your host's environment variables (production):

   ```bash
   MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB=heard_in_class
   AUTH_SECRET=<output of: openssl rand -hex 32>
   ```

The database and its indexes are created automatically on first use. The app does not need a local MongoDB server.

To use a local MongoDB instead, set `MONGODB_URI=mongodb://127.0.0.1:27017`.

## Creating accounts

Accounts are stored in the `users` collection in MongoDB.

### Students — self signup

Students open `/signup` and choose their name, roll number, password and the
courses they are enrolled in. The account is created immediately and the student
is logged in.

- A roll number can only be registered once.
- Students can only select courses that exist in `courseFaculty` (`lib/triage.js`).
- Passwords must be at least 8 characters and are hashed with scrypt before storage.
- Set `ALLOW_STUDENT_SIGNUP=false` to close public signup (the page then shows
  “Signup is closed” and the API refuses new accounts).

### Faculty — invite code or administrator

Faculty accounts can see student queries, so self-registration is protected by a
secret invite code:

1. Set a long random value in the environment:

   ```bash
   # generate one with: openssl rand -hex 16
   FACULTY_INVITE_CODE=your-secret-faculty-code
   ```

2. Restart the app. The signup page now shows a **Faculty** tab.
3. Faculty choose their name, a username, a password and enter the invite code.
   Their name must be one of the names in `courseFaculty` (`lib/triage.js`), so
   queries are routed to them correctly.

Leave `FACULTY_INVITE_CODE` unset to disable faculty self-registration.

An administrator can still create faculty accounts with the script:

```bash
# Faculty account (name must match courseFaculty in lib/triage.js)
npm run users -- add \
  --username sharma \
  --password "a-strong-password" \
  --role faculty \
  --name "Dr. Sharma"

# List accounts (never prints passwords)
npm run users -- list

# Remove an account and end its active sessions
npm run users -- remove --username 101

# Replace an existing account's details/password
npm run users -- add --username 101 --password "new-password" ... --update
```

The script can also create student accounts when you need to provision them in
bulk or reset a password:

```bash
npm run users -- add \
  --username 101 \
  --password "another-strong-password" \
  --role student \
  --name "Asha" \
  --roll 101 \
  --courses CSE310,CSE326
```

Important:

- A faculty account's `--name` must **exactly match** a name in `courseFaculty` in `lib/triage.js`, because queries are routed by name.
- A student only sees and posts to the courses listed on their account.
- There is no password-reset page yet. An administrator can reset a password with `npm run users -- add ... --update`.
- The script reads `MONGODB_URI` / `MONGODB_DB` from your shell or from `.env.local` / `.env`.

## Deployment

### Deployment checklist

Before going live, confirm all of these:

- [ ] `MONGODB_URI` is set in the host's environment (not only in `.env.local`).
- [ ] Atlas **Network Access** allows the host. Vercel/cloud hosts usually need `0.0.0.0/0` or the provider's egress IPs.
- [ ] `AUTH_SECRET` is a new random value: `openssl rand -hex 32`. Do not use the example value.
- [ ] `COOKIE_SECURE` is unset or `true` on an HTTPS deployment.
- [ ] `FACULTY_INVITE_CODE` is set if faculty should self-register; otherwise leave it unset.
- [ ] `ALLOW_STUDENT_SIGNUP` matches your policy (`true` or `false`).
- [ ] `npm run check:db` connects successfully to the same database the host will use.
- [ ] At least one faculty account exists (self-registered or created with `npm run users -- add`).
- [ ] After deploying, `/api/health` returns `{"ok":true}` and login/signup work.

### Vercel (recommended)

1. Push the repository to GitHub.
2. In Vercel, **Add New → Project**, import the repository. The framework is detected as Next.js; no build settings need changing.
3. Add these **Environment Variables** (Production and Preview):
   - `MONGODB_URI` — the Atlas connection string
   - `MONGODB_DB` — for example `heard_in_class`
   - `AUTH_SECRET` — a long random value (`openssl rand -hex 32`)
   - `COOKIE_SECURE` — `true` (or leave it unset; it defaults to `true` in production)
   - `ALLOW_STUDENT_SIGNUP` — `true` to allow student registration, or `false` to close it
   - `FACULTY_INVITE_CODE` — optional secret that enables faculty self-registration
4. Allow Vercel's traffic in Atlas **Network Access** (`0.0.0.0/0` is the simplest option).
5. Deploy, then create accounts with `npm run users -- add ...` from your machine. The script talks to the same Atlas database, so no redeploy is needed.

After deployment, `https://your-app.vercel.app/api/health` returns `{"ok":true}` when MongoDB is reachable.

### Docker / Docker Compose

```bash
cp .env.example .env       # fill in MONGODB_URI and AUTH_SECRET
docker compose up --build   # http://localhost:3000
```

The image uses Next.js standalone output and contains no local data volume:
everything is stored in MongoDB Atlas. The container has a health check against
`/api/health`.

Port `3004` variant: `docker compose -f docker-compose.port3004.yml up --build`.

### Any Node.js host

```bash
npm ci
npm run build
MONGODB_URI="..." AUTH_SECRET="..." NODE_ENV=production npm start
```

Use a Node.js 20.19+ runtime and supply the environment variables listed below.

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MONGODB_URI` | **yes** | — | MongoDB Atlas connection string |
| `MONGODB_DB` | no | `heard_in_class` | Database name inside the cluster |
| `AUTH_SECRET` | **yes in production** | dev fallback locally | Signs login cookies. Use a long random value. |
| `COOKIE_SECURE` | no | `true` in production | Set `false` only for plain-http local production runs. |
| `ALLOW_STUDENT_SIGNUP` | no | `true` | Set `false` to close public student registration at `/signup`. |
| `FACULTY_INVITE_CODE` | no | unset | Secret code that enables faculty self-registration at `/signup`. Leave unset to disable it. |
| `EMBED_URL` | no | `http://localhost:11434` | Where Ollama runs (Docker default: `host.docker.internal:11434`) |
| `EMBED_MODEL` | no | `nomic-embed-text` | Embedding model for meaning-based matching |
| `SIMILARITY_THRESHOLD` | no | `0.65` | 0 to 1, higher means stricter matching |
| `EMBED_TIMEOUT_SECONDS` | no | `8` | Wait time for Ollama before falling back to keywords |
| `EMBED_RETRY_SECONDS` | no | `30` | Cooldown after an Ollama failure |

Generate a good `AUTH_SECRET` with `openssl rand -hex 32`.

## How triage works

All rules are plain keyword checks in `lib/triage.js`. The first matching rule wins:

| Category | Matches words like |
|---|---|
| Exam / Marks | exam, marks, result, grade, paper |
| Assignment | assignment, submission, deadline, project |
| Attendance | attendance, leave, absent, medical |
| Meeting Request | meet, appointment, office hour, discuss |
| Concept Doubt | everything else |

- **High priority:** the text contains *urgent, today, tomorrow, asap* or *deadline*.
- **Routing:** the query goes to the faculty mapped to its course in `courseFaculty`.
- **Private automatically:** *Attendance* and *Exam / Marks* queries are never shown on the class board.

To change courses or teachers, edit `courseFaculty` in `lib/triage.js`.

## Group sessions and recordings

1. Faculty tick queries with the same doubt (or click **Select all similar**).
2. Click **Create Google Meet** to open `meet.google.com/new`, then paste the meeting link into the form and set a title and time.
3. Everyone who asked, plus everyone who tapped *"I have this doubt too"*, sees a **Join Google Meet** card. Anyone who taps "me too" after the session is created joins automatically.
4. Faculty start recording in Meet (**Activities → Recording**), then paste the Drive link into the session.
5. All students in the session can watch it, and their queries are marked **Answered**.

The Meet link and recording link are manual by design. Automatic creation would require a Google Cloud OAuth project, which this app does not include.

## Optional: meaning-based matching with Ollama

Without Ollama, similar doubts are found by shared keywords. With Ollama, they are matched by meaning.

```bash
ollama serve
ollama pull nomic-embed-text
```

Set `EMBED_URL` if Ollama is not on `http://localhost:11434`. When it is active, the
faculty page says *"Similar doubts are matched by meaning (AI)"* instead of *"keywords only"*.

In Docker, the container reaches the host through `host.docker.internal:11434`
(already configured in `docker-compose.yml`). On Linux, allow Ollama to listen on
all interfaces:

```bash
sudo systemctl edit ollama
# [Service]
# Environment="OLLAMA_HOST=0.0.0.0"
sudo systemctl restart ollama
```

Embeddings are cached in MongoDB, so each question is embedded once. If Ollama
stops, the app quietly switches back to keywords. Private questions are processed
by your own Ollama instance and are not sent to an outside AI service.

## Authentication and security

- **Protected signup.** `/signup` creates student accounts by default. Faculty can self-register only when `FACULTY_INVITE_CODE` is set and they know the code.
- **Every page checks the login on the server on every request.** Logged-out visitors are sent to `/login`. A student cannot open `/faculty`, and faculty cannot open `/student`.
- **Pages are not cached** (`force-dynamic`, `no-store`, router `staleTimes.dynamic = 0`), so the back button cannot show an old page after logout.
- **Sessions are stored in MongoDB** (`authSessions`). Logout deletes the session, so a copied cookie stops working. Sessions expire after 8 hours.
- **Open tabs stay in sync:** logging out in one tab sends the others to `/login`.
- **API routes re-check the role on every request.** Students only see their own queries. Faculty only see queries assigned to them and can only change their own sessions.
- **Passwords** are hashed with scrypt. After 5 wrong passwords an account is locked for 1 minute (per server instance).
- **Cookies** are `httpOnly` and `SameSite=Lax`; `Secure` is on in production by default.
- **Privacy on the class board:** other students never receive the asker's name or roll number, and private doubts are never sent to them.

## Project structure

```text
.
├── app/
│   ├── page.js                    # home page
│   ├── layout.js                  # navbar + login-state sync
│   ├── globals.css                # all styling
│   ├── login/                     # login page + form
│   ├── signup/                    # student registration page + form
│   ├── student/                   # student page + StudentView
│   ├── faculty/                   # faculty page + FacultyView
│   └── api/
│       ├── login/ signup/ logout/ me/  # authentication
│       ├── queries/               # submit, list, answer, "me too"
│       ├── board/                 # class doubt board + suggestions
│       ├── sessions/              # group sessions and recordings
│       └── health/                # MongoDB health check
├── components/
│   ├── Navbar.js
│   ├── LogoutButton.js
│   └── AuthSync.js
├── lib/
│   ├── mongodb.js                 # Atlas client + indexes
│   ├── db.js                      # collections / data access
│   ├── users.js                   # password hashing, enrolled courses
│   ├── auth.js                    # sessions, cookies, role checks
│   ├── token.js                   # signed cookie (also runs in middleware)
│   ├── triage.js                  # categories, priority, routing, similarity
│   ├── embeddings.js              # optional Ollama matching
│   └── board.js                   # what a student may see
├── scripts/users.mjs              # account management CLI
├── middleware.js                  # first check of the cookie signature
├── Dockerfile  docker-compose.yml  next.config.js
└── .env.example
```

### MongoDB collections

| Collection | Contents |
|---|---|
| `users` | accounts, hashed passwords, roles, enrolled courses |
| `queries` | doubts, answers, appointments, "me too" and session links |
| `sessions` | group sessions, Meet and recording links |
| `authSessions` | server-side login sessions |
| `embeddings` | cached question vectors (optional Ollama) |

## API reference

All routes need a login unless noted. "Student" and "faculty" mean the role is enforced.

| Method | Path | Who | Purpose |
|---|---|---|---|
| `POST` | `/api/signup` | anyone | Create a student account, or a faculty account with `FACULTY_INVITE_CODE` |
| `POST` | `/api/login` | anyone | Log in (`username`, `password`, `role`) |
| `POST` | `/api/logout` | logged in | End the session |
| `GET` | `/api/me` | logged in | Current user |
| `GET` | `/api/queries` | student / faculty | Student: own queries. Faculty: assigned queries |
| `POST` | `/api/queries` | student | Submit a query (triaged automatically) |
| `PATCH` | `/api/queries/:id` | faculty | Answer or schedule a slot (assigned faculty only) |
| `POST` | `/api/queries/:id/metoo` | student | Toggle "I have this doubt too" |
| `GET` | `/api/board` | student | Public doubts from the student's courses |
| `POST` | `/api/board/similar` | student | Similar doubts for the text being typed |
| `GET` | `/api/sessions` | student / faculty | Sessions the user is part of / owns |
| `POST` | `/api/sessions` | faculty | Create a group session from selected queries |
| `PATCH` | `/api/sessions/:id` | faculty | Save the recording link (session owner only) |
| `GET` | `/api/health` | anyone | App + MongoDB health check |

## Troubleshooting

| Problem | Fix |
|---|---|
| **`MONGODB_URI is not set`** | Add the Atlas connection string to `.env.local` locally, or to the host's environment variables in production. |
| **Server selection timeout / can't connect to Atlas** | Check the Atlas **Network Access** allowlist, the database user's password, and that the URI starts with `mongodb+srv://`. |
| **`AUTH_SECRET is not set` in production** | Add `AUTH_SECRET` (`openssl rand -hex 32`) to the environment. |
| **Login always says "Wrong username or password"** | Check that the account exists with `npm run users -- list`, or create one with `npm run users -- add ...`. Students can also use `/signup`. |
| **Signup says "An account with this roll number already exists"** | That roll number is already registered. Log in instead, or ask an administrator to update the account. |
| **The signup page says "Signup is closed"** | `ALLOW_STUDENT_SIGNUP` is `false` and `FACULTY_INVITE_CODE` is not set. Enable one of them. |
| **There is no Faculty tab on `/signup`** | `FACULTY_INVITE_CODE` is not set. Add it to the environment and restart the server. |
| **"Invalid faculty invite code"** | The code does not match `FACULTY_INVITE_CODE`. Check for extra spaces and restart after changing it. |
| **"A faculty account for ... already exists"** | That faculty name is already registered. Log in with the existing account, or remove it with `npm run users -- remove --username <old-username>`. |
| **A student sees an empty class board** | They only see courses they are enrolled in. Check `--courses` for that account. |
| **Faculty sees no queries** | The faculty account's `name` must exactly match the name in `courseFaculty` in `lib/triage.js` (for example `Dr. Sharma`). |
| **"Too many failed attempts"** | 5 wrong passwords lock that username for 1 minute. Wait, or restart the server. |
| **Logged out unexpectedly** | The session expired, `AUTH_SECRET` changed, or the `authSessions` collection was cleared. Log in again. |
| **Cookies not set in production** | Serve the site over HTTPS. If you must use plain HTTP, set `COOKIE_SECURE=false`. |
| **Port 3000 already in use** | `npm run dev -- -p 3001` (Docker: change the port mapping). |
| **Faculty page says "keywords only"** | Ollama is not reachable. This is optional; keyword matching still works. |
| **Docker cannot reach Ollama** | Ollama must listen on all interfaces (`OLLAMA_HOST=0.0.0.0`). |
| **Changes not showing after `docker compose`** | Run `docker compose up --build`. |

## Limitations

- **Signup depends on configuration; no password reset page.** Students can register at `/signup`. Faculty self-registration requires `FACULTY_INVITE_CODE`; otherwise an administrator creates faculty accounts with `npm run users -- add ...`. Password resets are done by an administrator.
- **Signup has no email verification.** Anyone with an unused roll number can register while student signup is open, and anyone with the invite code can create a faculty account. Set `ALLOW_STUDENT_SIGNUP=false` and leave `FACULTY_INVITE_CODE` unset if accounts must be provisioned by staff.
- **Login lockout is per server instance.** A multi-instance deployment does not share the failed-attempt counter.
- **Google Meet is manual:** the meeting link and the recording link are pasted by faculty.
- **No notifications:** students see updates when they open or refresh the app.
- **No automated test suite** is included yet.
- **Next.js 14.2 is end-of-life.** This project pins `14.2.35`, the last 14.x patch. `npm audit` still reports advisories that are fixed only in Next.js 15/16, mostly around DoS, the image optimizer and Server Actions — features this app does not use — but plan an upgrade before a large public deployment. Avoid `npm audit fix --force`, which jumps to an untested major version.
- **Before real use:** set a strong `AUTH_SECRET`, serve over HTTPS, restrict Atlas network access where possible, enable Atlas backups, and review who can run the account-management script.

## Purpose

To reduce communication gaps between students and faculty by providing a centralised, organised, and efficient doubt-resolution system.
