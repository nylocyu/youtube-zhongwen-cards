// Pure, DOM-free logic shared by background.js (importScripts), sidepanel.js
// (<script>), and require()-able directly from Node tests.

const CJK_RANGE = /[㐀-䶿一-鿿]/;
const CJK_RANGE_G = /[㐀-䶿一-鿿]/g;
const CHINESE_TEXT_RATIO_THRESHOLD = 0.3;

// Heuristic: what fraction of non-whitespace characters are CJK ideographs.
function detectIsChineseText(text) {
  if (!text) return false;
  const stripped = String(text).replace(/\s+/g, "");
  if (stripped.length === 0) return false;
  const cjkMatches = stripped.match(CJK_RANGE_G);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  return cjkCount / stripped.length >= CHINESE_TEXT_RATIO_THRESHOLD;
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

// candidates: normalized word objects {simplified, traditional, pinyin, zhuyin, level, freq}
// Matches literal occurrences of either script form in the transcript (captions
// may use either), ranks by frequency-in-transcript, then by the word's own
// corpus frequency rank (lower = more common), then alphabetically for
// determinism. Returns the top `count` candidates augmented with `occurrences`.
function matchCandidatesInTranscript(transcript, candidates, count) {
  const text = String(transcript || "");
  const scored = [];
  for (const candidate of candidates) {
    let occurrences = countOccurrences(text, candidate.simplified);
    if (candidate.traditional && candidate.traditional !== candidate.simplified) {
      occurrences += countOccurrences(text, candidate.traditional);
    }
    if (occurrences > 0) {
      scored.push({ ...candidate, occurrences });
    }
  }
  scored.sort((a, b) => {
    if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
    const aFreq = a.freq == null ? Number.MAX_SAFE_INTEGER : a.freq;
    const bFreq = b.freq == null ? Number.MAX_SAFE_INTEGER : b.freq;
    if (aFreq !== bFreq) return aFreq - bFreq;
    return a.simplified.localeCompare(b.simplified);
  });
  return scored.slice(0, count);
}

// Tolerant JSON-array parser for LLM output: strips ```json fences, isolates
// the outermost [...], retries once after stripping trailing commas.
function parseLooseJson(raw) {
  if (typeof raw !== "string") return null;
  let text = raw.trim();
  text = text.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "").trim();

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  text = text.slice(start, end + 1);

  try {
    return JSON.parse(text);
  } catch (err) {
    const withoutTrailingCommas = text.replace(/,(\s*[\]}])/g, "$1");
    try {
      return JSON.parse(withoutTrailingCommas);
    } catch (err2) {
      return null;
    }
  }
}

const MAX_TRANSLATION_LENGTH = 200;
const MAX_SENTENCE_LENGTH = 200;
const MAX_SENTENCE_PINYIN_LENGTH = 300;

// Never trust the LLM's JSON shape for facts we already have ground truth
// for. `llmItems` is the parsed (untrusted) model output, expected shape
// [{id, translation}, ...]. `sourceById` maps id -> the authoritative bundled
// word object. Every returned id is cross-checked against sourceById;
// anything not found (a hallucinated id/word) is dropped. simplified /
// traditional / pinyin / zhuyin / level are always taken from sourceById,
// never from the model — only `translation` is trusted model output.
//
// Example sentences (optional): `sentence` prefers `source.contextSentence`,
// i.e. the sentence lifted verbatim from the video's transcript — the model
// gets it as input but can never alter it. Only when the source has none
// (Case B: the video isn't Chinese, so there is no sentence to lift) is the
// model's own `item.sentence` used. `sentencePinyin` / `sentenceTranslation`
// are necessarily model output; they are length-capped, nothing more.
function trimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateAndRebuildVocabResponse(llmItems, sourceById) {
  const cards = [];
  const droppedIds = [];

  if (!Array.isArray(llmItems)) {
    return { cards, droppedIds };
  }

  const seen = new Set();
  for (const item of llmItems) {
    if (!item || typeof item !== "object") continue;
    const id = String(item.id ?? "");
    const translation = typeof item.translation === "string" ? item.translation.trim() : "";

    const source = sourceById instanceof Map ? sourceById.get(id) : sourceById?.[id];
    if (!source || !translation || seen.has(id)) {
      if (id) droppedIds.push(id);
      continue;
    }
    seen.add(id);

    const sentence = trimmedString(source.contextSentence) || trimmedString(item.sentence);

    cards.push({
      simplified: source.simplified,
      traditional: source.traditional,
      pinyin: source.pinyin,
      zhuyin: source.zhuyin,
      level: source.level,
      translation: translation.slice(0, MAX_TRANSLATION_LENGTH),
      sentence: sentence.slice(0, MAX_SENTENCE_LENGTH),
      sentencePinyin: trimmedString(item.sentencePinyin).slice(0, MAX_SENTENCE_PINYIN_LENGTH),
      sentenceTranslation: trimmedString(item.sentenceTranslation).slice(0, MAX_TRANSLATION_LENGTH),
    });
  }

  return { cards, droppedIds };
}

function sanitizeTsvField(value) {
  return String(value ?? "").replace(/[\t\r\n]+/g, " ").trim();
}

// cards: [{hanzi, pinyin, translation, sentence?, sentencePinyin?,
// sentenceTranslation?}] — script (simplified/traditional) is already resolved
// into `hanzi` by the caller before this is called.
// No header row: Anki's file import would otherwise add a literal
// "Hanzi/Pinyin/<language>" card.
// Column count is derived from the data, not passed in: without sentences the
// output stays byte-identical to the three-column format, so existing Anki
// field mappings keep working.
function buildTsv(cards) {
  const withSentence = cards.some((card) => card.sentence);
  const rows = [];
  for (const card of cards) {
    const row = [
      sanitizeTsvField(card.hanzi),
      sanitizeTsvField(card.pinyin),
      sanitizeTsvField(card.translation),
    ];
    if (withSentence) {
      row.push(
        sanitizeTsvField(card.sentence),
        sanitizeTsvField(card.sentencePinyin),
        sanitizeTsvField(card.sentenceTranslation)
      );
    }
    rows.push(row);
  }
  return rows.map((row) => row.join("\t")).join("\n") + "\n";
}

const ZWC_VOCAB = {
  detectIsChineseText,
  matchCandidatesInTranscript,
  parseLooseJson,
  validateAndRebuildVocabResponse,
  buildTsv,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = ZWC_VOCAB;
}
if (typeof globalThis !== "undefined") {
  globalThis.ZWC_VOCAB = ZWC_VOCAB;
}
