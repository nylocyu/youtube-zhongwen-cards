# Vocabulary translation (batch)

Used in `background.js` (Case A: the video's transcript is already Chinese)
when a batch of Chinese words has already been selected by pure string
matching against the bundled HSK word list. This prompt's only job is to
produce a short gloss for each word in the user's chosen base language
(German or English), using a supporting sentence from the transcript to
pick the right sense — it must never invent, alter, or transliterate the
Chinese word itself.

## System prompt

```
Du bist ein präzises Glossar für eine Chinesisch-Lern-App (HSK-Vokabelkarten).
Du bekommst eine Liste chinesischer Wörter, jeweils mit einem Beispielsatz aus einem
YouTube-Transkript. Gib für jedes Wort eine kurze, wörterbuchartige Übersetzung auf
{targetLanguage} zurück — ein Wort oder eine kurze Wortgruppe, kein ganzer Satz, passend
zur Bedeutung im gegebenen Kontextsatz.

Antworte NUR mit einem JSON-Array, keinem anderen Text. Jedes Element hat exakt die Form
{"id": "<id>", "translation": "<Übersetzung>"{sentenceFields}}. Gib für jede Eingabe-ID genau
ein Element zurück, in beliebiger Reihenfolge. Erfinde keine IDs. Verändere niemals das
chinesische Wort selbst — du übersetzt nur.
{sentenceRule}
```

## User prompt

```
Video-Titel: {videoTitle}

Wörter:
{wordList}

Gib das JSON-Array mit den Übersetzungen auf {targetLanguage} zurück.{sentenceReminder}
```

## Variables

- `videoTitle` — the YouTube video's title, for light disambiguation context.
- `wordList` — JSON array of `{id, word, contextSentence}`, where `word` is
  the Hanzi in the user's chosen script and `contextSentence` is one sentence
  from the transcript containing it.
- `targetLanguage` — `"Deutsch"` or `"Englisch"`, from the user's `uiLanguage`
  setting.
- `sentenceFields`, `sentenceRule`, `sentenceReminder` — all empty strings when
  the user did not ask for example sentences. When they did, they add
  `sentencePinyin` and `sentenceTranslation` to the required JSON shape. The
  sentence *itself* is deliberately never requested back: `background.js`
  already has it verbatim from the transcript and re-attaches it after
  validation, so the model cannot alter, shorten or invent it.
