#!/bin/sh
set -e

# Copia os assets buildados para o volume montado
if [ -d /app/built-assets ]; then
  mkdir -p /app/public-assets
  cp -r /app/built-assets/* /app/public-assets/
fi

exec "$@"
