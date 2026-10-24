import { unzipSync, strFromU8 } from 'fflate';
import { durationSuffix } from './abcUtils.js';

// MusicXML -> ABC converter for hymn-style scores (melody or SATB, with lyrics).
// Handles: multiple parts/staves/voices, chords, rests, ties, dots, tuplets, key/time
// changes, repeats, voltas, lyrics (several verses), clefs, tempo.

const UNIT = 1 / 8; // L:1/8
const TYPE_LEN = {
  maxima: 8, long: 4, breve: 2, whole: 1, half: 1 / 2, quarter: 1 / 4, eighth: 1 / 8,
  '16th': 1 / 16, '32nd': 1 / 32, '64th': 1 / 64,
};
const MAJOR = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const MINOR = ['Abm', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm', 'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m'];
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];

const child = (el, name) => (el ? [...el.children].find((c) => c.localName === name) || null : null);
const children = (el, name) => (el ? [...el.children].filter((c) => c.localName === name) : []);
const text = (el, name) => {
  const c = name ? child(el, name) : el;
  return c ? c.textContent.trim() : '';
};

function keyName(fifths, mode) {
  const i = Math.max(-7, Math.min(7, fifths)) + 7;
  return mode === 'minor' ? MINOR[i] : MAJOR[i];
}

function keyAlterMap(fifths) {
  const acc = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  if (fifths > 0) SHARP_ORDER.slice(0, fifths).forEach((l) => { acc[l] = 1; });
  if (fifths < 0) SHARP_ORDER.slice().reverse().slice(0, -fifths).forEach((l) => { acc[l] = -1; });
  return acc;
}

function clefName(sign, line) {
  if (sign === 'F') return 'bass';
  if (sign === 'C') return line === '4' ? 'tenor' : 'alto';
  if (sign === 'percussion') return 'perc';
  return 'treble';
}

function pitchToAbc(step, octave) {
  if (octave >= 5) return step.toLowerCase() + "'".repeat(octave - 5);
  return step + ','.repeat(Math.max(0, 4 - octave));
}

function accidentalPrefix(alter) {
  return { 2: '^^', 1: '^', 0: '=', '-1': '_', '-2': '__' }[alter] ?? '';
}

function lyricToken(lyr) {
  let t = children(lyr, 'text').map((n) => n.textContent).join('').trim();
  t = t.replace(/\s+/g, '~').replace(/-/g, '\\-') || '*';
  const syl = text(lyr, 'syllabic');
  const extend = !!child(lyr, 'extend');
  return { t, hyphen: syl === 'begin' || syl === 'middle', extend };
}

/** Read a File (.musicxml/.xml/.mxl) and return its XML text. */
export async function readMusicXmlFile(file) {
  if (/\.mxl$/i.test(file.name)) {
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
    let rootPath = null;
    if (files['META-INF/container.xml']) {
      const m = strFromU8(files['META-INF/container.xml']).match(/full-path="([^"]+)"/);
      if (m) rootPath = m[1];
    }
    if (!rootPath || !files[rootPath]) {
      rootPath = Object.keys(files).find((p) => !p.startsWith('META-INF') && /\.(xml|musicxml)$/i.test(p));
    }
    if (!rootPath) throw new Error('No score found inside .mxl');
    return strFromU8(files[rootPath]);
  }
  return file.text();
}

export function musicXmlToAbc(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid XML');
  const score = doc.documentElement;
  if (score.localName === 'score-timewise') throw new Error('score-timewise MusicXML is not supported; export as partwise');

  const title = text(child(score, 'work'), 'work-title') || text(score, 'movement-title')
    || [...score.querySelectorAll('credit-words')].map((c) => c.textContent.trim()).find(Boolean) || 'Imported';
  const composer = [...score.querySelectorAll('identification creator')]
    .filter((c) => (c.getAttribute('type') || 'composer') === 'composer').map((c) => c.textContent.trim()).join(', ');
  const lyricist = [...score.querySelectorAll('identification creator[type="lyricist"]')].map((c) => c.textContent.trim()).join(', ');

  const partNames = {};
  children(child(score, 'part-list'), 'score-part').forEach((sp) => {
    partNames[sp.getAttribute('id')] = text(sp, 'part-name');
  });

  let globalKey = null;
  let globalMeter = null;
  let tempo = null;
  const voices = []; // { id, name, clef, partIdx, staff, measures: [string], lyrics: {verse: [[tokens per measure]]} }
  const systemBreaks = new Set();

  children(score, 'part').forEach((part, partIdx) => {
    const pid = part.getAttribute('id');
    let divisions = 1;
    let fifths = 0;
    let meterLen = 1; // measure length as fraction of whole
    const clefs = {}; // staff -> clef
    const partVoices = new Map(); // key "staff/voice" -> voice object
    const measures = children(part, 'measure');

    const getVoice = (staff, v) => {
      const key = `${staff}/${v}`;
      if (!partVoices.has(key)) {
        const obj = {
          name: partNames[pid] || '',
          clef: clefs[staff] || 'treble',
          partIdx, staff, voiceNo: v,
          measures: new Array(measures.length).fill(null),
          lyrics: {},
        };
        partVoices.set(key, obj);
      }
      return partVoices.get(key);
    };

    measures.forEach((measure, mi) => {
      let measurePrefix = '';
      let leftBar = '';
      let rightBar = '|';
      const events = new Map(); // voice key -> [{abc, lyric tokens}]
      const altState = new Map(); // voice key -> {stepOctave: alter}
      const voiceKeyOf = (n) => `${Number(text(n, 'staff') || 1)}/${text(n, 'voice') || '1'}`;

      if (child(measure, 'print')?.getAttribute('new-system') === 'yes' && mi > 0) systemBreaks.add(mi);

      for (const el of measure.children) {
        const name = el.localName;
        if (name === 'attributes') {
          if (child(el, 'divisions')) divisions = Number(text(el, 'divisions')) || 1;
          const key = child(el, 'key');
          if (key && child(key, 'fifths')) {
            const f = Number(text(key, 'fifths'));
            const kn = keyName(f, text(key, 'mode'));
            if (mi === 0 && globalKey === null) globalKey = kn;
            else if (f !== fifths || mi > 0) measurePrefix += `[K:${kn}]`;
            fifths = f;
          }
          const time = child(el, 'time');
          if (time) {
            const beats = text(time, 'beats');
            const bt = text(time, 'beat-type');
            const sym = time.getAttribute('symbol');
            const m = sym === 'common' ? 'C' : sym === 'cut' ? 'C|' : `${beats}/${bt}`;
            meterLen = Number(beats.split('+').reduce((a, b) => a + Number(b), 0)) / Number(bt);
            if (mi === 0 && globalMeter === null) globalMeter = m;
            else measurePrefix += `[M:${m}]`;
          }
          children(el, 'clef').forEach((c) => {
            const staff = Number(c.getAttribute('number') || 1);
            clefs[staff] = clefName(text(c, 'sign'), text(c, 'line'));
          });
        } else if (name === 'direction') {
          const sound = child(el, 'sound');
          if (sound && sound.getAttribute('tempo') && tempo === null) tempo = Math.round(Number(sound.getAttribute('tempo')));
        } else if (name === 'sound' && el.getAttribute('tempo') && tempo === null) {
          tempo = Math.round(Number(el.getAttribute('tempo')));
        } else if (name === 'barline') {
          const loc = el.getAttribute('location') || 'right';
          const repeat = child(el, 'repeat');
          const ending = child(el, 'ending');
          const style = text(el, 'bar-style');
          if (loc === 'left') {
            if (repeat && repeat.getAttribute('direction') === 'forward') leftBar = '|:';
            if (ending && ending.getAttribute('type') === 'start') leftBar += `[${ending.getAttribute('number').split(',')[0].trim()} `;
          } else {
            if (repeat && repeat.getAttribute('direction') === 'backward') rightBar = ':|';
            else if (style === 'light-heavy') rightBar = '|]';
            else if (style === 'light-light') rightBar = '||';
          }
        } else if (name === 'forward') {
          const vk = voiceKeyOf(el);
          const dur = Number(text(el, 'duration')) / divisions / 4;
          if (!events.has(vk)) events.set(vk, []);
          events.get(vk).push({ abc: `x${durationSuffix(dur, UNIT)}` });
        } else if (name === 'note') {
          if (child(el, 'grace') || child(el, 'cue')) continue;
          const vk = voiceKeyOf(el);
          if (!events.has(vk)) events.set(vk, []);
          if (!altState.has(vk)) altState.set(vk, {});
          const list = events.get(vk);
          const isChord = !!child(el, 'chord');
          const isRest = !!child(el, 'rest');

          // Duration: prefer the written type (exact with tuplets); fall back to <duration>.
          const tm = child(el, 'time-modification');
          let len;
          const type = text(el, 'type');
          if (type && TYPE_LEN[type]) {
            len = TYPE_LEN[type];
            const dots = children(el, 'dot').length;
            if (dots === 1) len *= 1.5;
            if (dots === 2) len *= 1.75;
          } else {
            len = Number(text(el, 'duration')) / divisions / 4;
            if (tm) len = len * Number(text(tm, 'actual-notes')) / Number(text(tm, 'normal-notes'));
          }
          if (isRest && child(el, 'rest')?.getAttribute('measure') === 'yes') len = meterLen;

          let token;
          if (isRest) {
            token = (el.getAttribute('print-object') === 'no' ? 'x' : 'z') + durationSuffix(len, UNIT);
          } else {
            const p = child(el, 'pitch');
            const step = text(p, 'step');
            const octave = Number(text(p, 'octave'));
            const alter = Math.round(Number(text(p, 'alter') || 0));
            const st = altState.get(vk);
            const k = step + octave;
            const current = k in st ? st[k] : keyAlterMap(fifths)[step];
            let acc = '';
            if (alter !== current) { acc = accidentalPrefix(alter); st[k] = alter; }
            token = acc + pitchToAbc(step, octave);
          }
          const ties = children(el, 'tie').map((tie) => tie.getAttribute('type'));
          const tieStart = ties.includes('start');
          const tieStop = ties.includes('stop');
          const notations = child(el, 'notations');
          const tuplet = children(notations, 'tuplet').find((tp) => tp.getAttribute('type') === 'start');
          const slurStart = children(notations, 'slur').some((s) => s.getAttribute('type') === 'start');
          const slurStop = children(notations, 'slur').some((s) => s.getAttribute('type') === 'stop');
          const fermata = !!child(notations, 'fermata');

          if (isChord && list.length) {
            const prev = list[list.length - 1];
            prev.chord.push(token + (tieStart ? '-' : ''));
          } else {
            const lyrics = {};
            children(el, 'lyric').forEach((lyr) => {
              const verse = lyr.getAttribute('number') || '1';
              lyrics[verse] = lyricToken(lyr);
            });
            list.push({
              chord: [token + (tieStart ? '-' : '')],
              len,
              rest: isRest,
              tieStop,
              lyrics,
              pre: (tuplet && tm ? `(${text(tm, 'actual-notes')}` : '') + (slurStart ? '(' : '') + (fermata ? 'H' : ''),
              post: slurStop ? ')' : '',
            });
          }
        }
      }

      // Every known voice gets something for this measure (rests if silent).
      for (const vk of events.keys()) {
        const [staff, v] = vk.split('/');
        getVoice(Number(staff), v);
      }
      for (const [vk, voice] of partVoices) {
        const list = events.get(vk);
        let body;
        if (!list || !list.length) {
          body = `z${durationSuffix(meterLen, UNIT)}`;
        } else {
          body = list.map((e) => {
            if (!e.chord) return e.abc;
            const notes = e.chord.length > 1 ? `[${e.chord.join('')}]` : e.chord[0];
            const dur = durationSuffix(e.len, UNIT);
            // A tie mark placed on a single note goes after the duration.
            const n = e.chord.length > 1 ? notes + dur : notes.replace(/-$/, '') + dur + (notes.endsWith('-') ? '-' : '');
            return e.pre + n + e.post;
          }).join(' ');
          // Lyrics: one token per sung note (not rests).
          // abcjs aligns a syllable to tied continuation notes too, so those get "_".
          const sung = list.filter((e) => e.chord && !e.rest);
          const verses = new Set(sung.flatMap((e) => Object.keys(e.lyrics)));
          for (const verse of verses) {
            if (!voice.lyrics[verse]) voice.lyrics[verse] = new Array(measures.length).fill(null);
            let held = false;
            voice.lyrics[verse][mi] = sung.map((e) => {
              const l = e.lyrics[verse];
              if (e.tieStop && !l) return '_';
              if (!l) return held ? '_' : '*';
              held = l.extend;
              return l.t + (l.hyphen ? '-' : '');
            });
          }
        }
        voice.measures[mi] = `${leftBar}${measurePrefix}${body} ${rightBar}`;
      }
    });
    partVoices.forEach((v) => voices.push(v));
  });

  if (!voices.length) throw new Error('No notes found');
  voices.forEach((v, i) => { v.id = String(i + 1); });

  // Line breaks: follow the original systems, else every 4 measures.
  const nMeasures = voices[0].measures.length;
  const lines = [];
  let start = 0;
  for (let i = 1; i <= nMeasures; i++) {
    const brk = systemBreaks.size ? systemBreaks.has(i) : i % 4 === 0;
    if (brk || i === nMeasures) { lines.push([start, i]); start = i; }
  }

  // Fill in missing measures (voices that appear mid-piece).
  voices.forEach((v) => {
    v.measures = v.measures.map((m) => m || 'z8 |');
    if (!v.clef) v.clef = 'treble';
  });

  const out = ['X:1', `T:${title}`];
  if (composer) out.push(`C:${composer}`);
  if (lyricist) out.push(`C:${lyricist}`);
  out.push(`M:${globalMeter || '4/4'}`, 'L:1/8');
  if (tempo) out.push(`Q:1/4=${tempo}`);

  const multi = voices.length > 1;
  if (multi) {
    // Voices from the same part and staff share a staff.
    const groups = [];
    voices.forEach((v) => {
      const g = groups.find((x) => x.partIdx === v.partIdx && x.staff === v.staff);
      if (g) g.ids.push(v.id); else groups.push({ partIdx: v.partIdx, staff: v.staff, ids: [v.id] });
    });
    out.push(`%%score ${groups.map((g) => (g.ids.length > 1 ? `(${g.ids.join(' ')})` : g.ids[0])).join(' ')}`);
    voices.forEach((v) => {
      out.push(`V:${v.id} clef=${v.clef}${v.name && v.voiceNo === '1' ? ` name="${v.name.replace(/"/g, '')}"` : ''}`);
    });
  }
  out.push(`K:${globalKey || 'C'}${!multi && voices[0].clef !== 'treble' ? ` clef=${voices[0].clef}` : ''}`);

  const verseLines = (v, a, b) => Object.keys(v.lyrics).sort().map((verse) => {
    const toks = v.lyrics[verse].slice(a, b).map((m) => (m ? m.join(' ') : '')).filter((s) => s !== null);
    const line = toks.join(' | ').replace(/-\s+/g, '-').trim();
    return line.replace(/[|\s*]/g, '') ? `w: ${line}` : null;
  }).filter(Boolean);

  for (const [a, b] of lines) {
    voices.forEach((v) => {
      if (multi) out.push(`[V:${v.id}] ${v.measures.slice(a, b).join(' ')}`);
      else out.push(v.measures.slice(a, b).join(' '));
      out.push(...verseLines(v, a, b));
    });
  }
  return out.join('\n') + '\n';
}
