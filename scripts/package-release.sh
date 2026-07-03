#!/usr/bin/env bash
set -euo pipefail

rm -rf release
mkdir -p \
  "release/workspace-layout@franciscoknebel.com" \
  "release/workspace-layout"

cp dist/extension.js dist/metadata.json "release/workspace-layout@franciscoknebel.com/"
cp bin/workspace-layout.js "release/workspace-layout/workspace-layout"
cp -R dist/schema "release/workspace-layout/schema"
chmod +x "release/workspace-layout/workspace-layout"

(
  cd release
  zip -qr "workspace-layout@franciscoknebel.com.zip" "workspace-layout@franciscoknebel.com"
  tar -czf "workspace-layout-cli-and-schema.tar.gz" "workspace-layout"
)

test -f "release/workspace-layout@franciscoknebel.com.zip"
test -f "release/workspace-layout-cli-and-schema.tar.gz"
test -f "release/workspace-layout@franciscoknebel.com/extension.js"
test -f "release/workspace-layout@franciscoknebel.com/metadata.json"
test -x "release/workspace-layout/workspace-layout"
test -f "release/workspace-layout/schema/workspace-layout.schema.json"

echo "Release artifacts written to release/."
