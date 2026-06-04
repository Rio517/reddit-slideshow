#!/usr/bin/env bash
# AMO build script — reproduces the exact submitted Firefox add-on from source.
# Requirements and tool versions are documented in BUILD.md.
# Run from the project root on Node 20+ (the AMO reviewer default Node 24 works too).
set -euo pipefail

npm ci        # install the exact pinned dependencies from package-lock.json
npm run zip   # WXT build + package -> .output/<name>-<version>-firefox.zip

echo
echo "Done. Submitted add-on: .output/reddit-slideshow-<version>-firefox.zip"
