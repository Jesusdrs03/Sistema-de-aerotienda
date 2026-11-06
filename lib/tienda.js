// Catálogo de la tienda en línea (WooCommerce) — categoría "Aerotienda IDEA"
export const TIENDA_URL = 'https://store.aeroidea.net';
export const CATEGORIA_AEROTIENDA = 1926;
const MAX_VARIANTES = 30;

const SUBCATEGORIA = {
  accesorios: 'Accesorios', chaquetas: 'Chaquetas', chemises: 'Chemises', franelas: 'Franelas', gorras: 'Gorras',
  'kits-de-piloto': 'Kits de Piloto', libros: 'Libros', sudaderas: 'Sudaderas', uniformes: 'Uniformes',
};

export function decodificar(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

function categoriaDe(p) {
  const c = (p.categories || []).map((x) => SUBCATEGORIA[x.slug]).find(Boolean);
  if (c) return c;
  const n = decodificar(p.name).toLowerCase();
  if (n.includes('camisa')) return 'Camisas';
  if (n.includes('conjunto')) return 'Uniformes';
  return 'Accesorios';
}

/** Convierte los atributos de la tienda (talla, color, género, modelo…) en la lista de variantes. Se ignora "Sede". */
export function variantesDe(atributos = []) {
  const prioridad = (n) => (/g[eé]nero/i.test(n) ? 0 : /talla/i.test(n) ? 1 : 2);
  const attrs = atributos
    .filter((a) => !/^\s*sede\s*$/i.test(a.name))
    .map((a) => ({ name: decodificar(a.name), terms: (a.terms || []).map((t) => decodificar(t.name)) }))
    .filter((a) => a.terms.length > 1)
    .sort((a, b) => prioridad(a.name) - prioridad(b.name));
  if (!attrs.length) return [];
  let combos = attrs.reduce((acc, a) => acc.flatMap((c) => a.terms.map((t) => [...c, t])), [[]]);
  if (combos.length > MAX_VARIANTES) {
    const talla = attrs.find((a) => /talla/i.test(a.name));
    combos = talla ? talla.terms.map((t) => [t]) : combos.slice(0, MAX_VARIANTES);
  }
  return combos.map((c) => c.join(' · '));
}

export function normalizarProducto(p) {
  const pr = p.prices || {};
  const precio = pr.price ? Number(pr.price) / 10 ** (pr.currency_minor_unit ?? 2) : 0;
  return {
    tiendaId: p.id,
    nombre: decodificar(p.name),
    categoria: categoriaDe(p),
    tallas: variantesDe(p.attributes),
    precio: precio > 0 ? precio : null,
    moneda: pr.currency_code || 'EUR',
    url: p.permalink || '',
    imagen: p.images?.[0]?.thumbnail || null,
  };
}
