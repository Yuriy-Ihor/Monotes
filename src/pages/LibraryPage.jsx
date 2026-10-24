import { useMemo, useState } from 'react';
import { useLang } from '../i18n.jsx';
import { useLibrary } from '../library.js';

function normalize(s) {
  return (s || '').toLowerCase().replace(/[’'ʼ`]/g, '').normalize('NFC');
}

export default function LibraryPage() {
  const { t } = useLang();
  const { songs, ready } = useLibrary();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');

  const categories = useMemo(
    () => [...new Set(songs.map((s) => s.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [songs],
  );

  const filtered = useMemo(() => {
    const nq = normalize(q.trim());
    return songs
      .filter((s) => !cat || s.category === cat)
      .filter((s) => !nq || normalize(`${s.title} ${s.subtitle} ${s.composer} ${s.lyrics}`).includes(nq));
  }, [songs, q, cat]);

  const mine = filtered.filter((s) => !s.builtIn);
  const lib = filtered.filter((s) => s.builtIn).sort((a, b) => a.title.localeCompare(b.title));

  const list = (items) => (
    <ul className="song-list">
      {items.map((s) => (
        <li key={s.id}>
          <a href={`#/song/${encodeURIComponent(s.id)}`} className="song-item">
            <span className="song-title">{s.title}</span>
            {s.subtitle && <span className="song-sub">{s.subtitle}</span>}
            <span className="song-meta">
              {[s.category, s.key && `${t('key')}: ${s.key}`, s.meter].filter(Boolean).join(' · ')}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="page">
      <div className="toolbar">
        <input
          type="search"
          className="input grow"
          placeholder={t('searchSongs')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <a href="#/edit" className="btn primary">+ {t('newSong')}</a>
      </div>
      {categories.length > 0 && (
        <div className="chips">
          <button type="button" className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat('')}>{t('allCategories')}</button>
          {categories.map((c) => (
            <button key={c} type="button" className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      )}
      {!ready && <p className="muted">{t('loading')}</p>}
      {mine.length > 0 && (
        <>
          <h2 className="section">{t('mySongs')}</h2>
          {list(mine)}
        </>
      )}
      {lib.length > 0 && (
        <>
          <h2 className="section">{t('builtIn')}</h2>
          {list(lib)}
        </>
      )}
      {ready && filtered.length === 0 && <p className="muted">{t('noSongs')}</p>}
    </div>
  );
}
