import { useMemo, useState } from 'react';
import { useLang } from '../i18n.jsx';
import { useLibrary } from '../library.js';
import { searchMelody, parseNoteText } from '../patternSearch.js';
import { midiToAbc, keyAccidentals } from '../abcUtils.js';
import PianoKeyboard from '../components/PianoKeyboard.jsx';
import ScoreView from '../components/ScoreView.jsx';
import { previewNote } from '../usePlayer.js';

const C_MAJOR = keyAccidentals('C');

export default function SearchPage({ query }) {
  const { t } = useLang();
  const { songs } = useLibrary();
  const [notes, setNotes] = useState(() => (query.get('q') ? query.get('q').split(',').map(Number).filter(Number.isFinite) : []));
  const [text, setText] = useState('');
  const [anyKey, setAnyKey] = useState(true);
  const [allVoices, setAllVoices] = useState(false);

  const queryAbc = useMemo(() => {
    const body = notes.length ? notes.map((m) => midiToAbc(m, C_MAJOR)).join(' ') : 'x4';
    return `X:1\nL:1/4\nK:C clef=${notes.some((m) => m < 55) && !notes.some((m) => m > 67) ? 'bass' : 'treble'}\n${body}|\n`;
  }, [notes]);

  const results = useMemo(
    () => (notes.length >= 3 ? searchMelody(songs, notes, { anyKey, allVoices }) : []),
    [songs, notes, anyKey, allVoices],
  );

  const addNote = (m) => {
    previewNote(m);
    setNotes((n) => [...n, m].slice(-24));
  };

  const applyText = (value) => {
    setText(value);
    setNotes(parseNoteText(value));
  };

  return (
    <div className="page">
      <p className="muted">{t('melodyQuery')}</p>
      <ScoreView abc={queryAbc} scale={1.2} className="query-score" />
      <PianoKeyboard onNote={addNote} />
      <div className="toolbar wrap">
        <button type="button" className="btn" onClick={() => setNotes((n) => n.slice(0, -1))} disabled={!notes.length}>{t('backspace')}</button>
        <button type="button" className="btn" onClick={() => { setNotes([]); setText(''); }} disabled={!notes.length}>{t('clear')}</button>
        <label className="check"><input type="checkbox" checked={anyKey} onChange={(e) => setAnyKey(e.target.checked)} /> {t('anyKey')}</label>
        <label className="check"><input type="checkbox" checked={allVoices} onChange={(e) => setAllVoices(e.target.checked)} /> {t('allVoices')}</label>
      </div>
      <input
        className="input mono"
        value={text}
        onChange={(e) => applyText(e.target.value)}
        placeholder={t('typeNotes')}
      />

      <h2 className="section">{t('results')}</h2>
      {notes.length < 3 && <p className="muted">{t('minNotes')}</p>}
      {notes.length >= 3 && results.length === 0 && <p className="muted">{t('noSongs')}</p>}
      <ul className="song-list">
        {results.map(({ song, matches }) => {
          const first = matches[0];
          const hl = matches.flatMap((m) => m.chars);
          return (
            <li key={song.id}>
              <a
                className="song-item"
                href={`#/song/${encodeURIComponent(song.id)}?from=${first.chars[0]}&hl=${hl.join(',')}`}
              >
                <span className="song-title">{song.title}</span>
                {song.subtitle && <span className="song-sub">{song.subtitle}</span>}
                <span className="song-meta">{matches.length} {t('matches')}{song.category ? ` · ${song.category}` : ''}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
