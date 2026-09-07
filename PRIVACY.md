# Privacy

詞 is a bring-your-own-key browser extension. It has no
backend server of its own, no account system, and does not collect
analytics or telemetry. This document describes exactly what data goes
where.

## Stored locally, on your device

Stored in Chrome's local extension storage (`chrome.storage.local`), never
`sync`, so it does not propagate to your other signed-in Chrome profiles:

- Your Supadata and Anthropic API keys.
- Your default HSK level, script (simplified/traditional), and vocabulary
  count preferences.
- A cache of recent transcripts and generated vocabulary cards, per video,
  to avoid repeat API calls. Expires automatically after 30 days.

Nothing here is sent to the extension's developer. There is no server to
send it to.

## Sent to Supadata

To fetch a video's transcript, the extension sends the canonical YouTube
watch URL (`https://www.youtube.com/watch?v=<videoId>`) to Supadata's API,
along with your Supadata API key for authentication. See
[Supadata's own privacy policy](https://supadata.ai/) for how they handle
this.

## Sent to Anthropic

To translate vocabulary or select topically relevant words, the extension
sends your Anthropic API key plus, depending on the situation:

- If the video's transcript is already Chinese: the selected Chinese words
  and one supporting sentence per word from the transcript, for translation
  into your chosen base language (German or English, set in Options).
- If the video is not in Chinese: the video's title, a truncated excerpt of
  its description and transcript, and the candidate HSK word list for your
  chosen level — so Claude can pick topically relevant words and translate
  them.

See [Anthropic's privacy policy](https://www.anthropic.com/legal/privacy)
for how they handle this. Anthropic's response is never trusted outright —
see the "Vertrauensmodell für KI-Antworten" section in
[README.md](README.md) for how the extension validates it before showing
you a card.

## Not sent anywhere else

No analytics, telemetry, crash reporting, or third-party trackers are
included. The only network requests this extension makes are the ones
described above, to the two providers you configured yourself.
