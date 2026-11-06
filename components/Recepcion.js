'use client';
import { useState } from 'react';
import { registrarRecepcion, obtenerPedido, registrarAviso } from '@/lib/data';
import { construirMensaje, avisoSugerido } from '@/lib/mensajes';
import { tallaTxt, waLink } from '@/lib/utils';
import { Campo } from '@/components/ui';

/** Estado del formulario de llegada: cuánto llegó de cada artículo, sobrantes, observación y aviso */
export function useRecepcion(p) {
  const [rec, setRec] = useState(() => (p?.items || []).map((i) => (p.recibidoEn ? i.recibido || 0 : i.cantidad)));
  const [sob, setSob] = useState(() => (p?.items || []).map(() => 0));
  const [obs, setObs] = useState('');
  const [avisar, setAvisar] = useState(!p?.recibidoEn);
  return { rec, setRec, sob, setSob, obs, setObs, avisar, setAvisar };
}

export function FormRecepcion({ p, r }) {
  const completo = p.items.every((it, i) => Number(r.rec[i]) >= it.cantidad);
  const set = (arr, fn, i, v) => fn(arr.map((x, j) => (j === i ? v : x)));
  return (
    <>
      <div className="tablewrap"><table>
        <thead><tr><th>Artículo</th><th>Pedido</th><th>Llegó</th><th>Sobrante → stock</th></tr></thead>
        <tbody>{p.items.map((it, i) => (it.cantidad > 0 || it.recibido > 0) && (
          <tr key={i}>
            <td>{it.nombre} ({tallaTxt(it.talla)})</td><td>{it.cantidad}</td>
            <td><input className="w80" type="number" min="0" value={r.rec[i]} onChange={(e) => set(r.rec, r.setRec, i, e.target.value)} /></td>
            <td><input className="w80" type="number" min="0" value={r.sob[i]} onChange={(e) => set(r.sob, r.setSob, i, e.target.value)} /></td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className={`alert ${completo ? 'ok' : 'error'}`} style={{ marginTop: 12 }}>{completo ? '✅ Llegó todo correctamente' : '⚠️ El pedido llegó incompleto: quedará registrado lo que falta'}</div>
      <Campo label="Observación"><input value={r.obs} onChange={(e) => r.setObs(e.target.value)} placeholder="Ej: faltó la gorra, llega en el próximo envío" /></Campo>
      <div style={{ height: 10 }} />
      {p.alumno?.telefono
        ? <label className="chk"><input type="checkbox" checked={r.avisar} onChange={(e) => r.setAvisar(e.target.checked)} /> Abrir WhatsApp para avisarle al alumno ({p.alumno.telefono})</label>
        : <p className="muted">El alumno no tiene teléfono: no se podrá avisar por WhatsApp.</p>}
    </>
  );
}

/** Guarda la llegada y, si se pidió, abre WhatsApp con el aviso correspondiente. Llamar directo desde el clic. */
export async function guardarLlegada(p, r) {
  const tel = p.alumno?.telefono;
  // La ventana se abre antes de cualquier espera para que el navegador no la bloquee
  const ventana = r.avisar && tel ? window.open('about:blank', '_blank') : null;
  try {
    await registrarRecepcion(p.id, r.rec, r.sob, r.obs);
    const nuevo = await obtenerPedido(p.id);
    if (ventana) {
      const tipo = avisoSugerido(nuevo);
      ventana.location.href = waLink(tel, construirMensaje(tipo, nuevo, window.location.origin));
      await registrarAviso(p.id, tipo).catch(() => {});
    }
    return nuevo;
  } catch (e) {
    if (ventana) ventana.close();
    throw e;
  }
}
