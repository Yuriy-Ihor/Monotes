import { useState } from 'react';
import { midiName } from '../abcUtils.js';

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK_AFTER = { 0: 1, 2: 3, 5: 6, 7: 8, 9: 10 }; // white pc -> black pc to its right

/** Two-octave on-screen piano with octave shift. Calls onNote(midi). */
export default function PianoKeyboard({ onNote, initialLow = 60, octaves = 2 }) {
  const [low, setLow] = useState(initialLow);
  const [down, setDown] = useState(null);

  const whites = [];
  for (let o = 0; o < octaves; o++) WHITE.forEach((pc) => whites.push(low + o * 12 + pc));
  whites.push(low + octaves * 12); // closing C

  const press = (midi) => (e) => {
    e.preventDefault();
    setDown(midi);
    setTimeout(() => setDown((d) => (d === midi ? null : d)), 180);
    onNote(midi);
  };

  return (
    <div className="piano-wrap">
      <button type="button" className="btn small" onClick={() => setLow((l) => Math.max(36, l - 12))} aria-label="Octave down">‹ 8</button>
      <div className="piano" style={{ '--whites': whites.length }}>
        {whites.map((m, i) => {
          const blackPc = BLACK_AFTER[m % 12];
          const black = blackPc !== undefined && i < whites.length - 1 ? m - (m % 12) + blackPc : null;
          return (
            <div key={m} className="piano-slot">
              <button
                type="button"
                className={`key white ${down === m ? 'down' : ''}`}
                onPointerDown={press(m)}
                title={midiName(m)}
              >
                {m % 12 === 0 && <span className="key-label">{midiName(m)}</span>}
              </button>
              {black !== null && (
                <button
                  type="button"
                  className={`key black ${down === black ? 'down' : ''}`}
                  onPointerDown={press(black)}
                  title={midiName(black)}
                />
              )}
            </div>
          );
        })}
      </div>
      <button type="button" className="btn small" onClick={() => setLow((l) => Math.min(84, l + 12))} aria-label="Octave up">8 ›</button>
    </div>
  );
}
