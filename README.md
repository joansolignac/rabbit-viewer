<p align="center">
  <img src="client/public/rabbitmq-logo-badge.svg" alt="Rabbit Viewer logo (RabbitMQ)" width="96" height="96" />
</p>

<h1 align="center">Rabbit Viewer</h1>

<p align="center">
  <strong>A modern, minimal, high-precision web console for RabbitMQ.</strong><br />
  Detect stuck queues, inspect messages FIFO-style, and safely ack or purge them — without leaking your broker credentials.
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
  <img alt="Node.js >= 20.19" src="https://img.shields.io/badge/node-%3E%3D20.19-brightgreen.svg" />
  <img alt="RabbitMQ" src="https://img.shields.io/badge/RabbitMQ-3.x-ea580c.svg" />
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-blue.svg" />
</p>

---

## Table of contents

- [What is Rabbit Viewer?](#what-is-rabbit-viewer)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Getting started (step by step)](#getting-started-step-by-step)
  - [1. Install Node.js](#1-install-nodejs)
  - [2. Get the code](#2-get-the-code)
  - [3. Install dependencies](#3-install-dependencies)
  - [4. Have a RabbitMQ broker ready](#4-have-a-rabbitmq-broker-ready)
  - [5. Run in development mode](#5-run-in-development-mode)
  - [6. Open the app and add a connection](#6-open-the-app-and-add-a-connection)
  - [7. Build and run for production](#7-build-and-run-for-production)
- [Available scripts](#available-scripts)
- [Configuration](#configuration)
- [Backend API](#backend-api)
- [Project structure](#project-structure)
- [Security and privacy](#security-and-privacy)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Trademark notice](#trademark-notice)

---

## What is Rabbit Viewer?

Rabbit Viewer is a **free and open-source** web interface for [RabbitMQ](https://www.rabbitmq.com/) designed for
**visualizing, diagnosing, and inspecting messages stuck in queues**.

It focuses on a problem that the stock Management UI makes tedious: a queue has messages, but no consumer is
draining them. Rabbit Viewer makes that state obvious, lets you peek at the exact head of the queue, and lets you
clear it safely when you decide to.

The design language is dark, monospaced, and technical. Multiple broker profiles can be configured side by side
(for example *Local Docker*, *Staging Cluster*, *Prod Workers*), and credentials never leave your browser except
as per-request headers to the local proxy.

## Features

1. **Multi-instance connection manager (brokers)**
   - Configure multiple connection profiles (host, port, protocol, user, password, vhost).
   - Credentials are stored **100% client-side** in the browser `localStorage` and travel to the proxy via headers
     on each request. Nothing is ever persisted on the server.
   - Real-time connectivity check (**Test Connection**) that reports the RabbitMQ version, Erlang version, and
     cluster name.
   - Export and import profiles as JSON for easy backup or sharing between machines.
2. **Instant stuck-queue detection**
   - Automatic visual alert when a queue has ready messages (`messages_ready > 0`) but **no active consumers**
     (`consumers === 0`).
   - Pulsing alert badge: `[ ⚠ STUCK: NO ACTIVE CONSUMERS ]`.
   - Quick filter to isolate queues with orphaned messages at a glance.
3. **FIFO pipeline message viewer**
   - Queue rendered as an assembly line: up to **5 head slots**, a single collapsed **`+N` overflow chip**, then
     the **last 2 messages** — e.g. `#1 #2 #3 #4 #5 [+14] #20 #21` for a 21-message queue. The `+N` chip absorbs
     everything that is not rendered, including messages that have not been peeked yet, so there is never a second
     overflow counter on screen.
   - Per-message payload with JSON syntax highlighting, raw/formatted toggle, and one-click copy.
   - Redelivery indicator: `[ ⚠ REDELIVERED ]`.
   - Routing key, exchange, delivery mode, byte size, `correlation_id`, and `reply_to` (invaluable for debugging
     stuck RPC calls and microservices).
   - Expandable table of custom headers.
4. **Safe and destructive operations behind confirmation**
   - **Peek messages** using `ackmode: "ack_requeue_true"` to inspect exact contents **without consuming them**.
   - **Ack / drop head message** to consume and delete the front message after explicit confirmation.
   - **Purge entire queue** behind a typed `PURGE` confirmation.
5. **Configurable auto-refresh**
   - Real-time refresh intervals (off, 3s, 5s, 10s, 30s) for both the queue list and individual queue metrics.
6. **Minimal, high-contrast UI**
   - Monospaced technical typography (JetBrains Mono / Inter).
   - Clean frames, bracket-style status badges, high-contrast dark background (`#08090d`).
   - Built-in accent color selector (Solar Amber, Acid Emerald, Cyber Cyan, Electric Violet).

## Tech stack

| Layer     | Technology                                                                 |
| :-------- | :------------------------------------------------------------------------- |
| Frontend  | React 19, Vite, TypeScript, Tailwind CSS, lucide-react                     |
| Backend   | Node.js, Express, TypeScript (a stateless proxy in front of the RabbitMQ Management HTTP API) |
| Storage   | Browser `localStorage` only (no database, no server-side sessions)         |
| Tooling   | npm workspaces, Oxlint, TypeScript compiler                                |

## Architecture

```
┌────────────────────────┐        x-rmq-* headers        ┌────────────────────────┐
│  Browser (React SPA)   │ ────────────────────────────▶ │  Express proxy (:3001) │
│  client/  (:5173 dev)  │ ◀──────────────────────────── │  server/               │
└────────────────────────┘        JSON responses         └───────────┬────────────┘
                                                                    │  HTTP + basic auth
                                                                    ▼
                                                      ┌────────────────────────────┐
                                                      │ RabbitMQ Management API     │
                                                      │ http(s)://host:15672        │
                                                      └────────────────────────────┘
```

- **`client/`** — React single-page app. Talks **only** to the local proxy (`/api/*`). Credentials are read from
  `localStorage` and attached to every request as `x-rmq-*` headers.
- **`server/`** — A thin, **stateless** Express proxy. It reads the `x-rmq-*` headers, forwards the request to the
  RabbitMQ Management HTTP API, and normalizes errors. It also serves the built client in production.

There is **no database** and **no server-side auth/session state**. Every request is self-contained.

## Prerequisites

Before you start, make sure you have:

- **Node.js 20.19+ or 22.12+** (an LTS release is recommended; verified with Node.js 24) and **npm** (bundled
  with Node.js).
- **A RabbitMQ broker** with the **Management plugin** enabled, reachable from the machine running the backend.
  The Management API listens on port **15672** by default.
- (Optional) **Docker**, if you want to spin up a throwaway RabbitMQ broker for testing.

> Using the default `guest` / `guest` credentials only works when connecting to `localhost`. For any remote or
> non-local broker you must create a dedicated user with the appropriate permissions/tags.

## Getting started (step by step)

### 1. Install Node.js

Install Node.js 20.19+ (or 22.12+) from <https://nodejs.org/> — an LTS release is recommended. Verify the
installation:

```bash
node --version   # should print v20.19.x, v22.12.x or newer, e.g. v24.x
npm --version    # should print the bundled npm version
```

### 2. Get the code

Clone the repository and enter it:

```bash
git clone <your-repository-url> rabbit-viewer
cd rabbit-viewer
```

> Replace `<your-repository-url>` with the URL of this repository.

### 3. Install dependencies

This is an npm **workspaces** monorepo (`server` and `client`), so a single install from the root is enough:

```bash
npm install
```

This installs the dependencies for both workspaces and creates a single root `node_modules`.

### 4. Have a RabbitMQ broker ready

If you already have a RabbitMQ broker with the Management plugin, skip to the next step. Otherwise you can start a
throwaway one with Docker:

```bash
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management
```

- AMQP port: `5672`
- Admin/Management UI and API: <http://localhost:15672> (`guest` / `guest`)

Wait a few seconds for it to boot, then confirm the Management API responds:

```bash
curl -u guest:guest http://localhost:15672/api/overview
```

### 5. Run in development mode

Start the backend proxy and the Vite dev server together, with hot reload on both:

```bash
npm run dev
```

You should see output similar to:

```
[server] [rabbit-viewer-proxy] Server listening on http://localhost:3001
[client]   VITE v8.x  ready in XXX ms
[client]   ➜  Local:   http://localhost:5173/
```

- Frontend (Vite): <http://localhost:5173>
- Backend proxy (Express): <http://localhost:3001>

The Vite dev server automatically proxies `/api/*` calls to the backend, so you only ever open the frontend URL in
development.

If you prefer to run the two processes separately, use:

```bash
npm run dev:server   # backend only, on :3001
npm run dev:client   # frontend only, on :5173
```

### 6. Open the app and add a connection

1. Open <http://localhost:5173> in your browser.
2. Click the connection manager (the broker profile switcher in the top-right, or **Add Broker**).
3. Fill in the form:
   - **Profile name** — any label, e.g. `Local Docker`.
   - **Protocol** — `http` or `https`.
   - **Host / IP** — e.g. `localhost` or `127.0.0.1`.
   - **Port** — `15672` for the Management API.
   - **Username / Password** — `guest` / `guest` for a local default broker.
   - **Virtual host (vhost)** — `/` by default.
4. Click **Test Connection** to verify. A success notice shows the RabbitMQ version, Erlang version, and cluster.
5. Click **Save & Connect**. The modal closes and the app loads the vhosts and queues.
6. Use the queue list to spot stuck queues, and click a queue to inspect its messages.

### 7. Build and run for production

Compile both workspaces (TypeScript + Vite build) and then start the unified server:

```bash
npm run build
npm start
```

- `npm run build` compiles the server to `server/dist` and the client to `client/dist`.
- `npm start` runs `node server/dist/index.js`, which serves the **built client** and the API together.

Then open <http://localhost:3001>.

> The production server serves `client/dist`. If you change the frontend, re-run `npm run build` before `npm start`,
> otherwise you will keep seeing the previous bundle.

To change the server port, set the `PORT` environment variable, e.g. `PORT=8080 npm start`.

## Available scripts

Run these from the repository root.

| Command                        | Description                                                             |
| :----------------------------- | :---------------------------------------------------------------------- |
| `npm install`                  | Install dependencies for both workspaces.                               |
| `npm run dev`                  | Run backend + frontend concurrently (recommended for development).      |
| `npm run dev:server`           | Run only the backend proxy (`tsx watch`, port 3001).                    |
| `npm run dev:client`           | Run only the frontend (Vite, port 5173, proxies to the backend).        |
| `npm run build`                | Build both workspaces (`server/dist` + `client/dist`).                  |
| `npm start`                    | Run the production server (build first).                                |
| `npm run lint --workspace=client` | Lint the client with Oxlint.                                         |

## Configuration

Rabbit Viewer needs **no configuration files and no environment variables** for normal use. All broker settings
are entered in the UI and stored in your browser. The proxy only uses:

- `PORT` — optional; the port the Express server listens on (default `3001`).

Each API request carries the broker configuration in headers:

| Header         | Description                          |
| :------------- | :----------------------------------- |
| `x-rmq-host`   | Broker hostname or IP.               |
| `x-rmq-port`   | Management API port (usually 15672). |
| `x-rmq-proto`  | `http` or `https`.                   |
| `x-rmq-user`   | Username.                            |
| `x-rmq-pass`   | Password.                            |
| `x-rmq-vhost`  | Default virtual host.                |

## Backend API

The Express proxy exposes the following routes. All of them (except `/api/health`) require the `x-rmq-*` headers.

| Method   | Endpoint                                  | Description                                                                 |
| :------- | :---------------------------------------- | :-------------------------------------------------------------------------- |
| `GET`    | `/api/health`                             | Proxy health check.                                                         |
| `POST`   | `/api/test-connection`                    | Verify credentials/reachability via `/whoami` and `/overview`.              |
| `GET`    | `/api/overview`                           | General broker metrics.                                                     |
| `GET`    | `/api/vhosts`                             | List available virtual hosts.                                               |
| `GET`    | `/api/queues?vhost=/`                     | List queues for the given vhost.                                            |
| `GET`    | `/api/queues/:vhost/:queue`               | Details and metrics for a single queue.                                     |
| `POST`   | `/api/queues/:vhost/:queue/messages`      | Peek or consume messages (`ack_requeue_true` or `ack_requeue_false`).       |
| `DELETE` | `/api/queues/:vhost/:queue/contents`      | Purge all messages from a queue.                                            |

## Project structure

```
rabbit-viewer/
├─ client/                     # React + Vite frontend
│  ├─ public/
│  │  ├─ rabbitmq-logo.svg          # Monochrome RabbitMQ mark
│  │  └─ rabbitmq-logo-badge.svg    # White/black badge used as favicon and in the README
│  └─ src/
│     ├─ components/           # ConnectionModal, ConfirmModal, Navbar, QueuesList, QueueDetail, ...
│     ├─ services/             # api.ts (backend calls), storage.ts (localStorage profiles)
│     ├─ types/                # Shared domain types
│     └─ App.tsx               # Application shell
├─ server/                     # Node + Express + TypeScript proxy
│  └─ src/
│     ├─ index.ts              # API routes + static serving of the built client
│     └─ proxy.ts              # Header parsing, vhost encoding, forwarding to RabbitMQ
├─ LICENSE                     # MIT license
├─ README.md                   # This file
└─ package.json                # Workspace root (scripts, workspaces)
```

## Security and privacy

- Rabbit Viewer **has no database** and does **not persist credentials to disk**.
- Credentials are stored in your browser's `localStorage` and are sent from the browser to the proxy only as
  request headers (`x-rmq-*`).
- The proxy is **stateless**: it forwards the request and forgets everything afterwards.
- Because of this model, only run the proxy on a machine/network you trust, and always use HTTPS when the browser
  and the broker are not on the same trusted network.
- Destructive operations (purge, non-requeueing ack) always require explicit confirmation.

## Troubleshooting

| Symptom | Likely cause / fix |
| :------ | :----------------- |
| `Connection refused at <host>:<port>` | RabbitMQ is not running, or the Management plugin/port is wrong (default `15672`). |
| `Connection timed out` | A firewall/network blocks access to the Management port from the backend host. |
| `401` / authentication error | Wrong username/password, or `guest` used against a non-local broker. |
| Changes do not appear in production | You forgot to rebuild: run `npm run build` and restart `npm start`. |
| Port already in use | Stop the other process or start with a different `PORT` (e.g. `PORT=8080 npm start`). |

## Contributing

Contributions are welcome! This project is free and open source.

1. Fork the repository and create a feature branch.
2. Keep the code style consistent (TypeScript throughout, ESM).
3. Run the checks before opening a pull request:

   ```bash
   npm run lint --workspace=client
   npm run build
   ```

4. Open a pull request describing the change and the motivation.

For larger changes, please open an issue first so we can discuss the approach.

## License

Released under the **MIT License** — see [LICENSE](LICENSE). You are free to use, modify, and distribute this
project, commercially or otherwise, as long as the license notice is preserved.

## Trademark notice

RabbitMQ is a trademark of its respective owner. The RabbitMQ logo used in this project is the monochrome mark
from [Simple Icons](https://simpleicons.org/) (CC0) and is used solely to identify the software this tool
interoperates with. Rabbit Viewer is an independent project and is **not** affiliated with or endorsed by the
RabbitMQ project.
