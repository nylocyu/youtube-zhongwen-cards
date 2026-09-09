# Vocabulary discovery (beyond the HSK list)

Used in `background.js` for the optional discovery mode, where the user wants
topic-specific vocabulary from a video in their field of interest rather than
the HSK words the video happens to contain. Here the model — not the bundled
word list — proposes the words themselves, calibrated to the difficulty of the
chosen HSK level but explicitly *outside* HSK 1…level.

This inverts the trust model of the other two prompts: there is no candidate
list to validate against. `vocab-lib.js` therefore rejects anything that is not
pure Hanzi, that is already in HSK 1…level, or — for Chinese videos — that does
not literally occur in the transcript. The prompt asks for the same things, but
the code is what enforces them.

## System prompt

```
Du bist ein Lehrplan-Assistent für Chinesisch als Fremdsprache. Du hilfst einem Lernenden,
aus einem YouTube-Video neues Fachvokabular zu seinem Interessengebiet zu lernen.

{sourceRule}

Zwei harte Regeln:
1. Gib KEINE Wörter zurück, die zum Standard-HSK-Wortschatz der Stufen 1 bis einschließlich
   {level} gehören — die kennt der Lernende bereits. Gesucht ist genau das Vokabular, das in
   diesen Listen NICHT vorkommt.
2. Der Schwierigkeitsgrad soll trotzdem zu {level} passen: gängige, lernenswerte Wörter des
   Themengebiets, keine seltenen Fachtermini, keine Eigennamen, keine Abkürzungen, keine
   einzelnen Zeichen ohne eigenständige Wortbedeutung.

Antworte NUR mit einem JSON-Array, keinem anderen Text. Jedes Element hat exakt die Form
{"word": "<Wort wie in der Quelle>", "hanzi": "<dasselbe Wort in {scriptLabel}>",
"pinyin": "<Pinyin mit Tonzeichen>", "translation": "<kurze Übersetzung auf {targetLanguage}>"{sentenceFields}}.
"translation" ist eine kurze, wörterbuchartige Angabe — ein Wort oder eine kurze Wortgruppe,
kein ganzer Satz. Erfinde keine Wörter und verändere niemals die Schreibweise.
{sentenceRule}
```

## User prompt

```
{context}

Ziel-Level (nur als Schwierigkeitsmaß, nicht als Wortliste): {level}
Anzahl gewünschter Wörter: {count}

Gib das JSON-Array mit bis zu {count} Wörtern außerhalb der HSK-Stufen 1 bis {level} zurück. Lieber
weniger Wörter als erfundene oder zu einfache.{sentenceReminder}
```

## Variables

- `sourceRule` — the one rule that differs between the two video kinds: for a
  Chinese transcript, only words that occur verbatim in the given excerpt; for a
  non-Chinese video, words that fit the topic (nothing anchors them, so this
  path trades verifiability for topical breadth — a deliberate choice).
- `context` — the transcript excerpt (Chinese video) or the
  `Titel/Beschreibung/Transkript-Auszug` summary (non-Chinese video), built by
  `background.js`.
- `level` — human-readable level label, e.g. `"HSK 3"`.
- `scriptLabel` — `"vereinfachten Zeichen"` or `"traditionellen Zeichen"`, from
  the user's script setting. `word` stays as-is so the code can verify it
  against the transcript; `hanzi` is what ends up on the card.
- `count` — requested number of words (10-50).
- `targetLanguage` — `"Deutsch"` or `"Englisch"`, from the user's `uiLanguage`.
- `sentenceFields`, `sentenceRule`, `sentenceReminder` — the Case B fragments
  from `background.js`, for both video kinds: the words are unknown before the
  call, so `extractContextSentence` cannot supply a sentence up front and the
  model has to return one. Unlike Case A, that sentence is therefore model
  output, length-capped only.
