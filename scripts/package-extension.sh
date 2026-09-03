#!/usr/bin/env bash
# Builds a reproducible, checked release zip under dist/.
# Usage: scripts/package-extension.sh

set -euo pipefail
cd "$(dirname "$0")/.."

FILES=$(scripts/check-release.sh --print-files)

VERSION=$(node -e "console.log(require('./manifest.json').version)")
if [[ ! "$VERSION" =~ ^[0-9]+(\.[0-9]+){0,3}$ ]]; then
  echo "ERROR: invalid version in manifest.json: $VERSION" >&2
  exit 1
fi

OUT_DIR="dist"
STAGE_DIR=$(mktemp -d)
cleanup() {
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

mkdir -p "$OUT_DIR"

while IFS= read -r f; do
  mkdir -p "$STAGE_DIR/$(dirname "$f")"
  cp "$f" "$STAGE_DIR/$f"
done <<< "$FILES"

ZIP_NAME="youtube-zhongwen-cards-v${VERSION}.zip"
ZIP_PATH="$(pwd)/$OUT_DIR/$ZIP_NAME"
rm -f "$ZIP_PATH"

(cd "$STAGE_DIR" && zip -X -q -r "$ZIP_PATH" .)

ZIP_CONTENTS=$(unzip -Z1 "$ZIP_PATH")
for bad in "config.js" ".DS_Store" ".git"; do
  if echo "$ZIP_CONTENTS" | grep -qE "(^|/)$bad(/|$)"; then
    echo "ERROR: forbidden file found in built zip: $bad" >&2
    rm -f "$ZIP_PATH"
    exit 1
  fi
done

echo "Built $OUT_DIR/$ZIP_NAME"
if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$ZIP_PATH"
else
  sha256sum "$ZIP_PATH"
fi
