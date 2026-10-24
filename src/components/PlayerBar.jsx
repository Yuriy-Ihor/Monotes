import { useMemo, useState } from 'react';
import { useLang } from '../i18n.jsx';
import { INSTRUMENTS, usePlayer } from '../usePlayer.js';

function loadPref(key, fallback) {
  try {
    const v = localStorage.getItem('monotes.' + key);
    return v === null ? fallback : JSON.parse(v);
  } catch (e) {
    return fallback;
  }
}
function savePref(key, value) {
  try { localStorage.setItem('monotes.' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
}

function voiceCount(visualObj) {
  let n = 0;
  for (const line of visualObj?.lines || []) {
    if (!line.staff) continue;
    n = Math.max(n, line.staff.reduce((sum, st) => sum + (st.voices ? st.voices.length : 0), 0));
  }
  return n;
}

/**
 * Transport controls. Starts from the selected note when there is one.
 * transpose is owned by the parent because the score is re-rendered with it.
 */
export default function PlayerBar({ visualObj, scoreRef, selectedChar, transpose, setTranspose, compact = false }) {
  const { t, lang } = useLang();
  const [tempo, setTempo] = useState(() => loadPref('tempo', 100));
  const [program, setProgram] = useState(() => loadPref('program', 0));
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState([]);
  const [showSettings, setShowSettings] = useState(() => window.innerWidth > 700);
  const nVoices = useMemo(() => voiceCount(visualObj), [visualObj]);

  const player = usePlayer(visualObj, {
    tempoFactor: tempo / 100,
    transpose,
    program,
    loop,
    voicesOff: muted.length ? muted : undefined,
    onEvent: (ev) => scoreRef.current?.highlightEvent(ev),
  });

  if (!visualObj) return null;

  const startSec = () => {
    if (selectedChar == null) return 0;
    const ms = player.msForChar(selectedChar);
    return ms ? ms / 1000 : 0;
  };

  const onPlay = () => {
    if (player.status === 'playing') player.pause();
    else if (player.status === 'paused') player.resume();
    else player.playFrom(startSec());
  };

  const playLabel = player.status === 'playing' ? `❚❚ ${t('pause')}` : player.status === 'loading' ? t('loading') : `▶ ${t('play')}`;

  return (
    <div className={`player ${compact ? 'compact' : ''}`}>
      <div className="player-row">
        <button type="button" className="btn primary play" onClick={onPlay} disabled={player.status === 'loading'}>
          {playLabel}
        </button>
        <button type="button" className="btn" onClick={player.stop} disabled={player.status === 'idle'}>■</button>
        {selectedChar != null && (
          <button type="button" className="btn" onClick={() => player.playFrom(startSec())} title={t('playFromNote')}>
            ▶ {t('selectedNote')}
          </button>
        )}
        <label className="check">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> {t('loop')}
        </label>
        <span className="grow" />
        <button
          type="button"
          className={`btn small ${showSettings ? 'on' : ''}`}
          onClick={() => setShowSettings((v) => !v)}
          aria-expanded={showSettings}
          title={`${t('tempo')}, ${t('transpose')}, ${t('instrument')}`}
        >
          ⚙{tempo !== 100 || transpose !== 0 ? ' •' : ''}
        </button>
      </div>
      {showSettings && (
      <div className="player-row settings">
        <label className="field">
          <span>{t('tempo')} {tempo}%</span>
          <input
            type="range" min="40" max="160" step="5" value={tempo}
            onChange={(e) => { const v = Number(e.target.value); setTempo(v); savePref('tempo', v); }}
          />
        </label>
        <label className="field">
          <span>{t('transpose')}</span>
          <span className="stepper">
            <button type="button" className="btn small" onClick={() => setTranspose(transpose - 1)}>−</button>
            <b>{transpose > 0 ? `+${transpose}` : transpose}</b>
            <button type="button" className="btn small" onClick={() => setTranspose(transpose + 1)}>+</button>
          </span>
        </label>
        <label className="field">
          <span>{t('instrument')}</span>
          <select
            className="input"
            value={program}
            onChange={(e) => { const v = Number(e.target.value); setProgram(v); savePref('program', v); }}
          >
            {INSTRUMENTS.map((i) => <option key={i.program} value={i.program}>{i[lang]}</option>)}
          </select>
        </label>
        {nVoices > 1 && (
          <div className="field">
            <span>{t('voices')}</span>
            <span className="voice-toggles">
              {Array.from({ length: nVoices }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`chip ${muted.includes(i) ? '' : 'on'}`}
                  onClick={() => setMuted((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]))}
                >
                  {i + 1}
                </button>
              ))}
            </span>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
