#!/bin/sh
set -e

# Copia os assets buildados para o volume montado
if [ -d /app/built-assets ]; then
  cp -r /app/built-assets/* /app/public-assets/
fi

exec "$@"
