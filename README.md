# Customizable BigBlueButton feedback form

This project offers a customizable feedback solution that can be easily integrated into any other application via a redirect URL. It consists of an intuitive user interface (front-end) and an HTTP server (back-end) that handles webhooks to collect meeting and user data.

Compatible with Bigbluebutton >= 3.0

    Package coming soon

## Project Structure

### Front-end

The front-end is responsible for the entire user interface. It allows users to interact with the feedback system in a user-friendly and efficient manner.

Additional feedback options can be added or existing options can be modified via the feedbackData.json file. This file is mapped to render the feedback options and steps, and is served as a static asset so it can be overridden per deployment (see [Customizing the feedback form](#customizing-the-feedback-form)).

### Back-end

The back-end is an HTTP server that listens for webhooks and collects data on meetings and users. This data is processed and stored in the server's database.

At the end of the feedback process, the HTTP server receives the submitted feedback data. The meeting/user record it's filed under comes from the caller's `User-Id`/`Meeting-Id`, verified against bbb-web via nginx (see [Configure nginx](#2-configure-nginx)) and not from the `userId`/`meetingId` the URL happens to carry.

## Running with docker-compose

    docker-compose up

Changes the docker-compose.yml to fit your use case. **Note:** Ensure there are no spaces between the variable name and the equals sign (e.g., `VAR=value`, not `VAR = value`).

    FEEDBACK_URL (optional)
      Where to submit the feedback object. With no URL results will be exclusivelly logged

    SHARED_SECRET
      Your server's shared secret used to register web hooks

    BASIC_URL
      Domain of your server without the /bigbluebutton/

    REDIRECT_URL (optional)
      Where to redirect user after the feedback form. Can also be set by `userdata-feedbackredirecturl` or `metadata_feedbackredirecturl`

    REDIRECT_ALLOWED_HOSTS (optional)
      Comma-separated list of extra hostnames the post-feedback redirect is allowed to target
      (e.g. `portal.example.com,other.example.com`). The host of BASIC_URL and, if set, of
      REDIRECT_URL are always allowed. Any `feedbackredirecturl`/`bbb_feedback_redirect_url`
      pointing at a host outside this allowlist is ignored and logged as a warning. This
      is a safety boundary, not just configuration, so set it to every external redirect
      target you actually use.

    REDIRECT_TIMEOUT
      default: 10000

    LOG_LEVEL
      default: info
      valid values: error, debug, info, verbose

    LOG_STDOUT
      default: true

    PORT
      default: 3009

## Deploying to Production

### 1. Build and start the container

```bash
docker compose up -d
```

On first start, the container copies the built static assets into the host directory `/usr/share/bigbluebutton/feedback/`. This directory is bind-mounted via `docker-compose.yml` and will be served directly by nginx.

### 2. Configure nginx

Copy the `feedback.nginx` file from this repository to `/usr/share/bigbluebutton/nginx/feedback.nginx` on the BBB host, then reload nginx:

```bash
sudo cp feedback.nginx /usr/share/bigbluebutton/nginx/feedback.nginx
sudo nginx -t && sudo systemctl reload nginx
```

Upgrading an existing install requires copying the file again: older versions
proxied the whole `/feedback` path to the back-end, which no longer serves the
static assets.

The nginx configuration serves static assets (HTML, JS, CSS) directly from disk and proxies only API endpoints to the back-end. `/feedback/check` and `/feedback/submit` are additionally gated behind an `auth_request` to bbb-web's `/bigbluebutton/connection/checkAuthorization` — the same internal location bbb-webrtc-sfu and BBB's other services already use, which every BBB >= 3.0 install's own nginx config already defines. nginx only forwards the request, with the caller's verified `User-Id`/`Meeting-Id` injected as headers, once bbb-web has validated the `sessionToken` the frontend attaches to these two calls:

```nginx
location = /feedback/check {
  auth_request /bigbluebutton/connection/checkAuthorization;
  auth_request_set $user_id $sent_http_user_id;
  auth_request_set $meeting_id $sent_http_meeting_id;
  proxy_set_header User-Id $user_id;
  proxy_set_header Meeting-Id $meeting_id;
  proxy_pass http://localhost:3009;
}

location = /feedback/submit {
  auth_request /bigbluebutton/connection/checkAuthorization;
  auth_request_set $user_id $sent_http_user_id;
  auth_request_set $meeting_id $sent_http_meeting_id;
  proxy_set_header User-Id $user_id;
  proxy_set_header Meeting-Id $meeting_id;
  proxy_pass http://localhost:3009;
}

location = /feedback/webhook {
  allow 127.0.0.1;
  allow 172.16.0.0/12; # default docker bridge networks (e.g. 172.17.0.0/16)
  allow 10.0.0.0/8;
  allow 192.168.0.0/16;
  deny all;
  proxy_pass http://localhost:3009;
}

location ~ ^/feedback/(feedbackData\.json|locales/) {
  root /usr/share/bigbluebutton;
  add_header Cache-Control "no-cache";
  try_files $uri =404;
}

location /feedback {
  root /usr/share/bigbluebutton;
  try_files $uri /feedback/index.html;
}
```

The overridable assets — the form definition and the locale files — get an
explicit `Cache-Control` because they are served unhashed from a stable URL:
without it a browser picks its own freshness lifetime and can keep serving a
copy from before an edit.

`/feedback/webhook` has no `sessionToken`/`auth_request` gate (it's a
server-to-server call from bbb-webhooks, not a browser), so it only trusts the
caller's source address. **Configure bbb-webhooks' `PERMANENT_HOOKS` to post
to this endpoint over a private/internal address** (e.g. `http://localhost:3009/feedback/webhook`
if it runs on the same host, or the docker bridge/internal overlay address if
it runs in a sibling container). Never through the BBB host's public
hostname or a publicly reachable IP.

Testing `/feedback/check`/`/feedback/submit` directly against the back-end
(bypassing this nginx config, e.g. in local dev) will now 401 unless you set
`User-Id`/`Meeting-Id` headers by hand — there's no way around bbb-web's
check other than going through a real BBB+nginx install or an install that
proxies these routes the same way.

### 3. Configure bbb-web

Configure `bbb-web` to redirect logged-out users to the feedback application after they leave the meeting.

The redirect URL should be `https://YOUR_BBB_HOST/feedback` — no `%%USERID%%`/`%%MEETINGID%%` placeholders needed. The backend identifies the caller from their `sessionToken` (verified against bbb-web by nginx, see [Configure nginx](#2-configure-nginx)), not from URL params, so a bare `logoutURL` is enough.

* Edit `logoutURL` in `/usr/share/bbb-web/WEB-INF/classes/bigbluebutton.properties`
* Or create your meeting with `logoutURL`
* Or send it via `userdata-logoutURL`

## Customizing the feedback form

The form definition is shipped as a static JSON asset (not bundled into the app),
so it can be overridden per deployment without rebuilding. It is served from
`/usr/share/bigbluebutton/feedback/feedbackData.json` and fetched by the client at
runtime.

To customize the form on a host:

1. Edit `/usr/share/bigbluebutton/feedback/feedbackData.json`.
2. No rebuild or restart is required — the client fetches the file on next load.

The container **seeds** the default file only when it is missing, so your
customizations survive container restarts and image upgrades. The converse holds
too: once the file is there it is never written again, so questions and fixes
that ship with a later image do not reach it. Delete the file and restart the
container to take the shipped default — to discard a customization, or after an
upgrade whose release notes mention a change to the form.

The whole form — steps, their order and their questions — is data. Step ids are
arbitrary: what a step *looks like* comes from its `type`, and where it *goes*
comes from the `next` of the option the user picks. Steps can be added, renamed or
removed without any code change.

```jsonc
{
  "initialStep": "rating",        // which step opens the form (default: "rating")

  "rating": {
    "type": "rating",             // star scale; stars = highest score listed
    "progress": "01/04",          // free-form label shown next to the title
    "1": { "next": "problem" },   // every score needs its own entry: a score
    "2": { "next": "problem" },   // the step does not list ends the form right
    "3": { "next": "problem" },   // after the rating, so list them all
    "4": { "next": "like" },
    "5": { "next": "like" }
  },

  "problem": {
    "type": "options",            // radios and/or one free-text area
    "progress": "02/04",
    "titleLabel": { "id": "app.customFeedback.problem.title" },   // optional
    "options": [
      {
        "type": "radio",
        "textLabel": { "id": "my.audio.option", "defaultMessage": "Audio" },
        "next": "audioProblem",   // omit to end the form after this option
        "key": "problem",         // key/value recorded in the feedback payload
        "value": "audio"
      },
      {
        "type": "radio",
        "textLabel": { "id": "app.customFeedback.other" },
        "next": "email",
        "key": "problem",
        "value": "other"          // "other" is what pairs with the text area
      },
      {
        "type": "textArea",
        "key": "problem_described",
        "placeholderLabel": { "id": "app.customFeedback.describeProblem" },  // optional
        "next": "email"           // optional: overrides where free text goes
      }
    ]
  },

  "email": {
    "type": "email",              // e-mail input; always lands in the payload
    "progress": "04/04",          // as user.email, whatever `key` says
    "titleLabel": { "id": "app.customFeedback.email.thank" },     // optional
    "options": [
      { "type": "email", "key": "user.email",
        "placeholderLabel": { "id": "app.customFeedback.email.placeholder" } }
    ]
  }
}
```

Step `type` values are `rating`, `options` and `email` — a new *kind of input*
(anything none of the three can render) is the only change that still needs code.
`confirmation` is reserved for the closing step, and any step that is reached but
not described in the file simply ends the form.

Typing free text counts as picking the `other` radio: it records `other` under
that radio's `key` and follows its `next`. Give the text area its own `next`
only to send a written answer somewhere else.

A rating score the step does not list ends the form right after the rating, so
give every score on the scale its own entry.

`rating` and `email` are reserved key names — an answer recorded under `rating`
overwrites the numeric score, and one recorded under `email` lands in `user.email`
instead of the feedback body. Pick anything else.

Labels are message ids resolved against the locale files, so adding a key under
`/usr/share/bigbluebutton/feedback/locales/` (see the section below) translates a
custom label. A label may also carry a `defaultMessage`, which is used when no
locale provides that id — handy for a one-off option you do not want to translate.

Consult the shipped form for the full structure: [feedbackData.json](frontend/public/feedbackData.json).

## Customizing translations

Locales are shipped as static JSON assets (not bundled into the app), so they can
be overridden per deployment without rebuilding. They are served from
`/usr/share/bigbluebutton/feedback/locales/<locale>.json` (e.g. `en.json`,
`es.json`, `pt_BR.json`, `it.json`) and fetched by the client at runtime.

To override a translation on a host:

1. Edit the desired file under `/usr/share/bigbluebutton/feedback/locales/`, or add
   a new `<locale>.json` (e.g. `es_MX.json`).
2. No rebuild or restart is required — the client fetches the file on next load.

The container **seeds** the default locale files only when they are missing, so
your overrides survive container restarts and image upgrades. Seeding is per file,
so a locale added by a later image still arrives — but an overridden file is never
written again and does not pick up new or corrected strings. Delete a file and
restart the container to take its shipped default back.

The client resolves the file to load from the browser/URL `locale`, falling back
to the language default (e.g. `pt` -> `pt_BR`) and then to `en`. Missing keys in a
translation fall back to English.

## License

This project is licensed under the GNU Lesser General Public License v3.0 - see the [LICENSE](./LICENSE) file for details.
