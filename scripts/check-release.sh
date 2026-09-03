#!/usr/bin/env bash
# Release gate: validates that exactly the intended files ship, that every
# file manifest.json/HTML/JS reference actually exists, runs syntax checks
# and the test suite, and scans the full repo (not just shipped files) for
# accidentally committed credentials.
#
# Usage:
#   scripts/check-release.sh                # run all checks
#   scripts/check-release.sh --print-files   # print the final file list only (for package-extension.sh)

set -euo pipefail
cd "$(dirname "$0")/.."

PRINT_FILES_ONLY=0
if [[ "${1:-}" == "--print-files" ]]; then
  PRINT_FILES_ONLY=1
fi

log() {
  if [[ "$PRINT_FILES_ONLY" -eq 0 ]]; then
    echo "$@" >&2
  fi
}

public_allowlist=(
  "manifest.json"
  "background.js"
  "content.js"
  "i18n.js"
  "settings.js"
  "vocab-lib.js"
  "sidepanel.html"
  "sidepanel.js"
  "sidepanel.css"
  "options.html"
  "options.js"
  "options.css"
  "prompts/vocab-translate-batch.md"
  "prompts/vocab-topic-select.md"
  "data/hsk-1.json"
  "data/hsk-2.json"
  "data/hsk-3.json"
  "data/hsk-4.json"
  "data/hsk-5.json"
  "data/hsk-6.json"
  "data/hsk-7.json"
  "icons/icon16.png"
  "icons/icon48.png"
  "icons/icon128.png"
  "README.md"
  "PRIVACY.md"
  "LICENSE"
)

required_public_files=(
  "manifest.json"
  "background.js"
  "content.js"
  "settings.js"
  "vocab-lib.js"
  "sidepanel.html"
  "options.html"
)

for f in "${public_allowlist[@]}"; do
  if [[ -L "$f" ]]; then
    echo "ERROR: $f is a symlink, not a regular file" >&2
    exit 1
  fi
done

for f in "${required_public_files[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file missing: $f" >&2
    exit 1
  fi
done

for f in "${public_allowlist[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: allowlisted file missing: $f" >&2
    exit 1
  fi
done

# Manifest validation + reference-walk: every file manifest.json points to
# (or that JS/HTML source references) must exist AND be allowlisted.
ALLOWLIST_JSON=$(printf '%s\n' "${public_allowlist[@]}" | node -e "
const lines = [];
require('readline').createInterface({ input: process.stdin })
  .on('line', (x) => lines.push(x))
  .on('close', () => console.log(JSON.stringify(lines)));
")
export ALLOWLIST_JSON

node --input-type=module -e "
import fs from 'node:fs';

const allowlist = new Set(JSON.parse(process.env.ALLOWLIST_JSON));

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
if (manifest.manifest_version !== 3) throw new Error('manifest_version must be 3');
if (!manifest.name) throw new Error('manifest.name is required');
if (!manifest.version) throw new Error('manifest.version is required');
if (!/^\d+(\.\d+){0,3}\$/.test(manifest.version)) throw new Error('manifest.version is not a valid semver-like string');
if (!manifest.description) throw new Error('manifest.description is required');

const referenced = new Set();
if (manifest.background && manifest.background.service_worker) referenced.add(manifest.background.service_worker);
if (manifest.side_panel && manifest.side_panel.default_path) referenced.add(manifest.side_panel.default_path);
if (manifest.options_ui && manifest.options_ui.page) referenced.add(manifest.options_ui.page);
for (const cs of manifest.content_scripts || []) {
  for (const f of cs.js || []) referenced.add(f);
  for (const f of cs.css || []) referenced.add(f);
}
for (const icon of Object.values(manifest.icons || {})) referenced.add(icon);
for (const icon of Object.values((manifest.action && manifest.action.default_icon) || {})) referenced.add(icon);

for (const f of referenced) {
  if (!fs.existsSync(f)) throw new Error('manifest references missing file: ' + f);
  if (!allowlist.has(f)) throw new Error('manifest references a non-allowlisted file: ' + f);
}

// Scan JS for prompt-file loads and data-file fetches, HTML for src/href.
const jsFiles = ['background.js', 'content.js', 'settings.js', 'vocab-lib.js', 'sidepanel.js', 'options.js'];
for (const jsFile of jsFiles) {
  if (!fs.existsSync(jsFile)) continue;
  const text = fs.readFileSync(jsFile, 'utf8');
  const promptMatches = [...text.matchAll(/prompts\/[\w.-]+\.md/g)].map((m) => m[0]);
  const dataMatches = [...text.matchAll(/data\/[\w.-]+\.json/g)].map((m) => m[0]);
  for (const ref of [...promptMatches, ...dataMatches]) {
    if (!fs.existsSync(ref)) throw new Error(jsFile + ' references missing file: ' + ref);
    if (!allowlist.has(ref)) throw new Error(jsFile + ' references a non-allowlisted file: ' + ref);
  }
}

const htmlFiles = ['sidepanel.html', 'options.html'];
for (const htmlFile of htmlFiles) {
  const text = fs.readFileSync(htmlFile, 'utf8');
  const refs = [...text.matchAll(/(?:src|href)=\"([^\"]+)\"/g)]
    .map((m) => m[1])
    .filter((r) => !/^https?:\/\//.test(r));
  for (const ref of refs) {
    if (!fs.existsSync(ref)) throw new Error(htmlFile + ' references missing file: ' + ref);
    if (!allowlist.has(ref)) throw new Error(htmlFile + ' references a non-allowlisted file: ' + ref);
  }
}

console.error('Manifest and reference checks passed.');
" 1>&2

log "Running node --check on JS files..."
for f in "${public_allowlist[@]}"; do
  if [[ "$f" == *.js ]]; then
    node --check "$f"
  fi
done

log "Running test suite..."
node --test tests/*.test.js >&2

log "Scanning for accidentally shipped dev files..."
for bad in "config.js" ".DS_Store" ".git"; do
  for f in "${public_allowlist[@]}"; do
    if [[ "$f" == "$bad" || "$f" == *"/$bad" ]]; then
      echo "ERROR: forbidden file in allowlist: $f" >&2
      exit 1
    fi
  done
done

log "Scanning full git tree for potential credentials..."
node -e "
const { execSync } = require('node:child_process');
const fs = require('node:fs');

let files;
try {
  files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
} catch (e) {
  files = [];
}

const patterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /sk-ant-[A-Za-z0-9_-]{20,}/,    // Anthropic-style
  /sd_[A-Za-z0-9]{20,}/,          // Supadata-style
  /gh[pousr]_[A-Za-z0-9]{20,}/,   // GitHub tokens
  /AIza[0-9A-Za-z_-]{30,}/,       // Google API keys
  /xox[baprs]-[A-Za-z0-9-]{10,}/, // Slack tokens
  /AKIA[0-9A-Z]{12,}/,            // AWS access key id
  /\b(api[_-]?key|secret|token)\b\s*[:=]\s*[\"'][^\"']{8,}[\"']/i,
];

let failed = false;
for (const f of files) {
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) continue;
  const text = fs.readFileSync(f, 'utf8').toString();
  for (const re of patterns) {
    if (re.test(text)) {
      console.error('Possible credential in ' + f + ' matching ' + re);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.error('No credential patterns found.');
" >&2

log "All checks passed."

if [[ "$PRINT_FILES_ONLY" -eq 1 ]]; then
  printf '%s\n' "${public_allowlist[@]}"
fi
