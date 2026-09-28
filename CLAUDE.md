# rabbit-viewer

Web viewer/diagnostic tool for RabbitMQ: detects stuck queues (messages with no active consumers), inspects/peeks messages in FIFO order, and supports safe ack/purge operations. Client-only credential storage — the backend is a stateless proxy that never persists RabbitMQ credentials.

## Commands

Root is an npm workspaces monorepo (`server`, `client`).

- Install: `npm install` (from repo root)
- Dev (both, concurrently): `npm run dev`
- Dev server only: `npm run dev:server` (tsx watch, port 3001)
- Dev client only: `npm run dev:client` (Vite, port 5173, proxies to backend)
- Build both: `npm run build`
- Production start (after build): `npm start` — serves the built client from the Express server on port 3001
- Lint (client only — server has no lint script): `npm run lint --workspace=client` (oxlint)
- No test suite exists in either workspace.

## Architecture

- **`server/`** — Node.js + Express + TypeScript. A thin, stateless proxy in front of the RabbitMQ Management HTTP API (default port 15672).
  - [server/src/index.ts](server/src/index.ts) — all `/api/*` routes, defined inline as `app.get/post/delete(...)` handlers. Also serves the built client (`client/dist`) as static files with an SPA fallback.
  - [server/src/proxy.ts](server/src/proxy.ts) — `extractBrokerConfig` (reads `x-rmq-*` headers into a `BrokerConfig`), `encodeVhost`, and `forwardToRabbitMQ` (does the actual authenticated fetch to the RabbitMQ Management API, with timeout handling and RabbitMQ-specific error message translation).
  - No database, no server-side session/auth state. Every request carries broker connection details in `x-rmq-host` / `x-rmq-port` / `x-rmq-proto` / `x-rmq-user` / `x-rmq-pass` / `x-rmq-vhost` headers via the `requireBrokerConfig` middleware.
- **`client/`** — React 19 + Vite + TypeScript + Tailwind CSS + lucide-react icons.
  - [client/src/services/api.ts](client/src/services/api.ts) — all backend calls; each function builds `x-rmq-*` headers from a `ConnectionProfile` and calls `handleResponse<T>` to unwrap/throw on error.
  - [client/src/services/storage.ts](client/src/services/storage.ts) — persists `ConnectionProfile`s to `localStorage` (never sent anywhere but this proxy).
  - [client/src/components/](client/src/components) — `ConnectionModal`, `ConfirmModal`, `Navbar`, `QueuesList`, `QueueDetail`, `JsonViewer`.
  - [client/src/types/rabbitmq.ts](client/src/types/rabbitmq.ts) — shared domain types (`ConnectionProfile`, `QueueItem`, `QueueMessage`, `OverviewData`, `VhostItem`).

## Conventions

- TypeScript throughout both workspaces; ESM (`type: module` in client; server uses `.js` extensions in relative imports per NodeNext resolution).
- Server route handlers stay inline in `index.ts` rather than split into separate router/controller files — keep new endpoints consistent with that pattern unless the file grows unwieldy.
- Destructive/irreversible RabbitMQ operations (purge, non-requeueing ack) require an explicit `ackmode` or confirmation step; default behavior favors non-destructive reads (`ack_requeue_true`).
- Client never talks to RabbitMQ directly — always through the `/api/*` proxy, with credentials passed per-request via headers, never stored server-side.

## AI development pipeline

For a full requirement (not a one-line change or exploration), use the `dev-pipeline` skill (`.claude/skills/dev-pipeline/SKILL.md`): it runs researcher → planner → implementer → validation (`npm run lint --workspace=client && npm run build`) → reviewer → fixer, stopping to ask for a human decision on ambiguity, architecture changes, or after 2 failed review iterations. The five roles are defined in `.claude/agents/`.

If the work item lives in Taiga instead of being described inline, use the `taiga-pipeline` skill (`.claude/skills/taiga-pipeline/SKILL.md`) instead: it pulls the story/task/issue with the `taiga` subagent, gathers codebase context with `researcher`, persists both under `.claude/tasks/` (mirrored to Obsidian if configured), and then hands off to `dev-pipeline` from the planning step onward. Requires `USERNAME_TAIGA`/`PASSWORD_TAIGA`/`TAIGA_URL` in `.env`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
