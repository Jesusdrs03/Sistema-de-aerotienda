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

/** Cantidad de dígitos que tiene normalmente un número de pedido */
const DIGITOS = 6;

/** Saca del texto leído los posibles números de pedido. Los de 6 dígitos van primero. */
export function extraerCandidatos(texto) {
  const limpio = String(texto || '').toUpperCase().replace(/[\u2010-\u2015]/g, '-');
  // Errores típicos del OCR al confundir letras con números
  const corregido = limpio.replace(/[OQD]/g, '0').replace(/[IL|]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2');
  const exactos = new Set();
  const ventanas = new Set();
  const otros = new Set();
  for (const t of [limpio, corregido]) {
    // Quita espacios entre dígitos ("123 456" -> "123456")
    const junto = t.replace(/(\d)[\s.,-]+(?=\d)/g, '$1');
    (junto.match(/\d+/g) || []).forEach((m) => {
      if (m.length === DIGITOS) exactos.add(m);
      else if (m.length > DIGITOS) {
        // Si hay dígitos de más, ofrece las ventanas de 6 dígitos
        for (let i = 0; i + DIGITOS <= m.length; i++) ventanas.add(m.slice(i, i + DIGITOS));
      } else if (m.length >= 4) otros.add(m);
    });
  }
  // Formato con letras y guiones, ej: BQTO-2026-0012
  (limpio.match(/[A-Z]{2,6}(?:-[A-Z0-9]{2,8}){1,3}/g) || []).forEach((m) => otros.add(m));
  return [...exactos, ...(exactos.size ? [] : ventanas), ...otros].slice(0, 6);
}

/** Pasa a grises y estira el contraste (sin volver la imagen blanco y negro) */
function aGrisesContraste(canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let min = 255; let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    d[i] = d[i + 1] = d[i + 2] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const rango = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) * 255) / rango;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

/** Blanco y negro con umbral de Otsu (separa mejor la tinta del papel que un promedio) */
function binarizarOtsu(canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) hist[Math.round(d[i])]++;
  const total = d.length / 4;
  let suma = 0;
  for (let t = 0; t < 256; t++) suma += t * hist[t];
  let sumaB = 0; let wB = 0; let mejor = 0; let umbral = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumaB += t * hist[t];
    const mB = sumaB / wB;
    const mF = (suma - sumaB) / wF;
    const varEntre = wB * wF * (mB - mF) * (mB - mF);
    if (varEntre > mejor) { mejor = varEntre; umbral = t; }
  }
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] > umbral ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

function copiar(canvas) {
  const c = document.createElement('canvas');
  c.width = canvas.width; c.height = canvas.height;
  c.getContext('2d').drawImage(canvas, 0, 0);
  return c;
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
  const archivoRef = useRef(null);
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
  const [vista, setVista] = useState('');

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

  /** Ejecuta el OCR sobre varias versiones de la imagen y junta los números más repetidos */
  async function ejecutarOcr(pasadas) {
    const T = await cargarTesseract();
    const worker = await T.createWorker('eng');
    const votos = new Map(); // número -> veces que lo vio
    try {
      for (const { img, psm } of pasadas) {
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789',
          tessedit_pageseg_mode: psm,
          classify_bln_numeric_mode: '1',
        });
        const { data } = await worker.recognize(img);
        extraerCandidatos(data?.text).forEach((c) => votos.set(c, (votos.get(c) || 0) + 1));
      }
    } finally {
      await worker.terminate().catch(() => {});
    }
    // Primero los de 6 dígitos y los que más se repitieron
    return [...votos.entries()]
      .sort((x, y) => (Number(y[0].length === DIGITOS) - Number(x[0].length === DIGITOS)) || (y[1] - x[1]))
      .map(([c]) => c).slice(0, 6);
  }

  /** Recorta la franja central de una fuente (video o imagen), la agranda y la prepara */
  function franjaCentral(fuente, w, h) {
    const cw = Math.round(w * 0.86);
    const ch = Math.round(h * 0.34);
    const base = document.createElement('canvas');
    const escala = Math.min(2, 1600 / cw);
    base.width = Math.round(cw * escala); base.height = Math.round(ch * escala);
    base.getContext('2d').drawImage(fuente, Math.round((w - cw) / 2), Math.round((h - ch) / 2), cw, ch, 0, 0, base.width, base.height);
    aGrisesContraste(base);
    const bn = copiar(base);
    binarizarOtsu(bn);
    return { base, bn };
  }

  async function leerTexto() {
    const v = video.current;
    if (!v?.videoWidth) return;
    setLeyendo(true); setAviso(''); setCandidatos([]); setVista('');
    try {
      const { base, bn } = franjaCentral(v, v.videoWidth, v.videoHeight);
      setVista(bn.toDataURL('image/png')); // para que veas qué analizó
      const lista = await ejecutarOcr([
        { img: base, psm: '7' }, // una línea, en grises
        { img: bn, psm: '7' },   // una línea, blanco y negro
        { img: base, psm: '6' }, // bloque de texto
        { img: bn, psm: '8' },   // una palabra
      ]);
      setCandidatos(lista);
      if (!lista.length) setAviso('No se detectó ningún número. Acerca la cámara hasta que los dígitos llenen el marco, con buena luz y sin reflejos, y vuelve a intentar. Si es letra a mano, escríbelo abajo.');
    } catch (e) {
      setAviso(e.message || 'No se pudo leer el número.');
    }
    setLeyendo(false);
  }

  /** Lee el número desde una foto de la galería. La imagen solo se usa en memoria: no se guarda ni se sube. */
  async function leerArchivo(e) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir la misma foto
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) { setAviso('El archivo elegido no es una imagen.'); return; }
    setLeyendo(true); setAviso(''); setCandidatos([]); setVista('');
    let url = '';
    try {
      // Cargar la imagen respetando la orientación de la foto
      let fuente; let w; let h;
      if (window.createImageBitmap) {
        fuente = await createImageBitmap(archivo);
        w = fuente.width; h = fuente.height;
      } else {
        url = URL.createObjectURL(archivo);
        fuente = await new Promise((ok, fallo) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fallo(new Error('No se pudo abrir la imagen.')); i.src = url; });
        w = fuente.naturalWidth; h = fuente.naturalHeight;
      }
      // Imagen completa reducida (la foto puede tener el número en cualquier parte)
      const lado = Math.min(1, 1800 / Math.max(w, h));
      const completa = document.createElement('canvas');
      completa.width = Math.round(w * lado); completa.height = Math.round(h * lado);
      completa.getContext('2d').drawImage(fuente, 0, 0, completa.width, completa.height);
      fuente.close?.();
      aGrisesContraste(completa);
      const completaBn = copiar(completa);
      binarizarOtsu(completaBn);
      // Y también la franja central, por si la foto es un primer plano del número
      const { base, bn } = franjaCentral(completa, completa.width, completa.height);
      setVista(completaBn.toDataURL('image/jpeg', 0.7));

      const lista = await ejecutarOcr([
        { img: base, psm: '7' },
        { img: bn, psm: '7' },
        { img: completa, psm: '11' },   // texto disperso en toda la foto
        { img: completaBn, psm: '11' },
        { img: completa, psm: '6' },
      ]);
      setCandidatos(lista);
      if (!lista.length) setAviso('No se detectó ningún número en la foto. Prueba con una foto más cercana y nítida, o escríbelo abajo.');
    } catch (err) {
      setAviso(err.message || 'No se pudo leer la imagen.');
    }
    if (url) URL.revokeObjectURL(url);
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

        {!error && <p className="muted" style={{ textAlign: 'center', margin: '10px 0' }}>Acerca la cámara hasta que los <b>6 dígitos llenen el marco</b>, con buena luz, y pulsa <b>Leer número</b>. Los códigos de barras o QR se leen solos.</p>}

        {!error && (
          <button type="button" className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={!listo || leyendo} onClick={leerTexto}>
            {leyendo ? 'Leyendo…' : '🔍 Leer número'}
          </button>
        )}

        <input ref={archivoRef} type="file" accept="image/*" hidden onChange={leerArchivo} />
        <button type="button" className="btn sec" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={leyendo} onClick={() => archivoRef.current?.click()}>
          🖼️ Elegir foto de la galería
        </button>
        <p className="muted" style={{ textAlign: 'center', margin: '6px 0 0', fontSize: '.8rem' }}>La foto solo se usa para leer el número: no se guarda.</p>

        {leyendo && <div className="loader-inline" style={{ marginTop: 12 }}><span className="spinner" /> Analizando imagen…</div>}

        {aviso && <div className="alert info" style={{ marginTop: 12 }}>{aviso}</div>}

        {vista && (
          <div style={{ marginTop: 12 }}>
            <label>Imagen que se analizó</label>
            <img src={vista} alt="Zona analizada" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--borde)' }} />
          </div>
        )}

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
