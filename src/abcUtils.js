import abcjs from 'abcjs';

// ---------- Header fields ----------

export function getField(abc, letter) {
  const re = new RegExp(`^${letter}:[ \\t]*(.*)$`, 'm');
  const m = abc.match(re);
  return m ? m[1].trim() : '';
}

export function getFields(abc, letter) {
  const re = new RegExp(`^${letter}:[ \\t]*(.*)$`, 'gm');
  return [...abc.matchAll(re)].map((m) => m[1].trim());
}

/** Replace (or insert into the header) a single-line field such as T:, C:, G:. */
export function setField(abc, letter, value) {
  const re = new RegExp(`^${letter}:.*$`, 'm');
  if (re.test(abc)) {
    return value ? abc.replace(re, `${letter}:${value}`) : abc.replace(new RegExp(`^${letter}:.*\\r?\\n?`, 'm'), '');
  }
  if (!value) return abc;
  // Insert before K: (the last header line), or after X:.
  const k = abc.match(/^K:.*$/m);
  if (k) return abc.slice(0, k.index) + `${letter}:${value}\n` + abc.slice(k.index);
  return `${letter}:${value}\n` + abc;
}

export function lyricsText(abc) {
  return getFields(abc, 'w').concat(getFields(abc, 'W'))
    .join(' ')
    .replace(/[-_*~|]+/g, (s) => (s.includes('~') ? ' ' : ''))
    .replace(/\s+/g, ' ')
    .trim();
}

export function songMeta(abc) {
  const titles = getFields(abc, 'T');
  return {
    title: titles[0] || 'Untitled',
    subtitle: titles[1] || '',
    composer: getField(abc, 'C'),
    category: getField(abc, 'G'),
    key: getField(abc, 'K'),
    meter: getField(abc, 'M'),
    lyrics: lyricsText(abc),
  };
}

// ---------- Key signatures & pitch spelling ----------

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const MAJOR_FIFTHS = { Cb: -7, Gb: -6, Db: -5, Ab: -4, Eb: -3, Bb: -2, F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7 };
const MODE_OFFSET = { maj: 0, ion: 0, min: -3, m: -3, aeo: -3, dor: -2, phr: -4, lyd: 1, mix: -1, loc: -5 };

/** Number of sharps (positive) or flats (negative) for an ABC K: value. */
export function keyFifths(k) {
  const m = (k || 'C').trim().match(/^([A-Ga-g])([#b]?)\s*([A-Za-z]*)/);
  if (!m) return 0;
  const tonic = m[1].toUpperCase() + m[2];
  const mode = (m[3] || '').toLowerCase().slice(0, 3);
  const off = MODE_OFFSET[mode] ?? MODE_OFFSET[mode.slice(0, 1)] ?? 0;
  const order = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  // Fifths of the tonic as a major key, then shift by mode.
  let base = MAJOR_FIFTHS[tonic];
  if (base === undefined) {
    const idx = order.indexOf(tonic[0]) - 1;
    base = idx + (tonic[1] === '#' ? 7 : tonic[1] === 'b' ? -7 : 0);
  }
  return base + off;
}

/** Map letter -> alteration (-1, 0, 1) implied by the key signature. */
export function keyAccidentals(k) {
  const f = keyFifths(k);
  const acc = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  if (f > 0) SHARP_ORDER.slice(0, f).forEach((l) => { acc[l] = 1; });
  if (f < 0) SHARP_ORDER.slice().reverse().slice(0, -f).forEach((l) => { acc[l] = -1; });
  return acc;
}

const LETTER_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** ABC pitch for a letter in a given octave (4 = middle C octave). */
function letterOctave(letter, octave) {
  if (octave >= 5) return letter.toLowerCase() + "'".repeat(octave - 5);
  return letter + ','.repeat(Math.max(0, 4 - octave));
}

/**
 * Spell a MIDI pitch as ABC, honoring the key signature so the note sounds right.
 * preferFlats is used for black keys when the key has no opinion.
 */
export function midiToAbc(midi, keyAcc = keyAccidentals('C'), preferFlats = false) {
  const pc = ((midi % 12) + 12) % 12;
  // 1. A letter whose key-signature alteration already produces the pitch.
  for (const l of LETTERS) {
    if ((LETTER_SEMI[l] + keyAcc[l] + 12) % 12 === pc) {
      const oct = Math.floor((midi - keyAcc[l]) / 12) - 1;
      return letterOctave(l, oct);
    }
  }
  // 2. Needs an explicit accidental.
  const candidates = [];
  for (const l of LETTERS) {
    for (const alt of [0, 1, -1]) {
      if ((LETTER_SEMI[l] + alt + 12) % 12 === pc) candidates.push({ l, alt });
    }
  }
  candidates.sort((a, b) => {
    const score = (c) => (c.alt === 0 ? 0 : (c.alt === -1) === preferFlats ? 1 : 2);
    return score(a) - score(b);
  });
  const { l, alt } = candidates[0];
  const prefix = alt === 1 ? '^' : alt === -1 ? '_' : '=';
  const oct = Math.floor((midi - alt) / 12) - 1;
  return prefix + letterOctave(l, oct);
}

/** Conventional spelling of a black key: B♭/E♭ unless deep in sharp keys, F♯/C♯ unless deep in flat keys. */
export function preferFlats(midi, fifths) {
  const pc = ((midi % 12) + 12) % 12;
  if (pc === 10 || pc === 3) return fifths < 4;
  if (pc === 6 || pc === 1) return fifths <= -4;
  return fifths < 0; // G♯/A♭
}

export function midiName(midi) {
  const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  return names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

// ---------- Durations ----------

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

/** Unit note length (L:) as a fraction of a whole note. */
export function unitLength(abc) {
  const l = getField(abc, 'L');
  const m = l.match(/(\d+)\s*\/\s*(\d+)/);
  if (m) return Number(m[1]) / Number(m[2]);
  return 1 / 8;
}

/** ABC duration suffix for `len` (fraction of whole note) given unit length `unit`. */
export function durationSuffix(len, unit) {
  // Work in 1/64ths to stay integral (dotted 16ths are the finest we need).
  let num = Math.round(len * 64);
  let den = Math.round(unit * 64);
  const g = gcd(num, den);
  num /= g; den /= g;
  if (den === 1) return num === 1 ? '' : String(num);
  if (num === 1 && den === 2) return '/';
  if (num === 1) return `/${den}`;
  return `${num}/${den}`;
}

// ---------- Melody extraction (for pattern search) ----------

/**
 * Returns an array of voices; each voice is [{ midi, startChar, start }] with tied
 * continuation notes removed and only the top note of chords kept.
 */
export function extractVoices(abc) {
  let tune;
  try {
    tune = abcjs.parseOnly(abc)[0];
  } catch (e) {
    return [];
  }
  if (!tune || !tune.lines || !tune.lines.length) return [];
  let audio;
  try {
    audio = tune.setUpAudio({});
  } catch (e) {
    return [];
  }
  const voices = [];
  for (const track of audio.tracks) {
    const notes = track.filter((ev) => ev.cmd === 'note' && ev.volume > 0 && ev.instrument !== 128);
    if (!notes.length) continue;
    // Group by start time to collapse chords to their top note.
    const byStart = new Map();
    for (const n of notes) {
      const key = Math.round(n.start * 10000);
      const prev = byStart.get(key);
      if (!prev || n.pitch > prev.pitch) byStart.set(key, n);
    }
    const seq = [...byStart.values()].sort((a, b) => a.start - b.start)
      .map((n) => ({ midi: n.pitch, startChar: n.startChar, start: n.start, duration: n.duration }));
    voices.push(seq);
  }
  return voices;
}

export const NEW_SONG_TEMPLATE = `X:1
T:Нова пісня
C:
G:
M:4/4
L:1/4
Q:1/4=90
K:C
C D E F | G2 G2 | A A A A | G4 |]
w: До ре мі фа соль соль ля ля ля ля соль
`;
