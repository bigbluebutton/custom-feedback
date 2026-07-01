#!/bin/sh
set -e

# Copia os assets buildados para o volume montado
if [ -d /app/built-assets ]; then
  mkdir -p /app/public-assets

  # Update all built assets except locales. Those can be overridden at deploy
  # time and should not be discarded.
  for entry in /app/built-assets/*; do
    name=$(basename "$entry")
    [ "$name" = "locales" ] && continue
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
fi

exec "$@"
