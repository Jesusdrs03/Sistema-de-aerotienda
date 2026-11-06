import { TIENDA_URL, CATEGORIA_AEROTIENDA, normalizarProducto } from '@/lib/tienda';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Lee en vivo los productos de la categoría Aerotienda de la tienda en línea
export async function GET() {
  try {
    const productos = [];
    for (let page = 1; page <= 10; page++) {
      const r = await fetch(`${TIENDA_URL}/wp-json/wc/store/v1/products?category=${CATEGORIA_AEROTIENDA}&per_page=100&page=${page}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`La tienda respondió ${r.status}`);
      const lote = await r.json();
      productos.push(...lote.map(normalizarProducto));
      if (lote.length < 100) break;
    }
    return Response.json({ fuente: 'tienda', productos });
  } catch (e) {
    return Response.json({ error: e.message || 'No se pudo leer la tienda' }, { status: 502 });
  }
}
