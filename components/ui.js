'use client';
import { ESTADOS } from '@/lib/config';

export function Badge({ estado }) {
  const e = ESTADOS[estado] || { label: estado, color: 'gray' };
  return <span className={`badge ${e.color}`}>{e.label}</span>;
}

export function Modal({ titulo, onClose, children, footer }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="row between"><h2>{titulo}</h2><button className="btn sec sm" onClick={onClose}>✕</button></div>
        {children}
        {footer && <div className="foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Alerta({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div className={`alert ${msg.type}`}>
      <div className="row between"><span>{msg.text}</span>{onClose && <a href="#" onClick={(e) => { e.preventDefault(); onClose(); }}>✕</a>}</div>
    </div>
  );
}

export function Campo({ label, children }) {
  return <div><label>{label}</label>{children}</div>;
}

/** Carga dentro de una sección: ruedita + texto */
export const Cargando = ({ texto = 'Cargando…' }) => (
  <div className="loader-inline" role="status" aria-live="polite"><span className="spinner" /> {texto}</div>
);

/** Pantalla de carga completa (al abrir el panel) */
export const PantallaCarga = ({ texto = 'Cargando…' }) => (
  <div className="loader-full" role="status" aria-live="polite">
    <div className="loader-logo"><span>✈️</span></div>
    <div className="loader-marca">Aerotienda</div>
    <div className="loader-barra"><i /></div>
    <div className="muted">{texto}</div>
  </div>
);
