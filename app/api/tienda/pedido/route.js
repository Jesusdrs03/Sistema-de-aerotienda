import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { TIENDA_URL } from '@/lib/tienda';
import { mapearPedidoTienda } from '@/lib/tiendaPedido';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const err = (status, error) => Response.json({ error }, { status });

// Busca un pedido en la tienda WooCommerce y devuelve los datos del alumno. Solo para administradores.
export async function GET(req) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return err(401, 'No autenticado');
    const user = await adminAuth().verifyIdToken(token);
    if (!(await adminDb().doc(`admins/${user.uid}`).get()).exists) return err(403, 'Sin permisos');

    const key = process.env.WC_CONSUMER_KEY;
    const secret = process.env.WC_CONSUMER_SECRET;
    if (!key || !secret) return err(501, 'La conexión con la tienda no está configurada (faltan WC_CONSUMER_KEY y WC_CONSUMER_SECRET en Vercel).');

    const numero = (new URL(req.url).searchParams.get('numero') || '').trim().replace(/^#/, '');
    if (!numero) return err(400, 'Indica el número de pedido');

    const basic = 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
    async function get(path) {
      const url = `${process.env.WC_STORE_URL || TIENDA_URL}/wp-json/wc/v3${path}`;
      let r = await fetch(url, { headers: { Authorization: basic }, cache: 'no-store' });
      if (r.status === 401) {
        // Algunos servidores no pasan la cabecera Authorization: se reintenta con las claves en la URL (HTTPS)
        const sep = url.includes('?') ? '&' : '?';
        r = await fetch(`${url}${sep}consumer_key=${encodeURIComponent(key)}&consumer_secret=${encodeURIComponent(secret)}`, { cache: 'no-store' });
      }
      if (r.status === 401 || r.status === 403) throw Object.assign(new Error('La tienda rechazó las claves de la API. Revisa WC_CONSUMER_KEY / WC_CONSUMER_SECRET y que tengan permiso de lectura.'), { status: 502 });
      return r;
    }

    let pedido = null;
    if (/^\d+$/.test(numero)) {
      const r = await get(`/orders/${numero}`);
      if (r.ok) pedido = await r.json();
    }
    if (!pedido) {
      const r = await get(`/orders?search=${encodeURIComponent(numero)}&per_page=10`);
      if (r.ok) {
        const lista = await r.json();
        pedido = lista.find((o) => String(o.number) === numero || String(o.id) === numero) || null;
      }
    }
    if (!pedido) return err(404, `No se encontró el pedido ${numero} en la tienda`);
    return Response.json(mapearPedidoTienda(pedido));
  } catch (e) {
    return err(e.status || 500, e.message || 'Error consultando la tienda');
  }
}
