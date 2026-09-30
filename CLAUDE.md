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
Gotcha: outside a real BBB+nginx install, nothing calls bbb-web's `checkAuthorization`, so hitting `backend/server.js` directly for `/feedback/check`/`/feedback/submit` (e.g. via `npm start` or a bare curl) 401s unless you set `User-Id`/`Meeting-Id` headers by hand — that's the only way to exercise those two routes' logic in isolation now.

## Backend architecture (`backend/server.js`)

Three endpoints, all under `/feedback`:

- `GET /feedback/check` — called by the frontend on load *before* rendering. Decides whether to show the form, force-skip it (returns `{ redirect }`), or proceed (`{ proceed: true }`, optionally with a `locale` override). Skips when the user's cached `ask_for_feedback === 'false'`, or when `reasonCode`/`errors` match the not-eligible lists in `utils.js` (`REASON_CODE_NOT_ELEGIBLE_FOR_FEEDBACK`, `ERROR_CODE_NOT_ELEGIBLE_FOR_FEEDBACK`).
- `POST /feedback/webhook` — the BBB webhook callback. Parses `meeting-created` and `user-joined` events and caches them in Redis (see keys below). Session/institution and user (name, role, redirect URL, `ask_for_feedback`, locale override) data is captured here, keyed by **internal** BBB IDs.
- `POST /feedback/submit` — receives the assembled feedback from the browser, merges it with the cached session/user data, and emits it.

### Identity: `User-Id`/`Meeting-Id` headers, not client input

`GET /feedback/check` and `POST /feedback/submit` never trust a client-supplied
`userId`/`meetingId` (query param or body field) for identity. `feedback.nginx`
puts both locations behind an `auth_request` to bbb-web's
`/bigbluebutton/connection/checkAuthorization` — the same mechanism
bbb-webrtc-sfu and BBB's other internal services (shared-notes, file-upload,
sip) already rely on. nginx only forwards the request once bbb-web has
validated the caller's `sessionToken` (read off the request URI's query
string, plus the bbb-web session cookie unless the meeting opts out), and
injects the verified `User-Id`/`Meeting-Id` as headers. `Utils.getVerifiedIdentity(req)`
is the single place that reads them; both routes 401 if either header is
missing (e.g. the request bypassed nginx, or `auth_request` isn't configured).
The frontend gets the `sessionToken` for free: BBB's html5 client already
writes it to `sessionStorage` (`BBB_sessionToken`) before redirecting here, and
that storage survives the same-origin logout redirect — `getSessionToken()`/
`withSessionToken()` in `frontend/src/components/service.js` read it back and
attach it as a query param on every call to `/feedback/check`/`/feedback/submit`.
`POST /feedback/webhook` is unaffected — it's a server-to-server bbb-web
callback with no browser session involved.

Redis key scheme (prefix `feedback:`):
- `feedback:session:<internalMeetingId>` — hash of session/institution data. Expires by TTL only (never deleted on meeting-end, to avoid dropping in-flight feedback).
- `feedback:user:<internalUserId>` — hash of user data.
- `feedback:<sessionId>:<userId>` — the submitted feedback (dedup guard: a second submit for the same pair is rejected).

Key correlation depends on the verified `User-Id`/`Meeting-Id` headers (see above) being the **internal** IDs that the webhook stored — which they are, since bbb-web's `checkAuthorization` reports its own internal ids. `utils.js` tracks written keys in an in-memory `activeKeys` array and cleans them up per-user after submit (`redisStaleKeysCleanup`).

Locale overrides are the one piece of state kept **outside Redis**: `bbb_override_default_locale` from the `user-joined` webhook is stored in a module-level in-memory `usersLocales` map and read back in `/feedback/check`. It is therefore lost on restart and not shared across backend replicas.

Feedback output: a submission is only emitted **if it has a rating**. It is written to stdout as a `CUSTOM FEEDBACK LOG: <json>` line (intended to be scraped from syslog) and, if `FEEDBACK_URL` is set, POSTed there. An empty submission (no rating, no feedback) is treated as a skip and returns just the redirect URL.

Webhook registration (`createHook`/`destroyHook`) is gated by `REGISTER_HOOKS` and uses BBB's checksum-signed API (`Utils.checksumAPI`). If registration is enabled and fails, the process exits.

### Backend env vars

`SHARED_SECRET` and `BASIC_URL` are required (process exits otherwise). Others: `FEEDBACK_URL`, `REDIRECT_URL`, `REDIRECT_TIMEOUT` (default 10000), `PORT` (3009), `LOG_LEVEL` (info), `API_PATH` (`/bigbluebutton/api/`), `CALLBACK_PATH`, `HOOKS_CREATE`, `HOOKS_DESTROY`, `REGISTER_HOOKS`, `REDIS_HASH_KEYS_EXPIRATION_IN_SECONDS`. See `README.md` for descriptions.

## Frontend architecture

The form is a **data-driven step machine**. `frontend/public/feedbackData.json` defines every step and the transitions between them; the React components are generic renderers. To add or change questions/flow, edit `feedbackData.json` — usually no component changes are needed.

- Every step declares a **step `type`** that picks its renderer: `rating` (star scale), `options` (radios and/or a free-text area), `email`. Step *ids* are arbitrary data.
- Each `options`/`email` step is `{ type, titleLabel?, progress, options: [...] }`. Each option carries a `next` (the id of the following step), a `key`/`value` pair that lands in the feedback payload, and an option `type` (`radio`, `textArea`, `email`). A `textArea` option's `key` captures free text for that step; the radio option whose `value` is `other` is what pairs with it (`FREE_TEXT_VALUE` in `ProblemStep.jsx`). Typing free text counts as picking that radio — it records `other` under the radio's `key` and follows the radio's `next` — unless the `textArea` carries its own `next`, which wins. An `email` step's option `key` is decorative: `EmailStep` always reports `email`, which `updateFeedback` files under `user.email`. `rating` and `email` are reserved key names — `updateFeedback` branches on them, so a step recording an answer under either corrupts the payload.
- A `rating` step maps each score to its `next` step (low scores → `problem`, high → `like`); the number of stars is the **highest numeric key**, so the scale is data too. Lookup is by exact score: a score with no entry of its own ends the form.
- Top-level `initialStep` names the first step (defaults to `rating`). `confirmation` is a reserved id for the terminal step, and `renderStep` skips the definition for it so a step of that id can't take over the end of the flow.
- Labels are `{ id, defaultMessage? }` objects passed straight to `intl.formatMessage`, so a custom option can carry its own `defaultMessage` instead of requiring a locale key. Every id in the shipped form must exist in all four locale files — `frontend/src/` has no fallback for a missing key beyond the raw id showing up on screen.

- **The form definition is a runtime-fetched static asset, not bundled** — same pattern and rationale as the locales below. It lives in `frontend/public/` (Vite emits it unhashed to `build/feedbackData.json`, served at `/feedback/feedbackData.json`); `frontend/src/feedbackData.js` fetches it (content-type-guarded, and it rejects a definition with no initial step) and hands it to the tree through `FeedbackDataContext`, so components read it with `useFeedbackData()`. Do **not** re-add `import feedbackData from './feedbackData.json'`; that would re-bundle it. A missing/malformed file degrades to the built-in `FALLBACK_FEEDBACK_DATA` — the rating step alone, so a broken override still submits a rating — rather than dropping the form.

Because the definition is edited on the host, the renderers treat it as untrusted: labels go through `formatLabel` (react-intl throws on a descriptor with no `id`) and an `ErrorBoundary` around `FeedbackFlow` closes the flow on the confirmation screen so the redirect still happens whatever the data does.

`FeedbackFlow.jsx` is the orchestrator: it holds `currentStep` and a `feedback` ref, reads URL params, renders the step whose `type` maps to a component in its `STEP_COMPONENTS` registry, and submits. **Step ids are never enumerated in code** — adding, renaming or removing steps is a `feedbackData.json` edit alone. Only a genuinely new *step type* (a new kind of input) needs a new `STEP_COMPONENTS` entry, and step components must stay generic: they receive `stepId`/`stepData` and read everything (labels, placeholders, `next`, scale) from the data. An unknown/absent step type ends the flow at the confirmation and logs an error rather than rendering nothing.

`frontend/src/index.jsx` is the entry point. It calls `/feedback/check` first (and honors a redirect/locale from it) before rendering. Locale is chosen from the `locale` URL param → `navigator.language` (or a `check.locale` override).

- **Locales are runtime-fetched static assets, not bundled.** The JSON files live in `frontend/public/locales/` (so Vite emits them unhashed to `build/locales/`, served at `/feedback/locales/<code>.json`). `index.jsx` fetches `en.json` as a base and overlays the resolved locale at runtime; the resolver normalizes `pt-BR`→`pt_BR`, falls back to a language default (`pt`→`pt_BR`, incl. `it`) then to `en`, and requires an `application/json` content-type so the SPA `index.html` fallback counts as "not found". This lets operators override translations on-disk at deploy time — the Docker entrypoint seeds locale files only when absent so overrides persist (delete a file to reseed the default). Do **not** re-add static `import … from './locales/…'` in `index.jsx`; that would re-bundle them.
- i18n uses **react-intl** (`IntlProvider`, `injectIntl`, `defineMessages`) — message ids look like `app.customFeedback.*`. `i18next`/`react-i18next` are in `package.json` but the code paths use react-intl; follow react-intl.
- Styling uses `styled-components`. Colors come from `frontend/src/ui/palette.js`, which uses CSS custom properties with hardcoded fallbacks (e.g. `var(--color-primary, #0F70D7)`) so a host page can theme the form.
- `service.js` holds all browser-side I/O: `submitFeedback`, device detection (`ua-parser-js`), `sessionStorage` persistence of in-progress feedback, and a `beforeunload` `sendBeacon` fallback so partial feedback is still sent if the user closes the tab.

URL params the frontend reads: `skipped`, `reason`, `errors` (JSON array), `locale`, `redirectUrl`, `redirectTimeout`. It does **not** read `meetingId`/`userId` from the URL — BBB's `logoutURL` isn't guaranteed to carry them (see "Identity" above), and the frontend has no use for them either now that identity is entirely server-side. `sessionToken` is read from `sessionStorage` (`BBB_sessionToken`), not the URL. `index.jsx` treats `/feedback/check` returning 401 as "no valid session" and passes that down via `SessionContext` (`frontend/src/sessionContext.js`); `FeedbackFlow.jsx` reads it with `useSession()` to decide whether to show the form or the "could not join" error — this replaced an older check that gated on `meetingId`/`userId` being present in the URL.

Dev note: `vite.config.js` sets `base: '/feedback/'` and outputs to `build/`, but defines **no dev proxy**. The frontend fetches `/feedback/*` as same-origin relative URLs, so in `npm start` those calls hit the Vite server, not the backend — serve both behind one origin (or add a proxy) to exercise the API locally.

## Deployment model

`docker-compose.yml` defines only the `app` service with `network_mode: host` and bundles **no** Redis — the backend relies on a Redis already running on the host (as a BBB install provides).

Static assets are served by **nginx**, not Express (changed recently — the backend only serves the three API routes). The Docker image is multi-stage: it builds the frontend, and `docker-entrypoint.sh` copies the built assets into `/app/public-assets` (bind-mounted to `/usr/share/bigbluebutton/feedback`) on container start — overwriting everything **except** the operator-overridable `locales/` and `feedbackData.json`, which are seeded only when absent. Anything else made overridable must be added to that skip list too. nginx then serves `/feedback/*` static files and proxies `/feedback/check`, `/feedback/submit`, `/feedback/webhook` to `localhost:3009` — the first two behind an `auth_request` to bbb-web's `/bigbluebutton/connection/checkAuthorization` (that internal location ships with every BBB >= 3.0 install's own nginx config; `feedback.nginx` only references it, it doesn't define it). The `feedback.nginx` snippet installs to `/usr/share/bigbluebutton/nginx/` (BBB's include dir — **not** `/etc/bigbluebutton/nginx/`). See the nginx snippet and bbb-web `logoutURL` setup in `README.md`.

## Conventions

Follow `COMMIT_LOGS.md` (repo root) for commit messages: Conventional Commits (`feat:`, `fix:`, `build(scope):`, `chore:`), body lines capped at 72 chars, present-tense/imperative, and **one commit per logical change**. Version bumps land as standalone commits titled with the bare version (e.g. `1.11.0`); keep `frontend/package.json`, `backend/package.json`, and `CHANGELOG.md` versions in sync when bumping.

Note the tree contains stale editor backup files (`*~`) that are not part of the project — ignore them.
