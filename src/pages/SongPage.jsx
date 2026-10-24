import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../i18n.jsx';
import { getSong, saveUserSong, useLibrary } from '../library.js';
import ScoreView from '../components/ScoreView.jsx';
import PlayerBar from '../components/PlayerBar.jsx';
import { melodyFrom } from '../patternSearch.js';
import { navigate } from '../App.jsx';

export default function SongPage({ id, query }) {
  const { t } = useLang();
  const { ready } = useLibrary();
  const song = getSong(id);
  const scoreRef = useRef(null);
  const [visualObj, setVisualObj] = useState(null);
  const [transpose, setTranspose] = useState(0);
  const [scale, setScale] = useState(() => (window.innerWidth < 600 ? 0.9 : 1.1));

  const marked = useMemo(
    () => (query.get('hl') ? query.get('hl').split(',').map(Number) : []),
    [query],
  );
  const [selectedChar, setSelectedChar] = useState(() => (query.get('from') ? Number(query.get('from')) : null));

  // When arriving from a search result, bring the match into view once rendered.
  const scrolled = useRef(false);
  useEffect(() => {
    if (visualObj && selectedChar != null && !scrolled.current) {
      scrolled.current = true;
      setTimeout(() => scoreRef.current?.scrollToChar(selectedChar), 50);
    }
  }, [visualObj, selectedChar]);

  if (!song) return <div className="page"><p className="muted">{ready ? t('notFound') : t('loading')}</p></div>;

  const onNoteClick = (el) => setSelectedChar((c) => (c === el.startChar ? null : el.startChar));

  const searchHere = () => {
    const notes = melodyFrom(song, selectedChar, 6);
    if (notes.length) navigate(`/search?q=${notes.join(',')}`);
  };

  const copyToMine = () => {
    const newId = saveUserSong(null, song.abc);
    navigate(`/edit/${newId}`);
  };

  return (
    <div className="page song-page">
      <div className="toolbar">
        <button type="button" className="btn" onClick={() => window.history.back()}>‹ {t('back')}</button>
        <span className="grow" />
        <span className="zoom">
          <button type="button" className="btn small" onClick={() => setScale((s) => Math.max(0.6, +(s - 0.1).toFixed(1)))}>A−</button>
          <button type="button" className="btn small" onClick={() => setScale((s) => Math.min(2, +(s + 0.1).toFixed(1)))}>A+</button>
        </span>
        {song.builtIn
          ? <button type="button" className="btn" onClick={copyToMine}>{t('copyToMine')}</button>
          : <a className="btn" href={`#/edit/${encodeURIComponent(song.id)}`}>{t('edit')}</a>}
      </div>

      <ScoreView
        ref={scoreRef}
        abc={song.abc}
        scale={scale}
        transpose={transpose}
        onRender={setVisualObj}
        onNoteClick={onNoteClick}
        selectedChar={selectedChar}
        markedChars={marked}
      />

      <p className="muted hint">
        {selectedChar == null ? t('tapNoteHint') : (
          <>
            {t('selectedNote')} ·{' '}
            <button type="button" className="link" onClick={searchHere}>{t('findFromHere')}</button>
          </>
        )}
      </p>

      <div className="player-dock">
        <PlayerBar
          visualObj={visualObj}
          scoreRef={scoreRef}
          selectedChar={selectedChar}
          transpose={transpose}
          setTranspose={setTranspose}
        />
      </div>
    </div>
  );
}
