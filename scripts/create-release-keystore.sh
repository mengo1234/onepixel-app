#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
signing_dir="$project_root/.tool-state/release-signing"
password_file="$signing_dir/password"
keystore_file="$signing_dir/onepixel-release.jks"

mkdir -p "$signing_dir"
chmod 700 "$signing_dir"

if [[ ! -f "$password_file" ]]; then
  umask 077
  openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 40 > "$password_file"
fi

if [[ ! -f "$keystore_file" ]]; then
  signing_password=$(<"$password_file")
  keytool -genkeypair -noprompt \
    -keystore "$keystore_file" \
    -storepass "$signing_password" \
    -keypass "$signing_password" \
    -alias onepixel-release \
    -keyalg RSA \
    -keysize 4096 \
    -validity 10000 \
    -dname "CN=onePixel Release, OU=Mobile, O=onePixel, L=Milano, C=IT"
  chmod 600 "$keystore_file"
fi

echo "$keystore_file"
