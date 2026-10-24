import { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n.jsx';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';
let pdfjsPromise = null;

function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${PDFJS}/pdf.min.js`;
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.js`;
        resolve(window.pdfjsLib);
      };
      s.onerror = () => { pdfjsPromise = null; reject(new Error('Could not load PDF viewer')); };
      document.head.appendChild(s);
    });
  }
  return pdfjsPromise;
}

/** Shows an original PDF page or image next to the editor while transcribing. */
export default function ReferenceViewer({ file, onClose }) {
  const { t } = useLang();
  const canvasRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [pageNo, setPageNo] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [imgUrl, setImgUrl] = useState(null);
  const [error, setError] = useState('');

  const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);

  useEffect(() => {
    setError('');
    if (!isPdf) {
      const url = URL.createObjectURL(file);
      setImgUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    let cancelled = false;
    (async () => {
      try {
        const lib = await loadPdfJs();
        const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        if (!cancelled) { setPdf(doc); setPageNo(1); }
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [file, isPdf]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return undefined;
    let task;
    (async () => {
      const page = await pdf.getPage(pageNo);
      const canvas = canvasRef.current;
      const width = canvas.parentElement.clientWidth || 600;
      const base = page.getViewport({ scale: 1 });
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: (width / base.width) * zoom * dpr });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
    })();
    return () => { if (task) task.cancel(); };
  }, [pdf, pageNo, zoom]);

  return (
    <div className="reference">
      <div className="toolbar">
        <b className="grow">{t('reference')}: {file.name}</b>
        {pdf && pdf.numPages > 1 && (
          <span className="stepper">
            <button type="button" className="btn small" disabled={pageNo <= 1} onClick={() => setPageNo((p) => p - 1)}>‹</button>
            {t('page')} {pageNo}/{pdf.numPages}
            <button type="button" className="btn small" disabled={pageNo >= pdf.numPages} onClick={() => setPageNo((p) => p + 1)}>›</button>
          </span>
        )}
        <button type="button" className="btn small" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>−</button>
        <button type="button" className="btn small" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>+</button>
        <button type="button" className="btn small" onClick={onClose}>✕</button>
      </div>
      <div className="reference-body">
        {error && <p className="error">{error}</p>}
        {isPdf && !pdf && !error && <p className="muted">{t('pdfLoading')}</p>}
        {isPdf && <canvas ref={canvasRef} />}
        {imgUrl && <img src={imgUrl} alt={file.name} style={{ width: `${zoom * 100}%` }} />}
      </div>
    </div>
  );
}
