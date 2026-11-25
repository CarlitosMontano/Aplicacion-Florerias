import { CONFIG } from './config.js';

const svgRespaldo = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700"><rect width="900" height="700" fill="#ebcbd2"/><circle cx="450" cy="290" r="92" fill="#c98d9a"/><text x="450" y="455" text-anchor="middle" font-family="Georgia,serif" font-size="46" fill="#344b40">Flor del Nilo</text><text x="450" y="500" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#567060">Imagen de demostración</text></svg>`;
export const FALLBACK_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgRespaldo)}`;

/* Fotografías remotas de demostración bajo licencia Unsplash.
   Si falla la carga, ui.js sustituye la imagen por FALLBACK_IMAGE (SVG propio). */
const foto = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

const PRODUCTOS = [
  {
    id: 'prod-ramo-rosas-clasicas',
    nombre: 'Ramo de rosas clásicas',
    categoria: 'flores',
    descripcion: 'Doce rosas nacionales de temporada con follaje fresco y lazo en tono natural.',
    precioCentavos: 18500,
    imagen: foto('photo-1518895949257-7621c3c786d7')
  },
  {
    id: 'prod-ramo-claveles',
    nombre: 'Ramo de claveles',
    categoria: 'flores',
    descripcion: 'Claveles en tonos suaves, ideales para un detalle sencillo y duradero.',
    precioCentavos: 12000,
    imagen: foto('photo-1526047932273-341f2a7631f9')
  },
  {
    id: 'prod-arreglo-girasoles',
    nombre: 'Arreglo de girasoles',
    categoria: 'flores',
    descripcion: 'Girasoles alegres con follaje verde y presentación en papel kraft.',
    precioCentavos: 16500,
    imagen: foto('photo-1508614589041-895b88991e3e')
  },
  {
    id: 'prod-arreglo-follaje',
    nombre: 'Arreglo de follaje',
    categoria: 'follaje',
    descripcion: 'Combinación de hojas verdes y texturas naturales para espacios y escritorios.',
    precioCentavos: 9500,
    imagen: foto('photo-1487070183336-b863922373d4')
  },
  {
    id: 'prod-rosas-preservadas',
    nombre: 'Rosas preservadas',
    categoria: 'preservadas',
    descripcion: 'Rosas preservadas en caja, un recuerdo que permanece por mucho más tiempo.',
    precioCentavos: 23000,
    imagen: foto('photo-1523438885200-e635ba2c371e')
  },
  {
    id: 'prod-macetero-floral',
    nombre: 'Macetero floral',
    categoria: 'macetas',
    descripcion: 'Arreglo en macetero de cerámica con flores de temporada y follaje.',
    precioCentavos: 14000,
    imagen: foto('photo-1457089328109-e5d9bd499191')
  },
  {
    id: 'prod-ramo-papel-kraft',
    nombre: 'Ramo en papel kraft',
    categoria: 'papel',
    descripcion: 'Ramo envuelto en papel kraft con cinta de yute y etiqueta personalizada.',
    precioCentavos: 11000,
    imagen: foto('photo-1519378058457-4c29a0a2efac')
  },
  {
    id: 'prod-arreglo-globos',
    nombre: 'Arreglo con globos',
    categoria: 'globos',
    descripcion: 'Globos y flores combinados para celebraciones y cumpleaños.',
    precioCentavos: 13500,
    imagen: foto('photo-1531058020387-3be344556be6')
  },
  {
    id: 'prod-tarjeta-personalizada',
    nombre: 'Tarjeta personalizada',
    categoria: 'tarjetas',
    descripcion: 'Tarjeta impresa con dedicatoria, disponible para acompañar cualquier arreglo.',
    precioCentavos: 4500,
    imagen: foto('photo-1513201099705-a9746e1e201f')
  }
];

export const OCASIONES = [
  { id: 'oc-cumpleanos', titulo: 'Cumpleaños', descripcion: 'Sorprende con color', imagen: foto('photo-1531058020387-3be344556be6') },
  { id: 'oc-aniversario', titulo: 'Aniversario', descripcion: 'Detalles que perduran', imagen: foto('photo-1523438885200-e635ba2c371e') },
  { id: 'oc-agradecimiento', titulo: 'Agradecimiento', descripcion: 'Di gracias con flores', imagen: foto('photo-1490750967868-88aa4486c946') },
  { id: 'oc-recordatorio', titulo: 'Recordatorio', descripcion: 'Un gesto que acompaña', imagen: foto('photo-1518895949257-7621c3c786d7') }
];

export const CATEGORIAS = Object.freeze([...new Set(PRODUCTOS.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, 'es')));

export function createBaseSeed() {
  return {
    schemaVersion: CONFIG.schemaVersion,
    creadoEn: new Date().toISOString(),
    productos: JSON.parse(JSON.stringify(PRODUCTOS)),
    carrito: [],
    pedidos: [],
    clientes: [],
    disponibilidad: {},
    notaDemo: 'Datos ficticios. Contactos pendientes de confirmación comercial.'
  };
}
