import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import abcjs from 'abcjs';

/** Map startChar -> SVG elements for every note/rest in a rendered tune. */
function buildCharMap(visualObj) {
  const map = new Map();
  for (const line of visualObj.lines || []) {
    for (const staff of line.staff || []) {
      for (const voice of staff.voices || []) {
        for (const el of voice) {
          if (el.el_type !== 'note' || !el.abselem) continue;
          const els = map.get(el.startChar) || [];
          els.push(...(el.abselem.elemset || []));
          map.set(el.startChar, els);
        }
      }
    }
  }
  return map;
}

/**
 * Renders ABC as a staff that reflows to the container width.
 * Imperative handle: highlightEvent(timingEvent | null).
 */
const ScoreView = forwardRef(function ScoreView(
  { abc, scale = 1, transpose = 0, onRender, onNoteClick, selectedChar, markedChars, className = '' },
  ref,
) {
  const containerRef = useRef(null);
  const paperRef = useRef(null);
  const charMap = useRef(new Map());
  const playing = useRef([]);
  const [width, setWidth] = useState(0);
  const onClickRef = useRef(onNoteClick);
  onClickRef.current = onNoteClick;
  const onRenderRef = useRef(onRender);
  onRenderRef.current = onRender;

  // Track container width so the music reflows on phones and on rotate.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width);
      setWidth((prev) => (Math.abs(prev - w) > 8 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!width || !paperRef.current) return;
    let visualObj;
    try {
      // Lay the music out for the available width; 'resize' then scales the SVG to fit exactly.
      const staffwidth = Math.max(240, width / scale - 40);
      const narrow = staffwidth < 500;
      [visualObj] = abcjs.renderAbc(paperRef.current, abc, {
        add_classes: true,
        responsive: 'resize',
        staffwidth,
        visualTranspose: transpose,
        wrap: { minSpacing: 1.1, maxSpacing: 2.6, preferredMeasuresPerLine: staffwidth < 420 ? 2 : staffwidth < 700 ? 3 : 4 },
        paddingleft: 8,
        paddingright: 8,
        selectionColor: '#c0392b',
        clickListener: (abcElem) => {
          if (onClickRef.current && abcElem && abcElem.el_type === 'note') onClickRef.current(abcElem);
        },
        format: narrow ? {
          titlefont: '"Georgia" 15 bold',
          subtitlefont: '"Georgia" 12 italic',
          vocalfont: '"Georgia" 13',
          composerfont: '"Georgia" 9 italic',
        } : {
          titlefont: '"Georgia" 20 bold',
          subtitlefont: '"Georgia" 15 italic',
          vocalfont: '"Georgia" 13',
          composerfont: '"Georgia" 12 italic',
        },
      });
    } catch (e) {
      console.error(e);
      return;
    }
    charMap.current = visualObj ? buildCharMap(visualObj) : new Map();
    playing.current = [];
    if (onRenderRef.current) onRenderRef.current(visualObj);
  }, [abc, width, scale, transpose]);

  // Persistent marks: selected note and pattern-search matches.
  useEffect(() => {
    const map = charMap.current;
    paperRef.current?.querySelectorAll('.mark-match, .mark-selected').forEach((n) => {
      n.classList.remove('mark-match', 'mark-selected');
    });
    (markedChars || []).forEach((c) => (map.get(c) || []).forEach((n) => n.classList.add('mark-match')));
    if (selectedChar != null) (map.get(selectedChar) || []).forEach((n) => n.classList.add('mark-selected'));
  });

  useImperativeHandle(ref, () => ({
    highlightEvent(ev) {
      playing.current.forEach((n) => n.classList.remove('playing'));
      playing.current = [];
      if (!ev || !ev.elements) return;
      ev.elements.forEach((group) => group.forEach((n) => {
        n.classList.add('playing');
        playing.current.push(n);
      }));
      const first = playing.current[0];
      if (first && first.getBoundingClientRect) {
        const r = first.getBoundingClientRect();
        if (r.top < 90 || r.bottom > window.innerHeight - 140) {
          window.scrollBy({ top: r.top - window.innerHeight / 3, behavior: 'smooth' });
        }
      }
    },
    scrollToChar(c) {
      const n = (charMap.current.get(c) || [])[0];
      if (n) {
        const r = n.getBoundingClientRect();
        window.scrollBy({ top: r.top - window.innerHeight / 3, behavior: 'smooth' });
      }
    },
  }), []);

  return (
    <div ref={containerRef} className={`score ${className}`}>
      <div ref={paperRef} />
    </div>
  );
});

export default ScoreView;
