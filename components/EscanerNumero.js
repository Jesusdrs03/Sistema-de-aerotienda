'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

/** Carga Tesseract.js (OCR) solo cuando se necesita, para no pesar en el resto del sistema */
function cargarTesseract() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Sin navegador'));
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((ok, fallo) => {
    const s = document.createElement('script');
    s.src = TESSERACT_SRC;
    s.onload = () => ok(window.Tesseract);
    s.onerror = () => fallo(new Error('No se pudo cargar el lector de texto. Revisa tu conexión.'));
    document.head.appendChild(s);
  });
}

/** Saca del texto leído los posibles números de pedido (ej: BQTO-2026-0012, 48213, #48213) */
export function extraerCandidatos(texto) {
  const limpio = String(texto || '').toUpperCase().replace(/[\u2010-\u2015]/g, '-');
  const hallados = new Set();
  // Formato con letras y guiones, ej: BQTO-2026-0012
  (limpio.match(/[A-Z]{2,6}(?:-[A-Z0-9]{2,8}){1,3}/g) || []).forEach((m) => hallados.add(m));
  // Números de 3 o más dígitos (con # opcional)
  (limpio.match(/#?\d{3,}/g) || []).forEach((m) => hallados.add(m.replace('#', '')));
  return [...hallados].slice(0, 6);
}

/** Aumenta el contraste y pasa a blanco y negro para que el OCR lea mejor */
function prepararImagen(canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let suma = 0;
  for (let i = 0; i < d.length; i += 4) suma += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  const umbral = suma / (d.length / 4);
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const v = g > umbral * 0.95 ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Botón que abre la cámara del celular para leer un número de pedido.
 * Lee códigos de barras / QR automáticamente (si el navegador lo permite) y también
 * texto impreso con el botón "Leer número". Siempre se confirma antes de usar el valor.
 */
export default function EscanerNumero({ onDetectado, titulo = 'Escanear número de pedido', className = 'btn sec', children }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setAbierto(true)} aria-label={titulo} title={titulo}>
        {children || '📷'}
      </button>
      {abierto && (
        <Visor
          titulo={titulo}
          onCerrar={() => setAbierto(false)}
          onUsar={(v) => { setAbierto(false); onDetectado(v); }}
        />
      )}
    </>
  );
}

function Visor({ titulo, onCerrar, onUsar }) {
  const video = useRef(null);
  const stream = useRef(null);
  const activo = useRef(true);
  const usarRef = useRef(onUsar);
  usarRef.current = onUsar;
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [candidatos, setCandidatos] = useState([]);
  const [manual, setManual] = useState('');
  const [aviso, setAviso] = useState('');

  const detener = useCallback(() => {
    activo.current = false;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  // Abrir cámara trasera
  useEffect(() => {
    activo.current = true;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no permite usar la cámara. Escribe el número a mano.');
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (!activo.current) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
          setListo(true);
        }
      } catch (e) {
        setError(e?.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Actívalo en los ajustes del navegador o escribe el número a mano.'
          : 'No se pudo abrir la cámara. Escribe el número a mano.');
      }
    })();
    return detener;
  }, [detener]);

  // Lectura automática de códigos de barras / QR (solo donde el navegador lo soporta)
  useEffect(() => {
    if (!listo || typeof window === 'undefined' || !('BarcodeDetector' in window)) return;
    let timer;
    let detector;
    try { detector = new window.BarcodeDetector(); } catch { return; }
    const ciclo = async () => {
      if (!activo.current) return;
      try {
        const codigos = await detector.detect(video.current);
        const valor = codigos?.[0]?.rawValue;
        if (valor) { detener(); usarRef.current(String(valor).trim()); return; }
      } catch {}
      timer = setTimeout(ciclo, 400);
    };
    ciclo();
    return () => clearTimeout(timer);
  }, [listo, detener]);

  async function leerTexto() {
    const v = video.current;
    if (!v?.videoWidth) return;
    setLeyendo(true); setAviso(''); setCandidatos([]);
    try {
      // Recorta la franja central (donde está el marco guía)
      const w = v.videoWidth;
      const h = v.videoHeight;
      const cw = Math.round(w * 0.86);
      const ch = Math.round(h * 0.28);
      const canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      canvas.getContext('2d').drawImage(v, Math.round((w - cw) / 2), Math.round((h - ch) / 2), cw, ch, 0, 0, cw, ch);
      prepararImagen(canvas);

      const T = await cargarTesseract();
      const worker = await T.createWorker('eng');
      try {
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-#',
          tessedit_pageseg_mode: '7', // una sola línea de texto
        });
        var { data } = await worker.recognize(canvas);
      } finally {
        await worker.terminate().catch(() => {});
      }
      const lista = extraerCandidatos(data?.text);
      setCandidatos(lista);
      if (!lista.length) setAviso('No se detectó ningún número. Acerca la cámara, mejora la luz y vuelve a intentar.');
    } catch (e) {
      setAviso(e.message || 'No se pudo leer el número.');
    }
    setLeyendo(false);
  }

  function usar(valor) {
    const v = String(valor || '').trim();
    if (!v) return;
    detener();
    usarRef.current(v);
  }

  function cerrar() { detener(); onCerrar(); }

  return (
    <div className="scan-bg" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="scan">
        <div className="row between scan-head">
          <b>{titulo}</b>
          <button type="button" className="btn sec sm" onClick={cerrar}>✕</button>
        </div>

        {error ? <div className="alert error">{error}</div> : (
          <div className="scan-video">
            <video ref={video} playsInline muted />
            <div className="scan-marco" />
            {!listo && <div className="scan-cargando">Abriendo cámara…</div>}
          </div>
        )}

        {!error && <p className="muted" style={{ textAlign: 'center', margin: '10px 0' }}>Centra el número dentro del marco y pulsa <b>Leer número</b>. Los códigos de barras o QR se leen solos.</p>}

        {!error && (
          <button type="button" className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={!listo || leyendo} onClick={leerTexto}>
            {leyendo ? 'Leyendo…' : '🔍 Leer número'}
          </button>
        )}

        {aviso && <div className="alert info" style={{ marginTop: 12 }}>{aviso}</div>}

        {candidatos.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <label>Se detectó (toca el correcto)</label>
            <div className="row">
              {candidatos.map((c) => <button key={c} type="button" className="chip" onClick={() => usar(c)}>{c}</button>)}
            </div>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <label>O corrígelo / escríbelo a mano</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="N° de pedido" autoCapitalize="characters"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); usar(manual); } }} />
            <button type="button" className="btn ok" disabled={!manual.trim()} onClick={() => usar(manual)}>Usar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
