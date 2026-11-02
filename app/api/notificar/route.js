import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { normalizarTelefono } from '@/lib/utils';
import { construirMensaje, variablesPlantilla } from '@/lib/mensajes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const env = process.env;

async function twilio(params) {
  const sid = env.TWILIO_ACCOUNT_SID;
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: j.message || `Error Twilio ${r.status}`, code: j.code };
  return { ok: true, sid: j.sid, status: j.status };
}

function enviarSMS(tel, msg) {
  if (!env.TWILIO_SMS_FROM && !env.TWILIO_MESSAGING_SERVICE_SID) {
    return { ok: false, error: 'Falta TWILIO_SMS_FROM o TWILIO_MESSAGING_SERVICE_SID' };
  }
  const p = { To: tel, Body: msg };
  if (env.TWILIO_MESSAGING_SERVICE_SID) p.MessagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
  else p.From = env.TWILIO_SMS_FROM;
  return twilio(p);
}

function enviarWhatsApp(tel, msg, tipo, pedido) {
  if (!env.TWILIO_WHATSAPP_FROM) return { ok: false, error: 'Falta TWILIO_WHATSAPP_FROM' };
  const p = { To: `whatsapp:${tel}`, From: `whatsapp:${env.TWILIO_WHATSAPP_FROM}` };
  const plantilla = { registro: env.TWILIO_WA_TEMPLATE_REGISTRO, llegada: env.TWILIO_WA_TEMPLATE_LLEGADA, entrega: env.TWILIO_WA_TEMPLATE_ENTREGA }[tipo];
  if (plantilla) {
    p.ContentSid = plantilla;
    p.ContentVariables = JSON.stringify(variablesPlantilla(pedido));
  } else {
    p.Body = msg; // Solo funciona dentro de la ventana de 24h o en sandbox
  }
  return twilio(p);
}

async function enviar(canal, tel, msg, tipo, pedido) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    return { ok: false, canal, error: 'Twilio no está configurado (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)' };
  }
  if (canal === 'whatsapp') return { canal, ...(await enviarWhatsApp(tel, msg, tipo, pedido)) };
  if (canal === 'whatsapp_sms') {
    const w = await enviarWhatsApp(tel, msg, tipo, pedido);
    if (w.ok) return { canal: 'whatsapp', ...w };
    const s = await enviarSMS(tel, msg);
    return { canal: 'sms (respaldo)', ...s, errorWhatsapp: w.error };
  }
  if (canal === 'ambos') {
    const [w, s] = await Promise.all([enviarWhatsApp(tel, msg, tipo, pedido), enviarSMS(tel, msg)]);
    return {
      canal: 'whatsapp+sms', ok: w.ok || s.ok, sid: [w.sid, s.sid].filter(Boolean).join(','),
      error: [w.ok ? null : `WhatsApp: ${w.error}`, s.ok ? null : `SMS: ${s.error}`].filter(Boolean).join(' | ') || undefined,
    };
  }
  return { canal: 'sms', ...(await enviarSMS(tel, msg)) };
}

export async function POST(req) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    const user = await adminAuth().verifyIdToken(token);
    const adm = await adminDb().doc(`admins/${user.uid}`).get();
    if (!adm.exists) return Response.json({ ok: false, error: 'Sin permisos' }, { status: 403 });

    const { pedidoId, tipo = 'registro', canal } = await req.json();
    const ref = adminDb().doc(`pedidos/${pedidoId}`);
    const snap = await ref.get();
    if (!snap.exists) return Response.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 });
    const pedido = snap.data();

    const tel = normalizarTelefono(pedido.alumno?.telefono);
    if (!tel) return Response.json({ ok: false, error: 'El alumno no tiene teléfono registrado' });

    const base = env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const mensaje = construirMensaje(tipo, pedido, base);
    const canalFinal = canal || env.NEXT_PUBLIC_DEFAULT_CHANNEL || 'sms';
    const r = await enviar(canalFinal, tel, mensaje, tipo, pedido);

    await ref.update({
      notificaciones: FieldValue.arrayUnion({
        fecha: new Date().toISOString(), tipo, canal: r.canal, ok: !!r.ok, telefono: tel,
        error: r.error || null, sid: r.sid || null, usuario: user.email || user.uid,
      }),
    });
    return Response.json({ ...r, telefono: tel, mensaje });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: e.message || 'Error enviando notificación' }, { status: 500 });
  }
}
