#!/bin/sh
set -e

if [ -d /app/built-assets ]; then
  mkdir -p /app/public-assets

  # Update all built assets except the locales and the form definition. Those
  # can be overridden at deploy time and should not be discarded.
  for entry in /app/built-assets/*; do
    name=$(basename "$entry")
    case "$name" in
      locales|feedbackData.json) continue ;;
    esac
    rm -rf "/app/public-assets/$name"
    cp -r "$entry" "/app/public-assets/$name"
  done

  # Seed default locales only when they are absent to preserve deploy time
  # overrides when restarting the container. Admins should clear the dir
  # on deploy if they want to reset the locales to the defaults.
  mkdir -p /app/public-assets/locales

  for f in /app/built-assets/locales/*.json; do
    [ -e "$f" ] || continue
    target="/app/public-assets/locales/$(basename "$f")"
    [ -e "$target" ] || cp "$f" "$target"
  done

  # Same for the form definition. Delete it to reseed the default.
  if [ -e /app/built-assets/feedbackData.json ] && [ ! -e /app/public-assets/feedbackData.json ]; then
    cp /app/built-assets/feedbackData.json /app/public-assets/feedbackData.json
  fi
fi

exec "$@"
