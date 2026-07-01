# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A customizable post-meeting feedback form for BigBlueButton (>= 3.0). Users are redirected here after leaving a BBB meeting (via `logoutURL`). It has two independently-deployed parts:

- `frontend/` — React 18 + Vite SPA, served under the `/feedback` base path.
- `backend/` — Express HTTP server (port 3009) that registers BBB webhooks, caches meeting/user data in Redis, and receives the submitted feedback.

`frontend` and `backend` are separate npm packages with their own `package.json`. There is no root package (the root `package-lock.json` is a stub). Run install/build/start commands from inside each directory.

## Commands

Frontend (`cd frontend`):
- `npm install`
- `npm start` — Vite dev server on port 3000
- `npm run build` — outputs static assets to `frontend/build/`
- `npm run preview` — serve the production build

Backend (`cd backend`):
- `npm install`
- `npm start` — `node server.js` on port 3009. **Requires a Redis server reachable on `localhost:6379`** (the client calls `createClient()` with defaults; the `REDIS_HOST` var in `docker-compose.yml` is **not** read) and the env vars below.

Full stack via Docker: `docker compose up -d` (see `docker-compose.yml` for the env block; edit values there).

There is no working test suite. `frontend`'s `test` script (`vite test`) and its `eslintConfig` (`react-app/jest`) are inert — no test files exist. Don't claim tests pass.

Verify frontend changes by hand: `cd frontend && npm run build`, then `npx vite preview --port 4173` and curl/Playwright `http://localhost:4173/feedback/…` (preview serves `build/` at base `/feedback/`).
Gotcha: `vite preview` **and** prod nginx SPA-fall-back any missing path — including backend-only routes like `/feedback/check` — to `index.html` (HTTP 200, `text/html`), so a fetch for an absent resource returns HTML, not 404. Content-type-guard JSON fetches accordingly.

## Backend architecture (`backend/server.js`)

Three endpoints, all under `/feedback`:

- `GET /feedback/check` — called by the frontend on load *before* rendering. Decides whether to show the form, force-skip it (returns `{ redirect }`), or proceed (`{ proceed: true }`, optionally with a `locale` override). Skips when the user's cached `ask_for_feedback === 'false'`, or when `reasonCode`/`errors` match the not-eligible lists in `utils.js` (`REASON_CODE_NOT_ELEGIBLE_FOR_FEEDBACK`, `ERROR_CODE_NOT_ELEGIBLE_FOR_FEEDBACK`).
- `POST /feedback/webhook` — the BBB webhook callback. Parses `meeting-created` and `user-joined` events and caches them in Redis (see keys below). Session/institution and user (name, role, redirect URL, `ask_for_feedback`, locale override) data is captured here, keyed by **internal** BBB IDs.
- `POST /feedback/submit` — receives the assembled feedback from the browser, merges it with the cached session/user data, and emits it.

Redis key scheme (prefix `feedback:`):
- `feedback:session:<internalMeetingId>` — hash of session/institution data. Expires by TTL only (never deleted on meeting-end, to avoid dropping in-flight feedback).
- `feedback:user:<internalUserId>` — hash of user data.
- `feedback:<sessionId>:<userId>` — the submitted feedback (dedup guard: a second submit for the same pair is rejected).

Key correlation depends on the browser's `meetingId`/`userId` URL params being the **internal** IDs that the webhook stored. `utils.js` tracks written keys in an in-memory `activeKeys` array and cleans them up per-user after submit (`redisStaleKeysCleanup`).

Locale overrides are the one piece of state kept **outside Redis**: `bbb_override_default_locale` from the `user-joined` webhook is stored in a module-level in-memory `usersLocales` map and read back in `/feedback/check`. It is therefore lost on restart and not shared across backend replicas.

Feedback output: a submission is only emitted **if it has a rating**. It is written to stdout as a `CUSTOM FEEDBACK LOG: <json>` line (intended to be scraped from syslog) and, if `FEEDBACK_URL` is set, POSTed there. An empty submission (no rating, no feedback) is treated as a skip and returns just the redirect URL.

Webhook registration (`createHook`/`destroyHook`) is gated by `REGISTER_HOOKS` and uses BBB's checksum-signed API (`Utils.checksumAPI`). If registration is enabled and fails, the process exits.

### Backend env vars

`SHARED_SECRET` and `BASIC_URL` are required (process exits otherwise). Others: `FEEDBACK_URL`, `REDIRECT_URL`, `REDIRECT_TIMEOUT` (default 10000), `PORT` (3009), `LOG_LEVEL` (info), `API_PATH` (`/bigbluebutton/api/`), `CALLBACK_PATH`, `HOOKS_CREATE`, `HOOKS_DESTROY`, `REGISTER_HOOKS`, `REDIS_HASH_KEYS_EXPIRATION_IN_SECONDS`. See `README.md` for descriptions.

## Frontend architecture

The form is a **data-driven step machine**. `frontend/src/feedbackData.json` defines every step and the transitions between them; the React components are generic renderers. To add or change questions/flow, edit `feedbackData.json` — usually no component changes are needed.

- Each non-rating step is `{ titleLabel, progress, options: [...] }`. Each option carries a `next` (the id of the following step), a `key`/`value` pair that lands in the feedback payload, and a `type` (`radio`, `textArea`, `email`). A `textArea` option's `key` captures free text for that step.
- The `rating` step maps each score (0–10) to its `next` step (low scores → `problem`, high → `like`).

`FeedbackFlow.jsx` is the orchestrator: it holds `currentStep` and a `feedback` ref, reads URL params, calls step components, and submits. **When you add a new step id to `feedbackData.json`, you must also add its `case` to the `switch` in `renderStep()`** — the switch enumerates step ids explicitly (this is the main place the data/code coupling leaks).

`frontend/src/index.jsx` is the entry point. It calls `/feedback/check` first (and honors a redirect/locale from it) before rendering. Locale is chosen from the `locale` URL param → `navigator.language` (or a `check.locale` override).

- **Locales are runtime-fetched static assets, not bundled.** The JSON files live in `frontend/public/locales/` (so Vite emits them unhashed to `build/locales/`, served at `/feedback/locales/<code>.json`). `index.jsx` fetches `en.json` as a base and overlays the resolved locale at runtime; the resolver normalizes `pt-BR`→`pt_BR`, falls back to a language default (`pt`→`pt_BR`, incl. `it`) then to `en`, and requires an `application/json` content-type so the SPA `index.html` fallback counts as "not found". This lets operators override translations on-disk at deploy time — the Docker entrypoint seeds locale files only when absent so overrides persist (delete a file to reseed the default). Do **not** re-add static `import … from './locales/…'` in `index.jsx`; that would re-bundle them.
- i18n uses **react-intl** (`IntlProvider`, `injectIntl`, `defineMessages`) — message ids look like `app.customFeedback.*`. `i18next`/`react-i18next` are in `package.json` but the code paths use react-intl; follow react-intl.
- Styling uses `styled-components`. Colors come from `frontend/src/ui/palette.js`, which uses CSS custom properties with hardcoded fallbacks (e.g. `var(--color-primary, #0F70D7)`) so a host page can theme the form.
- `service.js` holds all browser-side I/O: `submitFeedback`, device detection (`ua-parser-js`), `sessionStorage` persistence of in-progress feedback, and a `beforeunload` `sendBeacon` fallback so partial feedback is still sent if the user closes the tab.

URL params the frontend reads: `meetingId`, `userId`, `skipped`, `reason`, `errors` (JSON array), `locale`, `redirectUrl`, `redirectTimeout`.

Dev note: `vite.config.js` sets `base: '/feedback/'` and outputs to `build/`, but defines **no dev proxy**. The frontend fetches `/feedback/*` as same-origin relative URLs, so in `npm start` those calls hit the Vite server, not the backend — serve both behind one origin (or add a proxy) to exercise the API locally.

## Deployment model

`docker-compose.yml` defines only the `app` service with `network_mode: host` and bundles **no** Redis — the backend relies on a Redis already running on the host (as a BBB install provides).

Static assets are served by **nginx**, not Express (changed recently — the backend only serves the three API routes). The Docker image is multi-stage: it builds the frontend, and `docker-entrypoint.sh` copies the built assets into `/app/public-assets` (bind-mounted to `/usr/share/bigbluebutton/feedback`) on container start. nginx then serves `/feedback/*` static files and proxies only `/feedback/check`, `/feedback/submit`, `/feedback/webhook` to `localhost:3009`. The `feedback.nginx` snippet installs to `/usr/share/bigbluebutton/nginx/` (BBB's include dir — **not** `/etc/bigbluebutton/nginx/`). See the nginx snippet and bbb-web `logoutURL` setup in `README.md`.

## Conventions

Follow `COMMIT_LOGS.md` (repo root) for commit messages: Conventional Commits (`feat:`, `fix:`, `build(scope):`, `chore:`), body lines capped at 72 chars, present-tense/imperative, and **one commit per logical change**. Version bumps land as standalone commits titled with the bare version (e.g. `1.11.0`); keep `frontend/package.json`, `backend/package.json`, and `CHANGELOG.md` versions in sync when bumping.

Note the tree contains stale editor backup files (`*~`) that are not part of the project — ignore them.
