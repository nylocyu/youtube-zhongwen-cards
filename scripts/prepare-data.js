// One-time dev-time data-prep script. NOT shipped/run inside the extension.
//
// Downloads the MIT-licensed HSK 3.0 vocabulary data from
// https://github.com/drkameleon/complete-hsk-vocabulary and normalizes it into
// per-level JSON files under data/, which ARE shipped with the extension.
//
// Usage: node scripts/prepare-data.js
//
// We use the "newest-N" level tags (the current official HSK 3.0 scheme),
// ignoring the "new-N" (an earlier 3.0 draft) and "old-N" (legacy HSK 2.0)
// tags also present in the source data. Level 7 represents the merged
// "7-9" advanced band, per the source's own level reference table.

const fs = require("fs");
const path = require("path");

const SOURCE_URL =
  "https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.json";
const DATA_DIR = path.join(__dirname, "..", "data");
const LEVELS = [1, 2, 3, 4, 5, 6, 7];

async function main() {
  console.log(`Fetching ${SOURCE_URL} ...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }
  const words = await res.json();
  console.log(`Downloaded ${words.length} entries.`);

  const byLevel = new Map(LEVELS.map((n) => [n, []]));

  for (const word of words) {
    const tag = (word.level || []).find((l) => l.startsWith("newest-"));
    if (!tag) continue;
    const level = Number(tag.slice("newest-".length));
    if (!byLevel.has(level)) continue;

    const form = (word.forms || [])[0];
    if (!form || !form.transcriptions) continue;

    byLevel.get(level).push({
      simplified: word.simplified,
      traditional: form.traditional || word.simplified,
      pinyin: form.transcriptions.pinyin || "",
      zhuyin: form.transcriptions.bopomofo || "",
      level: { system: "HSK", value: level },
      freq: typeof word.frequency === "number" ? word.frequency : null,
    });
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });

  for (const level of LEVELS) {
    const entries = byLevel.get(level);
    entries.sort((a, b) => {
      if (a.freq == null) return 1;
      if (b.freq == null) return -1;
      return a.freq - b.freq;
    });
    const outPath = path.join(DATA_DIR, `hsk-${level}.json`);
    fs.writeFileSync(outPath, JSON.stringify(entries, null, 2) + "\n");
    console.log(`Wrote ${entries.length} words to ${path.relative(process.cwd(), outPath)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
