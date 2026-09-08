# 詞 — Chinese Flashcards for YouTube™

**[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/pepinhonjmmfbfdllnlfcoadhjemihac)**

Chrome extension (Manifest V3, no build step) that turns YouTube videos into
HSK-graded Chinese vocabulary flashcards and exports them as a TSV file for
Anki import.

Like [youtube-digest](https://github.com/zarazhangrui/youtube-digest), the
project this extension takes its architecture from, this is a
**bring-your-own-key** project: no server of ours, no analytics, no account
system. You need two API keys of your own (Supadata for transcripts, Anthropic
for translation), stored locally in Chrome. Transcript text plus the video's
title and description are sent directly to Supadata and Anthropic respectively
— details in [PRIVACY.md](PRIVACY.md).

Not affiliated with, endorsed by, or sponsored by Google or YouTube. YouTube is
a trademark of Google LLC.

## How it works

1. On a YouTube video with captions, open the side panel — either via the
   injected "詞" button next to Like/Share, or via the extension icon.
2. Pick your **HSK level** (1–6, or 7 for the merged advanced 7–9 band), the
   **script** (simplified/traditional) and the **number** of words (10–50).
   Optionally turn on **example sentences** — each card then also gets a
   sentence with pinyin and translation.
3. If the video is in Chinese, the vocabulary is extracted from the transcript
   by direct string matching (no AI call needed) — only the translation comes
   from Claude.
4. If the video is not in Chinese, Claude picks words of the chosen level that
   fit the video's topic (always from the official HSK word list, never
   invented) and translates them.
5. With example sentences enabled, the sentence for Chinese videos is taken
   **verbatim from the transcript** (Claude only supplies its pinyin and
   translation and cannot alter the sentence itself). Non-Chinese videos
   contain no Chinese sentence to quote, so Claude generates one that fits the
   topic at the chosen level.
6. Export as a `.tsv` file for Anki — see [Anki setup](#anki-setup) for the
   note type to import it into.

The interface and the card translations default to **English**; German can be
selected under Base language on the options page.

## Anki setup

The export is a plain UTF-8, tab-separated file with **no header row**. Every
row is a card. Tabs and line breaks inside a field are collapsed to spaces
before export, so there is no quoting to worry about.

| Column | Field | Present |
| --- | --- | --- |
| 1 | Hanzi | always |
| 2 | Pinyin | always |
| 3 | Translation | always |
| 4 | Sentence | only with example sentences enabled |
| 5 | SentencePinyin | only with example sentences enabled |
| 6 | SentenceTranslation | only with example sentences enabled |

A file has either three or six columns throughout — never a mix.

### Why a custom note type

Anki's built-in **Basic** note type has two fields (Front/Back), so it cannot
hold three, let alone six. Create this note type once and every export from
every video imports into it, with or without sentences.

**Tools → Manage Note Types → Add → Add: Basic → OK**, name it `Chinese
Vocabulary`. Then, with it selected:

**Fields…** — make the list exactly these six, in this order (rename `Front`
and `Back`, then add four more):

```
Hanzi
Pinyin
Translation
Sentence
SentencePinyin
SentenceTranslation
```

Order matters — the import maps by position, not by name. Leave *Sort by this
field* on `Hanzi`.

**Cards…** — front template:

```html
<div class="hanzi">{{Hanzi}}</div>
```

Back template:

```html
{{FrontSide}}
<hr id="answer">
<div class="pinyin">{{Pinyin}}</div>
<div class="meaning">{{Translation}}</div>

{{#Sentence}}
<hr>
<div class="sentence">{{Sentence}}</div>
<div class="pinyin">{{SentencePinyin}}</div>
<div class="meaning">{{SentenceTranslation}}</div>
{{/Sentence}}
```

The `{{#Sentence}}…{{/Sentence}}` wrapper is what makes one note type serve
both exports: with a three-column file those fields stay empty and the whole
block simply doesn't render.

Styling:

```css
.card {
  font-family: "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  text-align: center;
  background: #fff;
  color: #222;
}
.hanzi { font-size: 64px; line-height: 1.3; }
.sentence { font-size: 28px; line-height: 1.5; margin: 8px 0; }
.pinyin { font-size: 20px; color: #666; }
.meaning { font-size: 22px; margin-top: 4px; }
```

If you also want to be tested in the other direction (meaning → characters),
add a second card template with `{{Translation}}` on the front and `{{Hanzi}}`
on the back. Anki then generates two cards per note.

### Importing an export

**File → Import**, pick the `.tsv`, then in the dialog:

- **Notetype**: `Chinese Vocabulary`
- **Deck**: whichever you use (a single `Chinese` deck works well — the HSK
  level is a property of the word, not of the deck)
- **Existing notes**: *Update* — the first field, `Hanzi`, is the key, so a word
  that shows up in a second video updates its note instead of creating a
  duplicate
- **Field separator**: Tab (auto-detected)
- **Allow HTML in fields**: off — the content is plain text
- **First row is field names**: off — there is no header, so the first row is a
  real card

Check the field mapping shows `Hanzi → Hanzi`, `Pinyin → Pinyin` and so on.
Anki remembers the last mapping, so re-check it the first time you switch
between a three-column and a six-column export.

To keep levels separate, import into one deck and add a tag per import
(`hsk4`, or the video's name) rather than creating a deck per video.

## Installation

For normal use, install it from the
[Chrome Web Store](https://chromewebstore.google.com/detail/pepinhonjmmfbfdllnlfcoadhjemihac). To run it from source:

1. Run `npm run prepare-data` once (downloads the MIT-licensed HSK word list
   and generates `data/hsk-*.json` — these files are already committed, so this
   is only needed when the source data changes).
2. In Chrome: open `chrome://extensions`, enable **Developer mode**, click
   **Load unpacked** and select this project folder.
3. Pin it to the toolbar from the extensions menu (optional).

## Setting up API keys

- **Supadata** (transcripts): create an account at
  [dash.supadata.ai](https://dash.supadata.ai/auth/sign-up) and copy the key
  from the dashboard.
- **Anthropic** (translation/topic selection): create a key at
  [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).
  The default model is `claude-sonnet-5` at low effort, which suits this simple,
  structured task.

Enter both keys via the gear icon in the side panel, or on the extension's
options page.

## HSK data

`data/hsk-*.json` is generated by `scripts/prepare-data.js` from
[drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary)
(MIT licence), following the current HSK 3.0 banding (`newest-*` tags in the
source). Level 7 stands for the merged advanced 7–9 band. Dictionary glosses
(CC-CEDICT, CC BY-SA) are deliberately not bundled — the translation always
comes from Claude, out of the video's own context.

**TOCFL is not supported.** The official Taiwanese TOCFL word list (NAER) is
explicitly copyrighted ("版權所有 / All rights reserved"), and none of the
GitHub mirrors checked carry a recognisable open licence. Before TOCFL could be
added, that would have to be resolved legally — for example by asking NAER
directly, or by using it only locally without publishing the repo.

## Trust model for AI responses

Hanzi spelling, pinyin and HSK level **always** come from the bundled data,
never from the language model. Every word id the model returns is checked
against the actual candidate list — words that aren't found (hallucinations)
are discarded. Only the translation comes from the model. See
`validateAndRebuildVocabResponse()` in [vocab-lib.js](vocab-lib.js).

## Development

```bash
npm test            # unit tests (node --test)
npm run check       # release checks (file allowlist, credential scan, tests)
npm run package     # builds dist/youtube-zhongwen-cards-vX.Y.Z.zip
```

`store-assets/` holds the Chrome Web Store listing images and the scripts that
generate them; see [store-assets/README.md](store-assets/README.md). Those files
are not part of the shipped extension.

## Personal project

This is a personal remix project, not a community project — just like
[youtube-digest](https://github.com/zarazhangrui/youtube-digest), whose
structure it follows. Issues and pull requests are not accepted. If you want to
change or extend something, fork the repo and adapt it yourself (a coding agent
makes short work of it).

## Licence

MIT for the extension code, see [LICENSE](LICENSE). Details on the bundled HSK
data above.
