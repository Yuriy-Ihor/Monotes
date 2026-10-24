import { useEffect, useState } from 'react';
import { useLang } from './i18n.jsx';
import LibraryPage from './pages/LibraryPage.jsx';
import SongPage from './pages/SongPage.jsx';
import EditorPage from './pages/EditorPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import HelpPage from './pages/HelpPage.jsx';

export function navigate(path) {
  window.location.hash = path;
}

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { parts, query: new URLSearchParams(qs || '') };
}

function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export default function App() {
  const { t, lang, setLang } = useLang();
  const { parts, query } = useRoute();
  const page = parts[0] || '';

  let content;
  if (page === 'song') content = <SongPage key={parts[1]} id={parts[1]} query={query} />;
  else if (page === 'edit') content = <EditorPage key={parts[1] || 'new'} id={parts[1]} />;
  else if (page === 'search') content = <SearchPage query={query} />;
  else if (page === 'help') content = <HelpPage />;
  else content = <LibraryPage />;

  const tab = (name, href, label) => (
    <a href={`#${href}`} className={`tab ${page === name ? 'active' : ''}`}>{label}</a>
  );

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand">
          <img src="./icon.svg" alt="" width="28" height="28" />
          <span>{t('appName')}</span>
        </a>
        <nav className="tabs">
          {tab('', '/', t('library'))}
          {tab('search', '/search', t('search'))}
          {tab('edit', '/edit', t('editor'))}
          {tab('help', '/help', t('help'))}
        </nav>
        <button
          type="button"
          className="btn small lang"
          onClick={() => setLang(lang === 'uk' ? 'en' : 'uk')}
          title={t('language')}
        >
          {lang === 'uk' ? 'EN' : 'УКР'}
        </button>
      </header>
      <main className="content">{content}</main>
    </div>
  );
}
