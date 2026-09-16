#!/usr/bin/env bash
#
# Prepares this directory for `docker compose up -d`:
#
#   1. creates .env from .env.example if it does not exist
#   2. fills in any secret that is still blank — generated, never fixed
#   3. creates data/ with the ownership each container needs
#
# Safe to run repeatedly. A value you set by hand is never overwritten, so the
# way to choose your own secret is to put it in .env and then run this.
set -euo pipefail

cd "$(dirname "$0")"

APP_UID=1001
APP_GID=1001

# ─── .env ─────────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ created .env from .env.example"
fi

# The file is about to hold real secrets.
chmod 600 .env

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    # Busybox images and stripped-down hosts often have no openssl.
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

# Rewrites KEY in place. awk rather than `sed -i`, which needs a different
# argument on macOS than on GNU, and would treat / and & in a value as syntax.
set_var() {
  local key=$1 value=$2 tmp
  tmp=$(mktemp)
  if grep -qE "^${key}=" .env; then
    awk -v k="$key" -v v="$value" '
      !done && index($0, k "=") == 1 { print k "=" v; done = 1; next }
      { print }
    ' .env > "$tmp"
  else
    cat .env > "$tmp"
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi
  cat "$tmp" > .env    # preserves the 600 mode; `mv` would not
  rm -f "$tmp"
}

is_blank() {
  # Unset counts as blank, as does KEY= with nothing after it.
  local v
  v=$(grep -E "^${1}=" .env | tail -1 | cut -d= -f2- || true)
  [ -z "$v" ]
}

# fill KEY VALUE LABEL [VERB] — VERB distinguishes a random secret from a
# fixed default, which matters when reading the output: one is safe, the other
# is the thing you have to go and change.
fill() {
  local key=$1 value=$2 label=$3 verb=${4:-generated}
  if is_blank "$key"; then
    set_var "$key" "$value"
    printf '  %-10s %-24s %s\n' "$verb" "$key" "($label)"
  else
    printf '  %-10s %-24s %s\n' "kept" "$key" "(already set)"
  fi
}

echo "Secrets:"
fill JWT_SECRET             "$(gen_secret)" "signs the session cookie"
fill WAHA_API_KEY           "$(gen_secret)" "app ↔ gateway REST auth"
fill WAHA_WEBHOOK_HMAC_KEY  "$(gen_secret)" "signs webhook deliveries"
fill WAHA_DASHBOARD_PASSWORD "$(gen_secret)" "WAHA dashboard basic auth"

# The admin account is the one credential a human types, so it gets a memorable
# default rather than a generated one. ADMIN_EMAIL must look like an address:
# the login form is <input type="email" required>, and a browser will not submit
# a value without an "@" — a bare "admin" would create an account you could not
# log in to.
echo "Admin account:"
fill ADMIN_EMAIL    "admin@example.com" "login identifier"  default
fill ADMIN_PASSWORD "admin"             "CHANGE THIS"      default

# ─── data/ ────────────────────────────────────────────────────────────────────
# Docker creates a missing bind-mount source as root:root. WAHA runs as root so
# it does not care, but the app image runs as the unprivileged `nextjs` user
# (uid 1001) and would fail to open its SQLite database.
mkdir -p data/app data/waha/sessions data/waha/media

if [ "$(uname -s)" = "Linux" ]; then
  # Docker Desktop on macOS maps ownership for you; on Linux the uid is real.
  if [ "$(id -u)" -eq 0 ]; then
    chown -R "$APP_UID:$APP_GID" data/app
  elif [ "$(stat -c '%u' data/app)" != "$APP_UID" ]; then
    echo
    echo "! data/app must be owned by uid $APP_UID for the app to write its database."
    echo "  Run:  sudo chown -R $APP_UID:$APP_GID $(pwd)/data/app"
    exit 1
  fi
fi

admin_email=$(grep -E '^ADMIN_EMAIL=' .env | tail -1 | cut -d= -f2-)
admin_pass=$(grep -E '^ADMIN_PASSWORD=' .env | tail -1 | cut -d= -f2-)

echo
echo "✓ data/ ready"
echo
if [ "$admin_pass" = "admin" ]; then
  echo "  !! ADMIN_PASSWORD is the default \"admin\". Change it in .env before this"
  echo "     host is reachable from the internet — this login controls the"
  echo "     WhatsApp number. Changing it later does NOT rotate the account;"
  echo "     use scripts/seed.ts for that."
  echo
fi
echo "  Sign in with:  $admin_email / $admin_pass"
echo "  WAHA dashboard password:  grep WAHA_DASHBOARD_PASSWORD .env"
echo
echo "  Still worth setting by hand in .env:  APP_URL, and OPENAI_API_KEY or"
echo "  GEMINI_API_KEY if your AI providers have no key of their own."
echo
echo "  Next:  docker compose up -d"
