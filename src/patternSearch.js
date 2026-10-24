import { extractVoices } from './abcUtils.js';

const cache = new Map(); // song id -> { abc, voices }

function voicesFor(song) {
  const hit = cache.get(song.id);
  if (hit && hit.abc === song.abc) return hit.voices;
  const voices = extractVoices(song.abc);
  cache.set(song.id, { abc: song.abc, voices });
  return voices;
}

/**
 * Find songs containing the melody `query` (array of MIDI numbers).
 * anyKey: match the interval pattern, so the melody is found in any key.
 * allVoices: search every voice, otherwise only the first (melody) voice.
 */
export function searchMelody(songs, query, { anyKey = true, allVoices = false } = {}) {
  if (query.length < 2) return [];
  const qInt = query.slice(1).map((m, i) => m - query[i]);
  const results = [];
  for (const song of songs) {
    const voices = voicesFor(song);
    const matches = [];
    const seen = new Set();
    (allVoices ? voices : voices.slice(0, 1)).forEach((notes, v) => {
      for (let i = 0; i + query.length <= notes.length; i++) {
        let ok = true;
        for (let j = 0; j < query.length && ok; j++) {
          if (anyKey) {
            if (j > 0 && notes[i + j].midi - notes[i + j - 1].midi !== qInt[j - 1]) ok = false;
          } else if (notes[i + j].midi !== query[j]) ok = false;
        }
        if (!ok) continue;
        const chars = notes.slice(i, i + query.length).map((n) => n.startChar);
        const key = chars.join(',');
        if (seen.has(key)) continue; // repeats produce identical matches
        seen.add(key);
        matches.push({ voice: v, chars });
      }
    });
    if (matches.length) results.push({ song, matches });
  }
  return results.sort((a, b) => b.matches.length - a.matches.length);
}

/** The next `count` melody notes starting at startChar, used for "search this melody". */
export function melodyFrom(song, startChar, count = 6) {
  for (const notes of voicesFor(song)) {
    const i = notes.findIndex((n) => n.startChar === startChar);
    if (i >= 0) return notes.slice(i, i + count).map((n) => n.midi);
  }
  return [];
}

/** Parse "C D E ^F _B c" style text into MIDI numbers (key of C, no key signature). */
export function parseNoteText(text) {
  const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const out = [];
  const re = /(\^|_|=)?([A-Ga-g])([,']*)/g;
  let m;
  while ((m = re.exec(text))) {
    const letter = m[2];
    let midi = 60 + semis[letter.toUpperCase()] + (letter === letter.toLowerCase() ? 12 : 0);
    for (const c of m[3]) midi += c === "'" ? 12 : -12;
    if (m[1] === '^') midi += 1;
    if (m[1] === '_') midi -= 1;
    out.push(midi);
  }
  return out;
}
