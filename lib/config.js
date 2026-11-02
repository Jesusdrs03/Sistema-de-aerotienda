// Sedes de la aerotienda. Para agregar una nueva sede, añádela aquí.
export const SEDES = [
  { id: 'barquisimeto', nombre: 'Barquisimeto', prefijo: 'BQTO' },
  { id: 'caracas-santa-monica', nombre: 'Caracas - Santa Mónica', prefijo: 'CCS' },
];

export const sedeNombre = (id) => SEDES.find((s) => s.id === id)?.nombre || id || '—';

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Aerotienda';

export const ESTADOS = {
  en_transito: { label: 'En tránsito', color: 'gray' },
  recibido: { label: 'Recibido completo', color: 'blue' },
  recibido_incompleto: { label: 'Recibido incompleto', color: 'orange' },
  entregado_parcial: { label: 'Entregado parcial', color: 'orange' },
  entregado: { label: 'Entregado', color: 'green' },
  anulado: { label: 'Anulado', color: 'red' },
};

export const MOTIVOS_DEVOLUCION = [
  'Repetido / sobrante',
  'Devuelto por el alumno',
  'Talla incorrecta',
  'Artículo defectuoso',
  'Otro',
];

export const MOTIVOS_CAMBIO = ['Cambio de talla', 'Artículo equivocado', 'Artículo defectuoso', 'Otro'];

export const TIPOS_MOV = {
  entrega: 'Entrega',
  devolucion: 'Devolución a stock',
  cambio: 'Cambio',
  reasignacion: 'Reasignación',
  ingreso: 'Ingreso a stock',
  ajuste: 'Ajuste / salida',
};

export const CANALES = [
  { id: 'sms', nombre: 'SMS' },
  { id: 'whatsapp', nombre: 'WhatsApp' },
  { id: 'whatsapp_sms', nombre: 'WhatsApp (si falla, SMS)' },
  { id: 'ambos', nombre: 'WhatsApp + SMS' },
];
