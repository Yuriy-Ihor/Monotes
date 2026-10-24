# Monotes

A web app for a library of church songs in staff notation: play a song, start
from any note, transpose, change tempo and instrument, search songs by melody,
and write or import your own songs.

Live site: https://yuriy-ihor.github.io/Monotes/

## Adding songs to the library

Each song is one [ABC notation](https://abcnotation.com/learn) file in
`src/songs/`. Every `.abc` file there is built into the app automatically.

Useful header fields:

| Field | Meaning |
|-------|---------|
| `T:`  | Title (a second `T:` is a subtitle) |
| `C:`  | Composer / author |
| `G:`  | Category shown as a filter chip in the library |
| `M:`, `L:`, `Q:`, `K:` | Meter, unit note length, tempo, key |
| `w:`  | Lyrics under the preceding music line |

Ways to get a song in:

1. **Editor** (in the app): enter notes with the on-screen piano or type ABC,
   with the original PDF/photo shown alongside. Then *Export .abc* and put the
   file into `src/songs/`.
2. **MusicXML import**: run the PDF through an OMR program such as
   [Audiveris](https://github.com/Audiveris/audiveris), then open the `.mxl` /
   `.musicxml` file in the editor. Proofread against the original.
3. **Claude**: drop PDFs into `incoming/` and ask Claude to transcribe them.

Songs created in the app without exporting are stored only in that browser
(localStorage).

## Development

```bash
npm install
npm run dev
```

`npm run build` writes the static site to `dist/`. Pushing to `main` deploys to
GitHub Pages through `.github/workflows/deploy.yml`.

Built with React, Vite and [abcjs](https://www.abcjs.net/).
