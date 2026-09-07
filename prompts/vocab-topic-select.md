# Vocabulary topic selection

Used in `background.js` (Case B: the video's transcript is NOT Chinese) to
pick HSK-level-appropriate Chinese vocabulary that relates to the video's
topic, and to gloss each selected word in the user's chosen base language
(German or English). The model must choose words ONLY from the given
candidate list (by id) — it must never invent a word or alter one's
spelling, since the app treats the candidate list, not the model, as the
source of truth for what is a real, correctly-leveled HSK word.

## System prompt

```
Du bist ein Lehrplan-Assistent für Chinesisch als Fremdsprache. Du bekommst eine
Zusammenfassung eines YouTube-Videos (das NICHT auf Chinesisch ist) und eine Liste
möglicher chinesischer HSK-Vokabeln mit ihrer ID und Pinyin-Aussprache. Wähle daraus
genau die Wörter aus, die inhaltlich am besten zum Thema des Videos passen, und gib für
jedes gewählte Wort eine kurze, wörterbuchartige Übersetzung auf {targetLanguage} passend
zum Video-Kontext zurück.

Wichtig: Wähle AUSSCHLIESSLICH Wörter aus der gegebenen Liste, referenziert über ihre ID.
Erfinde niemals eigene Wörter oder IDs, und verändere niemals die Schreibweise eines
Wortes — die Liste ist die einzige gültige Quelle. Wenn weniger als die angeforderte
Anzahl thematisch wirklich passt, wähle die am ehesten passenden aus der Liste, auch wenn
der Bezug locker ist — gib niemals weniger Elemente zurück als angefordert, außer die
Liste selbst ist kürzer.

Antworte NUR mit einem JSON-Array, keinem anderen Text. Jedes Element hat exakt die Form
{"id": "<id>", "translation": "<Übersetzung>"{sentenceFields}}.
{sentenceRule}
```

## User prompt

```
Video-Zusammenfassung:
{videoSummary}

Ziel-Level: {level}
Anzahl gewünschter Wörter: {count}

Kandidaten-Wörter (nur per ID auswählbar):
{candidateWords}

Gib das JSON-Array mit genau {count} ausgewählten Wörtern zurück.{sentenceReminder}
```

## Variables

- `videoSummary` — `Titel: {title}\nBeschreibung: {description}\nTranskript-Auszug:
  {truncated transcript}`, built by `background.js`.
- `level` — human-readable level label, e.g. `"HSK 3"`.
- `count` — requested number of words (10-50).
- `candidateWords` — JSON array of `{id, word, pinyin}` for the selected
  level/script, pre-filtered/truncated by corpus frequency to fit the token
  budget.
- `targetLanguage` — `"Deutsch"` or `"Englisch"`, from the user's `uiLanguage`
  setting.
- `sentenceFields`, `sentenceRule`, `sentenceReminder` — all empty strings when
  the user did not ask for example sentences. When they did, they additionally
  require `sentence`, `sentencePinyin` and `sentenceTranslation`. Unlike Case A,
  the sentence here *is* model-invented — a non-Chinese video contains no
  Chinese sentence to lift — so it is trusted model output, length-capped only.
