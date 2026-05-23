#!/usr/bin/env bash
# Regenerate store-frontend/public/logo.png from brand/extensilica.svg (512×512).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/store-backend"
node -e "
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const svg = fs.readFileSync(path.join('$root', 'brand/extensilica.svg'));
const out = path.join('$root', 'store-frontend/public/logo.png');
sharp(svg).resize(512, 512).png({ compressionLevel: 9 }).toFile(out)
  .then((info) => console.log('Wrote', out, info.width + 'x' + info.height));
"
