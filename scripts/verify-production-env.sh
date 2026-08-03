#!/usr/bin/env bash
set -euo pipefail

env_file="${1:-deploy.env}"
if [[ ! -f "$env_file" ]]; then
  echo "ERRORE: file ambiente non trovato: $env_file" >&2
  exit 1
fi

read_value() {
  local key="$1"
  sed -n "s/^${key}=//p" "$env_file" | tail -n 1
}

failures=0
require_value() {
  local key="$1"
  local value
  value="$(read_value "$key")"
  if [[ -z "$value" ]]; then
    echo "ERRORE: $key mancante" >&2
    failures=$((failures + 1))
  fi
}

for key in ONEPIXEL_QR_SECRET ONEPIXEL_ALLOWED_ORIGINS ONEPIXEL_PUBLIC_API_URL ONEPIXEL_PUBLIC_DASHBOARD_URL ONEPIXEL_PAYMENT_MODE STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET GOOGLE_OAUTH_CLIENT_ID; do
  require_value "$key"
done

qr_secret="$(read_value ONEPIXEL_QR_SECRET)"
if (( ${#qr_secret} < 32 )) || [[ "$qr_secret" == *replace* ]]; then
  echo "ERRORE: ONEPIXEL_QR_SECRET deve essere reale e lungo almeno 32 caratteri" >&2
  failures=$((failures + 1))
fi

for key in ONEPIXEL_ALLOWED_ORIGINS ONEPIXEL_PUBLIC_API_URL ONEPIXEL_PUBLIC_DASHBOARD_URL; do
  value="$(read_value "$key")"
  if [[ "$value" != https://* ]] || [[ "$value" == *example.com* ]]; then
    echo "ERRORE: $key deve contenere un URL HTTPS reale" >&2
    failures=$((failures + 1))
  fi
done

if [[ "$(read_value ONEPIXEL_DEMO_SEED)" != "false" ]]; then
  echo "ERRORE: ONEPIXEL_DEMO_SEED deve essere false in produzione" >&2
  failures=$((failures + 1))
fi
if [[ "$(read_value ONEPIXEL_COOKIE_SECURE)" != "true" ]]; then
  echo "ERRORE: ONEPIXEL_COOKIE_SECURE deve essere true in produzione" >&2
  failures=$((failures + 1))
fi
if [[ "$(read_value ONEPIXEL_PAYMENT_MODE)" != "stripe" ]]; then
  echo "ERRORE: ONEPIXEL_PAYMENT_MODE deve essere stripe in produzione" >&2
  failures=$((failures + 1))
fi

stripe_key="$(read_value STRIPE_SECRET_KEY)"
if [[ ! "$stripe_key" =~ ^sk_(live|test)_ ]] || [[ "$stripe_key" == *replace* ]]; then
  echo "ERRORE: STRIPE_SECRET_KEY non sembra una chiave Stripe valida" >&2
  failures=$((failures + 1))
fi
webhook_secret="$(read_value STRIPE_WEBHOOK_SECRET)"
if [[ "$webhook_secret" != whsec_* ]] || [[ "$webhook_secret" == *replace* ]]; then
  echo "ERRORE: STRIPE_WEBHOOK_SECRET non sembra un segreto webhook valido" >&2
  failures=$((failures + 1))
fi
google_client="$(read_value GOOGLE_OAUTH_CLIENT_ID)"
if [[ "$google_client" != *.apps.googleusercontent.com ]] || [[ "$google_client" == *replace* ]]; then
  echo "ERRORE: GOOGLE_OAUTH_CLIENT_ID non sembra un client OAuth web valido" >&2
  failures=$((failures + 1))
fi

if (( failures > 0 )); then
  echo "Verifica produzione fallita: $failures problema/i." >&2
  exit 1
fi

echo "Ambiente produzione onePixel verificato: segreti presenti, HTTPS attivo, demo disabilitata e Stripe configurato."
