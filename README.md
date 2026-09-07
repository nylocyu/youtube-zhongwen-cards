# 詞

Chrome-Extension (Manifest V3, kein Build-Step), die aus YouTube-Videos
HSK-Vokabelkarten mit deutscher Übersetzung erstellt und als TSV-Datei für
den Anki-Import exportiert.

Wie [youtube-digest](https://github.com/zarazhangrui/youtube-digest), das
Projekt, an dessen Architektur sich diese Extension orientiert, ist dies ein
**bring-your-own-key**-Projekt: kein eigener Server, keine Analyse, kein
Account-System. Du brauchst zwei eigene API-Keys (Supadata für Transkripte,
Anthropic für Übersetzung), die lokal in Chrome gespeichert werden. Transkript-
sowie Titel-/Beschreibungstext werden dafür direkt an Supadata bzw. Anthropic
gesendet — Details dazu in [PRIVACY.md](PRIVACY.md).

## Funktionsweise

1. Auf einem YouTube-Video mit Untertiteln öffnest du das Side Panel (über
   den injizierten "詞"-Button neben Like/Share, oder über das
   Extension-Icon).
2. Du wählst dein **HSK-Level** (1–6, oder 7 für die zusammengefasste
   fortgeschrittene Stufe 7–9), die **Schrift** (vereinfacht/traditionell)
   und die **Anzahl** Vokabeln (10–50). Optional: **Beispielsätze
   hinzufügen** — dann bekommt jede Karte zusätzlich einen Beispielsatz mit
   Pinyin und Übersetzung.
3. Ist das Video auf Chinesisch, werden die Vokabeln direkt per
   String-Abgleich aus dem Transkript extrahiert (kein KI-Aufruf nötig) —
   nur die deutsche Übersetzung kommt von Claude.
4. Ist das Video nicht auf Chinesisch, wählt Claude passende Vokabeln des
   gewählten Levels zum Thema des Videos aus (immer nur aus der offiziellen
   HSK-Wortliste, nie erfunden) und übersetzt sie.
5. Bei aktivierten Beispielsätzen stammt der Satz bei chinesischen Videos
   **wörtlich aus dem Transkript** (Claude liefert nur Pinyin und
   Übersetzung dazu und kann den Satz selbst nicht verändern); bei nicht
   chinesischen Videos gibt es keinen chinesischen Satz im Video, dort
   generiert Claude einen themenpassenden Satz auf dem gewählten Level.
6. Export als `.tsv`-Datei für den Import in Anki. Spalten in dieser
   Reihenfolge, ohne Kopfzeile: Hanzi, Pinyin, Deutsch — beim Import in Anki
   entsprechend als Felder zuordnen. Mit Beispielsätzen kommen drei weitere
   Spalten dazu: Satz, Satz-Pinyin, Satz-Übersetzung.

## Installation

1. `npm run prepare-data` einmalig ausführen (lädt die MIT-lizenzierte
   HSK-Wortliste und erzeugt `data/hsk-*.json` — diese Dateien sind bereits
   im Repo enthalten, das ist nur bei einem Update der Quelldaten nötig).
2. In Chrome: `chrome://extensions` öffnen, **Entwicklermodus** aktivieren,
   **Entpackt laden** und diesen Projektordner auswählen.
3. Über das Extensions-Menü an die Symbolleiste anheften (optional).

## API-Keys einrichten

- **Supadata** (Transkripte): Account unter
  [dash.supadata.ai](https://dash.supadata.ai/auth/sign-up) anlegen, Key aus
  dem Dashboard kopieren.
- **Anthropic** (Übersetzung/Themenauswahl): Key unter
  [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
  erstellen. Standardmodell ist `claude-sonnet-5` bei niedrigem Effort-Level
  (passend für diese einfache, strukturierte Aufgabe).

Beide Keys unter dem Zahnrad-Icon im Side Panel bzw. über die
Options-Seite der Extension eintragen.

## HSK-Daten

`data/hsk-*.json` wird von `scripts/prepare-data.js` aus
[drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary)
(MIT-Lizenz) erzeugt — der aktuellen HSK-3.0-Stufeneinteilung (`newest-*`
Tags in der Quelle). Level 7 steht für die zusammengefasste fortgeschrittene
Stufe 7–9. Wörterbuch-Bedeutungen (CC-CEDICT, CC BY-SA) werden bewusst nicht
gebündelt — die deutsche Übersetzung kommt immer aus dem Videokontext von
Claude.

**TOCFL wird aktuell nicht unterstützt.** Die offizielle taiwanesische
TOCFL-Wortliste (NAER) ist explizit urheberrechtlich geschützt
("版權所有 / All rights reserved"), und keiner der geprüften
GitHub-Mirrors hat eine erkennbare offene Lizenz — siehe Analyse im
zugehörigen Plan. Bevor TOCFL ergänzt wird, muss das rechtlich geklärt
werden (z. B. direkte Anfrage bei NAER, oder Nutzung nur lokal ohne
Veröffentlichung des Repos).

## Vertrauensmodell für KI-Antworten

Hanzi-Schreibweise, Pinyin und HSK-Level kommen **immer** aus den
gebündelten Daten, nie vom Sprachmodell. Jede Wort-ID, die das Modell
zurückgibt, wird gegen die tatsächliche Kandidatenliste geprüft — nicht
gefundene (halluzinierte) Wörter werden verworfen. Nur die deutsche
Übersetzung stammt vom Modell. Siehe `validateAndRebuildVocabResponse()` in
[vocab-lib.js](vocab-lib.js).

## Entwicklung

```bash
npm test           # Unit-Tests (node --test)
npm run check       # Release-Checks (Datei-Allowlist, Credential-Scan, Tests)
npm run package     # Baut dist/youtube-zhongwen-cards-vX.Y.Z.zip
```

## Persönliches Projekt

Dies ist ein persönliches Remix-Projekt, kein Community-Projekt — genau wie
[youtube-digest](https://github.com/zarazhangrui/youtube-digest), an dessen
Struktur es sich orientiert. Es werden keine Issues oder Pull Requests
angenommen. Wer etwas ändern oder erweitern möchte, forkt das Repo und passt
es sich selbst an (z. B. mit einem Coding-Agenten).

## Lizenz

MIT für den Extension-Code, siehe [LICENSE](LICENSE). Details zu den
gebündelten HSK-Daten siehe oben.
