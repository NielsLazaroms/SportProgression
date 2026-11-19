#!/usr/bin/env bash
# Builds the signed Android app (a Trusted Web Activity around the live site).
#   ./android/build.sh
# Needs only Docker. The APK lands in android/dist/.
#
# First run: makes the release key android/release.jks and
# android/keystore.properties (both git-ignored) and prints the SHA-256
# fingerprint for frontend/public/.well-known/assetlinks.json.
# Back the key up: without it no update can ever be installed over the app.
set -euo pipefail
cd "$(dirname "$0")"

# Git Bash on Windows rewrites paths like /src; keep them as they are and
# give Docker a Windows path to mount.
export MSYS_NO_PATHCONV=1
HERE="$(pwd -W 2>/dev/null || pwd)"

IMAGE=sportprogression-android-build
docker build -q -t "$IMAGE" . > /dev/null

run() {
  docker run --rm -v "$HERE:/src" -v sportprogression-gradle-cache:/home/gradle/.gradle -w /src "$IMAGE" "$@"
}

if [ ! -f keystore.properties ] && [ -n "${CI:-}" ]; then
  # A fresh key in CI would sign an APK that cannot update the installed app.
  echo "keystore.properties is missing: CI writes it from the repository secrets"; exit 1
fi

if [ ! -f keystore.properties ]; then
  echo "== making the release key (once)"
  PASS="$(openssl rand -base64 24 | tr -d '/+=')"
  run keytool -genkeypair -v -keystore release.jks -alias ironpulse \
    -keyalg RSA -keysize 4096 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" \
    -dname "CN=Iron Pulse, O=SportProgression" > /dev/null
  cat > keystore.properties <<PROPS
storeFile=release.jks
storePassword=$PASS
keyAlias=ironpulse
keyPassword=$PASS
PROPS
  echo "   made android/release.jks and android/keystore.properties: back both up."
fi

# Always increasing, so a new APK installs over the old one.
CODE="$(git rev-list --count HEAD)"
NAME="1.0.$CODE"
echo "== building $NAME (versionCode $CODE)"
run gradle --no-daemon -q :app:assembleRelease -PversionCode="$CODE" -PversionName="$NAME"

mkdir -p dist
OUT="dist/iron-pulse-$NAME.apk"
cp app/build/outputs/apk/release/app-release.apk "$OUT"

FP="$(run apksigner verify --print-certs "$OUT" | sed -n 's/.*SHA-256 digest: //p' | head -1 \
  | tr 'a-f' 'A-F' | sed 's/../&:/g; s/:$//')"
echo "== $OUT"
echo "   certificate SHA-256: $FP"
if ! grep -q "$FP" ../frontend/public/.well-known/assetlinks.json 2>/dev/null; then
  echo "   NOT in frontend/public/.well-known/assetlinks.json yet: add it and deploy, or the app shows a URL bar."
  [ -z "${CI:-}" ] || exit 1
fi
# A fixed name for the "latest release" download link.
cp "$OUT" dist/iron-pulse.apk
