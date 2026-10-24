import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../i18n.jsx';
import { deleteUserSong, getSong, saveUserSong, useLibrary } from '../library.js';
import {
  NEW_SONG_TEMPLATE, durationSuffix, getField, keyAccidentals, keyFifths, midiToAbc, preferFlats, setField, unitLength,
} from '../abcUtils.js';
import { musicXmlToAbc, readMusicXmlFile } from '../musicxml.js';
import ScoreView from '../components/ScoreView.jsx';
import PlayerBar from '../components/PlayerBar.jsx';
import PianoKeyboard from '../components/PianoKeyboard.jsx';
import ReferenceViewer from '../components/ReferenceViewer.jsx';
import { previewNote } from '../usePlayer.js';
import { navigate } from '../App.jsx';

const DURATIONS = [
  { len: 1, sym: '𝅝', label: '1' },
  { len: 1 / 2, sym: '𝅗𝅥', label: '1/2' },
  { len: 1 / 4, sym: '♩', label: '1/4' },
  { len: 1 / 8, sym: '♪', label: '1/8' },
  { len: 1 / 16, sym: '𝅘𝅥𝅯', label: '1/16' },
];

const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb',
  'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'];

function download(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// abcjs warnings are HTML snippets marking the error position; show them as plain text.
function stripHtml(html) {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent;
}

function safeFileName(s) {
  return (s || 'song').replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'song';
}

export default function EditorPage({ id }) {
  const { t } = useLang();
  const { ready } = useLibrary();
  const source = id ? getSong(id) : null;
  const isUser = !!(source && !source.builtIn);

  const [abc, setAbc] = useState(() => (source ? source.abc : NEW_SONG_TEMPLATE));
  const [savedAbc, setSavedAbc] = useState(() => (isUser ? source.abc : null));
  const [loadedFrom, setLoadedFrom] = useState(source ? source.id : null);
  const [history, setHistory] = useState([]);
  const [len, setLen] = useState(1 / 4);
  const [dotted, setDotted] = useState(false);
  const [visualObj, setVisualObj] = useState(null);
  const [selectedChar, setSelectedChar] = useState(null);
  const [transpose, setTranspose] = useState(0);
  const [reference, setReference] = useState(null);
  const [message, setMessage] = useState('');
  const textRef = useRef(null);
  const scoreRef = useRef(null);
  const fileRef = useRef(null);

  // Library songs load asynchronously; pick the song up once it arrives.
  useEffect(() => {
    if (source && loadedFrom !== source.id) {
      setAbc(source.abc);
      lastRecorded.current = source.abc;
      setSavedAbc(isUser ? source.abc : null);
      setLoadedFrom(source.id);
    }
  }, [source, loadedFrom, isUser]);

  const dirty = savedAbc === null ? abc !== (source ? source.abc : NEW_SONG_TEMPLATE) : abc !== savedAbc;
  useEffect(() => {
    const handler = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Last recorded state, so typing a word and then undoing restores the word boundary.
  const lastRecorded = useRef(abc);
  const update = (next, { record = true } = {}) => {
    if (next === abc) return;
    if (record) {
      setHistory((h) => [...h.slice(-99), lastRecorded.current]);
      lastRecorded.current = next;
    }
    setAbc(next);
  };

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    lastRecorded.current = prev;
    setAbc(prev);
  };

  // Typing: record history at word boundaries only, so undo is not per keystroke.
  const onType = (e) => {
    const next = e.target.value;
    const boundary = /[\s|]$/.test(next) || Math.abs(next.length - abc.length) > 1;
    update(next, { record: boundary });
  };

  /** Insert text at the cursor (moving out of the header into the music if needed). */
  const insert = (snippet, { spaced = true } = {}) => {
    const ta = textRef.current;
    let pos = ta ? ta.selectionStart : abc.length;
    let end = ta ? ta.selectionEnd : abc.length;
    const kLine = abc.match(/^K:.*$/m);
    const headerEnd = kLine ? kLine.index + kLine[0].length : 0;
    if (pos <= headerEnd) {
      pos = abc.length;
      end = abc.length;
    }
    // Don't insert into a lyrics line; jump to the end of the music line above it.
    const lineStart = abc.lastIndexOf('\n', pos - 1) + 1;
    if (/^[wW]:/.test(abc.slice(lineStart, lineStart + 2))) {
      pos = lineStart > 0 ? lineStart - 1 : 0;
      end = pos;
    }
    const before = abc.slice(0, pos);
    const after = abc.slice(end);
    const needSpace = spaced && before && !/[\s([]$/.test(before);
    const text = (needSpace ? ' ' : '') + snippet;
    update(before + text + after);
    const caret = pos + text.length;
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(caret, caret);
    });
  };

  const noteLen = dotted ? len * 1.5 : len;
  const durSuffix = () => durationSuffix(noteLen, unitLength(abc));

  const onPiano = (midi) => {
    previewNote(midi);
    const key = getField(abc, 'K');
    insert(midiToAbc(midi, keyAccidentals(key), preferFlats(midi, keyFifths(key))) + durSuffix());
  };

  const onNoteClick = (el) => {
    setSelectedChar(el.startChar);
    const ta = textRef.current;
    if (ta) {
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(el.startChar, el.endChar);
    }
  };

  const meta = useMemo(() => ({
    title: getField(abc, 'T'),
    composer: getField(abc, 'C'),
    category: getField(abc, 'G'),
    key: getField(abc, 'K').split(/\s/)[0],
    meter: getField(abc, 'M'),
  }), [abc]);

  const setMeta = (letter, value) => update(setField(abc, letter, value));

  const save = () => {
    const newId = saveUserSong(isUser ? source.id : null, abc);
    setSavedAbc(abc);
    setMessage(t('saved'));
    setTimeout(() => setMessage(''), 2000);
    if (!isUser) {
      setLoadedFrom(newId);
      navigate(`/edit/${newId}`);
    }
  };

  const remove = () => {
    if (!isUser || !window.confirm(t('confirmDelete'))) return;
    deleteUserSong(source.id);
    setSavedAbc(abc);
    navigate('/');
  };

  const onFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (/\.(abc|txt)$/i.test(file.name)) {
        update(await file.text());
      } else if (/\.(musicxml|xml|mxl)$/i.test(file.name)) {
        update(musicXmlToAbc(await readMusicXmlFile(file)));
      } else if (/pdf|image/.test(file.type) || /\.(pdf|png|jpe?g|gif|webp)$/i.test(file.name)) {
        setReference(file);
      } else {
        throw new Error(file.name);
      }
    } catch (err) {
      console.error(err);
      alert(`${t('convertFailed')}: ${err.message || err}`);
    }
  };

  if (id && !source && !ready) return <div className="page"><p className="muted">{t('loading')}</p></div>;
  if (id && !source && ready && loadedFrom !== id) return <div className="page"><p className="muted">{t('notFound')}</p></div>;

  const warnings = visualObj && visualObj.warnings ? visualObj.warnings : [];

  return (
    <div className={`page editor ${reference ? 'with-reference' : ''}`}>
      <div className="toolbar wrap">
        <button type="button" className="btn primary" onClick={save} disabled={!dirty && isUser}>{t('save')}</button>
        {message && <span className="ok">✓ {message}</span>}
        <button type="button" className="btn" onClick={() => download(`${safeFileName(meta.title)}.abc`, abc)}>{t('exportAbc')}</button>
        <button type="button" className="btn" onClick={() => fileRef.current.click()} title={t('importHint')}>{t('importFile')}…</button>
        <input ref={fileRef} type="file" hidden accept=".abc,.txt,.musicxml,.xml,.mxl,.pdf,image/*" onChange={onFile} />
        {isUser && <button type="button" className="btn danger" onClick={remove}>{t('delete')}</button>}
        <span className="grow" />
        {source && <a className="btn" href={`#/song/${encodeURIComponent(source.id)}`}>{t('preview')} ›</a>}
      </div>
      {source && source.builtIn && <p className="muted small">{t('readOnlyBuiltIn')}</p>}

      <div className="editor-grid">
        {reference && (
          <div className="pane reference-pane">
            <ReferenceViewer file={reference} onClose={() => setReference(null)} />
          </div>
        )}

        <div className="pane">
          <div className="meta-grid">
            <label className="field"><span>{t('title')}</span>
              <input className="input" value={meta.title} onChange={(e) => setMeta('T', e.target.value)} /></label>
            <label className="field"><span>{t('composer')}</span>
              <input className="input" value={meta.composer} onChange={(e) => setMeta('C', e.target.value)} /></label>
            <label className="field"><span>{t('category')}</span>
              <input className="input" value={meta.category} onChange={(e) => setMeta('G', e.target.value)} /></label>
            <label className="field"><span>{t('key')}</span>
              <select className="input" value={KEYS.includes(meta.key) ? meta.key : ''} onChange={(e) => setMeta('K', e.target.value)}>
                {!KEYS.includes(meta.key) && <option value="">{meta.key || '—'}</option>}
                {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select></label>
            <label className="field"><span>{t('meter')}</span>
              <input className="input" value={meta.meter} onChange={(e) => setMeta('M', e.target.value)} /></label>
          </div>

          <div className="entry">
            <div className="toolbar wrap tight">
              {DURATIONS.map((d) => (
                <button key={d.label} type="button" className={`btn note-btn ${len === d.len ? 'on' : ''}`} onClick={() => setLen(d.len)} title={d.label}>
                  <span className="sym">{d.sym}</span><small>{d.label}</small>
                </button>
              ))}
              <button type="button" className={`btn note-btn ${dotted ? 'on' : ''}`} onClick={() => setDotted((x) => !x)} title={t('dot')}>
                <span className="sym">•</span><small>{t('dot')}</small>
              </button>
            </div>
            <div className="toolbar wrap tight">
              <button type="button" className="btn" onClick={() => insert(`z${durSuffix()}`)}>𝄽 {t('rest')}</button>
              <button type="button" className="btn" onClick={() => insert('-', { spaced: false })}>⁀ {t('tie')}</button>
              <button type="button" className="btn" onClick={() => insert('|')}>| {t('bar')}</button>
              <button type="button" className="btn" onClick={() => insert('|]')}>‖</button>
              <button type="button" className="btn" onClick={() => insert('\n', { spaced: false })}>↵ {t('newLine')}</button>
              <button type="button" className="btn" onClick={() => insert('\nw: ', { spaced: false })}>w: {t('lyricsLine')}</button>
              <button type="button" className="btn" onClick={undo} disabled={!history.length}>↶ {t('undo')}</button>
            </div>
            <PianoKeyboard onNote={onPiano} />
          </div>

          <label className="field">
            <span>{t('abcSource')}</span>
            <textarea
              ref={textRef}
              className="input abc-text"
              value={abc}
              onChange={onType}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </label>
          {warnings.length > 0 && (
            <details className="warnings" open>
              <summary>{t('errors')} ({warnings.length})</summary>
              <ul>{warnings.slice(0, 10).map((w, i) => <li key={i}>{stripHtml(w)}</li>)}</ul>
            </details>
          )}
        </div>

        <div className="pane preview-pane">
          <p className="muted small">{t('clickNoteToSelect')}</p>
          <ScoreView
            ref={scoreRef}
            abc={abc}
            transpose={transpose}
            onRender={setVisualObj}
            onNoteClick={onNoteClick}
            selectedChar={selectedChar}
          />
          <PlayerBar
            visualObj={visualObj}
            scoreRef={scoreRef}
            selectedChar={selectedChar}
            transpose={transpose}
            setTranspose={setTranspose}
            compact
          />
        </div>
      </div>
    </div>
  );
}
