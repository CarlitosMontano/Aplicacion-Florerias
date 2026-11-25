import { CONFIG, FX_CONFIG } from '../config.js';
import { createSeedState } from './seed.js';
import { newId, deltaMovimiento, consumeFIFO, recalcBalances } from './ledger.js';

export { newId, deltaMovimiento, consumeFIFO, recalcBalances };

const KEY = CONFIG.storageKey;
const VERSION = 2;
const TIPOS_MOVIMIENTO = new Set(['apertura', 'entrada', 'salida', 'ajuste', 'merma']);
const CLAVES_V2 = new Set([
  'schemaVersion', 'creadoEn', 'actualizadoEn', 'migradoEn', 'productos', 'carrito',
  'pedidos', 'clientes', 'disponibilidad', 'notaDemo', 'preferencias', 'inventario', 'legacy'
]);

const listeners = new Set();
let queue = Promise.resolve();
let memoryState = null;
let fallbackActive = false;
let fallbackReason = '';
let warningSent = false;
let respaldoSecuencia = 0;

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function esObjeto(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cadena(value, defecto = '') {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return defecto;
}

function dinero(value) {
  const numero = Number(value);
  return Number.isFinite(numero) ? Math.max(0, Math.round(numero)) : 0;
}

function cantidad(value, permiteDecimales) {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return 0;
  return permiteDecimales ? Number(numero.toFixed(3)) : Math.round(numero);
}

function fecha(value, defecto) {
  if (typeof value !== 'string' || !value.trim() || Number.isNaN(Date.parse(value))) return defecto;
  return value;
}

function arreglo(value, defecto) {
  if (Array.isArray(value)) return value;
  return Array.isArray(defecto) ? clone(defecto) : [];
}

function mapa(value) {
  return esObjeto(value) ? clone(value) : {};
}

function normalizarPreferencias(value, defecto = FX_CONFIG.preferenciasPorDefecto) {
  const base = esObjeto(defecto) ? defecto : FX_CONFIG.preferenciasPorDefecto;
  const origen = esObjeto(value) ? value : {};
  return {
    reducirAnimaciones: typeof origen.reducirAnimaciones === 'boolean'
      ? origen.reducirAnimaciones
      : base.reducirAnimaciones === true
  };
}

function notify(state, event) {
  for (const listener of [...listeners]) {
    try {
      listener(state, event);
    } catch (error) {
      console.error('[storage] listener falló:', error);
    }
  }
}

function activateFallback(error) {
  fallbackActive = true;
  fallbackReason = error && error.name === 'QuotaExceededError'
    ? 'cuota de almacenamiento llena'
    : 'almacenamiento bloqueado o no disponible';
  if (!warningSent) {
    warningSent = true;
    notify(memoryState, {
      type: 'warning',
      source: 'fallback',
      message: `No se pudo usar el almacenamiento del navegador (${fallbackReason}). Se usa memoria temporal: los cambios se perderán al recargar.`
    });
  }
}

function guardarRespaldo(tipo, texto) {
  try {
    respaldoSecuencia += 1;
    const marca = `${new Date().toISOString().replace(/[:.]/g, '-')}-${respaldoSecuencia}`;
    const clave = `${KEY}.${tipo}-${marca}`;
    localStorage.setItem(clave, String(texto));
    return clave;
  } catch (error) {
    activateFallback(error);
    return null;
  }
}

function normalizarInsumos(rawInsumos, baseInsumos) {
  const origen = arreglo(rawInsumos, baseInsumos);
  return origen.filter(esObjeto).map((insumo) => ({
    ...insumo,
    id: cadena(insumo.id, newId('ins')),
    nombre: cadena(insumo.nombre, 'Insumo sin nombre'),
    unidad: cadena(insumo.unidad, 'unidad'),
    permiteDecimales: insumo.permiteDecimales === true,
    costoUnitarioCentavos: dinero(insumo.costoUnitarioCentavos),
    proveedorId: typeof insumo.proveedorId === 'string' ? insumo.proveedorId : null,
    activo: insumo.activo !== false,
    stockActual: 0
  }));
}

function normalizarInventario(rawInventario, baseInventario) {
  const inventario = esObjeto(rawInventario) ? rawInventario : {};
  const proveedores = arreglo(inventario.proveedores, baseInventario.proveedores)
    .filter(esObjeto)
    .map((proveedor) => ({
      ...proveedor,
      id: cadena(proveedor.id, newId('prov')),
      nombre: cadena(proveedor.nombre, 'Proveedor sin nombre'),
      telefono: cadena(proveedor.telefono, ''),
      direccion: cadena(proveedor.direccion, ''),
      activo: proveedor.activo !== false
    }));

  const insumos = normalizarInsumos(inventario.insumos, baseInventario.insumos);
  const porId = new Map(insumos.map((insumo) => [insumo.id, insumo]));

  const lotes = arreglo(inventario.lotes, baseInventario.lotes)
    .filter(esObjeto)
    .map((lote) => {
      const insumo = porId.get(lote.insumoId);
      return {
        ...lote,
        id: cadena(lote.id, newId('lote')),
        insumoId: insumo ? insumo.id : cadena(lote.insumoId, ''),
        cantidadInicial: cantidad(lote.cantidadInicial, insumo?.permiteDecimales === true),
        cantidadActual: 0,
        fechaIngreso: fecha(lote.fechaIngreso, new Date().toISOString()),
        costoUnitarioCentavos: dinero(lote.costoUnitarioCentavos),
        proveedorId: typeof lote.proveedorId === 'string' ? lote.proveedorId : null,
        activo: lote.activo !== false
      };
    });

  const movimientos = arreglo(inventario.movimientos, baseInventario.movimientos)
    .filter(esObjeto)
    .map((movimiento) => {
      const insumo = porId.get(movimiento.insumoId);
      return {
        ...movimiento,
        id: cadena(movimiento.id, newId('mov')),
        tipo: TIPOS_MOVIMIENTO.has(movimiento.tipo) ? movimiento.tipo : 'ajuste',
        insumoId: insumo ? insumo.id : cadena(movimiento.insumoId, ''),
        loteId: typeof movimiento.loteId === 'string' ? movimiento.loteId : null,
        cantidad: cantidad(movimiento.cantidad, insumo?.permiteDecimales === true),
        fecha: fecha(movimiento.fecha, new Date().toISOString()),
        motivo: cadena(movimiento.motivo, ''),
        referencia: esObjeto(movimiento.referencia) ? clone(movimiento.referencia) : { tipo: 'manual', id: null },
        costoUnitarioCentavos: dinero(movimiento.costoUnitarioCentavos),
        saldo: 0
      };
    });

  const recetas = arreglo(inventario.recetas, baseInventario.recetas)
    .filter(esObjeto)
    .map((receta) => ({
      ...receta,
      id: cadena(receta.id, newId('rec')),
      productoId: cadena(receta.productoId, ''),
      nombre: cadena(receta.nombre, 'Receta sin nombre'),
      activo: receta.activo !== false,
      items: arreglo(receta.items, [])
        .filter(esObjeto)
        .map((item) => {
          const insumo = porId.get(item.insumoId);
          return {
            ...item,
            insumoId: insumo ? insumo.id : cadena(item.insumoId, ''),
            cantidad: cantidad(item.cantidad, insumo?.permiteDecimales === true)
          };
        })
    }));

  const mermas = arreglo(inventario.mermas, [])
    .filter(esObjeto)
    .map((merma) => {
      const insumo = porId.get(merma.insumoId);
      return {
        ...merma,
        id: cadena(merma.id, newId('mer')),
        insumoId: insumo ? insumo.id : cadena(merma.insumoId, ''),
        movimientoId: typeof merma.movimientoId === 'string' ? merma.movimientoId : null,
        fecha: fecha(merma.fecha, new Date().toISOString()),
        motivo: cadena(merma.motivo, '')
      };
    });

  return {
    ...inventario,
    proveedores,
    insumos,
    lotes,
    movimientos,
    recetas,
    mermas,
    configuracion: esObjeto(inventario.configuracion)
      ? clone(inventario.configuracion)
      : clone(baseInventario.configuracion)
  };
}

function normalizarProductos(rawProductos, baseProductos, recetas) {
  const productos = arreglo(rawProductos, baseProductos)
    .filter(esObjeto)
    .map((producto) => ({
      ...producto,
      id: cadena(producto.id, newId('prod')),
      nombre: cadena(producto.nombre, 'Producto sin nombre'),
      categoria: cadena(producto.categoria, 'general'),
      descripcion: cadena(producto.descripcion, ''),
      imagen: cadena(producto.imagen, ''),
      precioCentavos: dinero(producto.precioCentavos),
      activo: producto.activo !== false
    }));

  const recetasPorId = new Map(recetas.map((receta) => [receta.id, receta]));
  const recetasPorProducto = new Map(recetas.filter((r) => r.productoId).map((r) => [r.productoId, r.id]));
  const recetasPorNombre = new Map(recetas.filter((r) => r.nombre).map((r) => [r.nombre, r.id]));

  for (const producto of productos) {
    if (!recetasPorProducto.has(producto.id) && recetasPorNombre.has(producto.nombre)) {
      recetasPorProducto.set(producto.id, recetasPorNombre.get(producto.nombre));
    }
    if (typeof producto.recetaId !== 'string' || !recetasPorId.has(producto.recetaId)) {
      const recetaGenerada = {
        id: newId('rec'),
        productoId: producto.id,
        nombre: `Receta ${producto.nombre}`,
        activo: false,
        items: [],
        generadaPorNormalizacion: true
      };
      recetas.push(recetaGenerada);
      recetasPorId.set(recetaGenerada.id, recetaGenerada);
      recetasPorProducto.set(producto.id, recetaGenerada.id);
      producto.recetaId = recetaGenerada.id;
    }
  }
  return productos;
}

function normalizarItemCarrito(item) {
  const entry = esObjeto(item) ? item : {};
  return {
    ...entry,
    id: cadena(entry.id, newId('item')),
    productId: cadena(entry.productId, ''),
    nombre: cadena(entry.nombre, ''),
    imagen: cadena(entry.imagen, ''),
    precioCentavos: dinero(entry.precioCentavos),
    cantidad: Math.max(1, Math.round(Number(entry.cantidad) || 1)),
    opciones: mapa(entry.opciones),
    dedicatoria: cadena(entry.dedicatoria, '')
  };
}

function normalizarPedidos(rawPedidos) {
  const hoy = new Date().toISOString();
  return arreglo(rawPedidos, [])
    .filter(esObjeto)
    .map((pedido) => ({
      ...pedido,
      id: cadena(pedido.id, newId('ped')),
      fechaCreacion: fecha(pedido.fechaCreacion, hoy),
      fechaEntrega: fecha(pedido.fechaEntrega, hoy.slice(0, 10)),
      estado: CONFIG.estadosPedido.includes(pedido.estado) ? pedido.estado : 'Pendiente',
      items: arreglo(pedido.items, []).filter(esObjeto),
      totalCentavos: dinero(pedido.totalCentavos),
      inventarioDescontado: pedido.inventarioDescontado === true
    }));
}

/** Normaliza cualquier forma tolerada a un estado v2 completo y recalcula saldos. */
export function normalizeState(raw) {
  const base = createSeedState();
  if (!esObjeto(raw)) return base;

  const legacy = mapa(raw.legacy);
  for (const [clave, valor] of Object.entries(raw)) {
    if (clave !== 'legacy' && !CLAVES_V2.has(clave)) legacy[clave] = clone(valor);
  }

  const inventario = normalizarInventario(raw.inventario, base.inventario);
  const state = {
    schemaVersion: VERSION,
    creadoEn: fecha(raw.creadoEn, base.creadoEn),
    productos: normalizarProductos(raw.productos, base.productos, inventario.recetas),
    carrito: arreglo(raw.carrito, []).filter(esObjeto).map(normalizarItemCarrito),
    pedidos: normalizarPedidos(raw.pedidos),
    clientes: arreglo(raw.clientes, []).filter(esObjeto).map((cliente) => ({ ...cliente })),
    disponibilidad: mapa(raw.disponibilidad),
    inventario,
    notaDemo: cadena(raw.notaDemo, base.notaDemo),
    preferencias: normalizarPreferencias(raw.preferencias, base.preferencias),
    legacy
  };
  if (typeof raw.actualizadoEn === 'string') state.actualizadoEn = raw.actualizadoEn;
  if (typeof raw.migradoEn === 'string') state.migradoEn = raw.migradoEn;
  return recalcBalances(state);
}

function validate(state) {
  if (!esObjeto(state)) throw new Error('El estado debe ser un objeto');
  for (const clave of ['productos', 'carrito', 'pedidos', 'clientes']) {
    if (!Array.isArray(state[clave])) throw new Error(`Falta la colección ${clave}`);
  }
  if (!esObjeto(state.disponibilidad)) throw new Error('Falta el mapa disponibilidad');
  if (!esObjeto(state.inventario)) throw new Error('Falta el inventario');
  for (const clave of ['insumos', 'proveedores', 'movimientos', 'recetas', 'lotes', 'mermas']) {
    if (!Array.isArray(state.inventario[clave])) throw new Error(`Falta la colección de inventario ${clave}`);
  }
  return true;
}

export async function getAll() {
  if (fallbackActive) return clone(memoryState || createSeedState());
  try {
    const rawText = localStorage.getItem(KEY);
    if (rawText == null) return clone(await save(createSeedState()));

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return clone(await migrateV1(rawText));
    }

    if (!esObjeto(parsed) || Number(parsed.schemaVersion) !== VERSION) {
      return clone(await migrateV1(parsed, { rawText }));
    }

    const state = normalizeState(parsed);
    memoryState = clone(state);
    return clone(state);
  } catch (error) {
    activateFallback(error);
    if (!memoryState) memoryState = createSeedState();
    return clone(memoryState);
  }
}

export async function save(state, opciones = {}) {
  validate(state);
  const next = clone(state);
  next.schemaVersion = VERSION;
  next.actualizadoEn = new Date().toISOString();
  recalcBalances(next);
  memoryState = clone(next);

  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    if (fallbackActive) {
      fallbackActive = false;
      fallbackReason = '';
      warningSent = false;
    }
  } catch (error) {
    activateFallback(error);
  }

  const resultado = clone(next);
  notify(resultado, { type: opciones.tipo || 'change', source: opciones.source || 'local' });
  return resultado;
}

export function update(mutator, opciones = {}) {
  if (typeof mutator !== 'function') return Promise.reject(new Error('update requiere una función'));
  const ejecucion = queue.then(async () => {
    const actual = await getAll();
    const borrador = clone(actual);
    const resultado = await mutator(borrador);
    if (resultado === false) return clone(actual);
    return save(borrador, opciones);
  });
  queue = ejecucion.catch(() => {});
  return ejecucion;
}

/**
 * Migra una forma v1 (cualquier forma, incluso desconocida) a v2.
 * Acepta texto JSON o un objeto ya parseado. Guarda el original en
 * `.backup-<fecha>` o `.corrupt-<fecha>` y escribe el estado migrado una sola vez.
 */
export async function migrateV1(origen, opciones = {}) {
  const rawText = typeof opciones.rawText === 'string'
    ? opciones.rawText
    : (typeof origen === 'string' ? origen : null);
  let parsed = origen;

  if (typeof origen === 'string') {
    try {
      parsed = JSON.parse(origen);
    } catch {
      guardarRespaldo('corrupt', rawText ?? origen);
      return save(normalizeState(null));
    }
  }

  if (!opciones.forzar && esObjeto(parsed) && Number(parsed.schemaVersion) === VERSION) {
    return clone(normalizeState(parsed));
  }

  const textoRespaldo = rawText != null ? rawText : JSON.stringify(parsed == null ? null : parsed);
  guardarRespaldo('backup', textoRespaldo);

  const state = normalizeState(parsed);
  if (!esObjeto(parsed)) state.legacy.__raizNoObjeto = clone(parsed);
  state.migradoEn = new Date().toISOString();
  state.legacy = state.legacy || {};
  state.legacy.__migracion = {
    desdeVersion: esObjeto(parsed) ? (parsed.schemaVersion ?? null) : null,
    fecha: state.migradoEn
  };
  return save(state);
}

/** Restaura la semilla completa v2 y limpia `legacy` (los respaldos se conservan). */
export async function reset() {
  const state = createSeedState();
  state.legacy = {};
  return save(state);
}

export async function remove() {
  memoryState = null;
  try {
    localStorage.removeItem(KEY);
  } catch (error) {
    activateFallback(error);
  }
  notify(null, { type: 'change', source: 'local', removed: true });
}

export function subscribe(listener) {
  if (typeof listener !== 'function') throw new Error('subscribe requiere una función');
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function getPreferencias() {
  const estado = await getAll();
  return normalizarPreferencias(estado.preferencias);
}

export async function setPreferencias(valores) {
  const actual = await getAll();
  const siguiente = normalizarPreferencias(valores, actual.preferencias);
  const anterior = normalizarPreferencias(actual.preferencias);
  if (JSON.stringify(siguiente) === JSON.stringify(anterior)) return actual;
  return update((draft) => {
    draft.preferencias = siguiente;
  }, { tipo: 'preferencias' });
}

export function isFallback() {
  return fallbackActive;
}

export function getFallbackReason() {
  return fallbackReason;
}

window.addEventListener('storage', (event) => {
  if (event.key !== KEY) return;
  try {
    if (event.newValue == null) {
      memoryState = null;
      notify(null, { type: 'change', source: 'storage', removed: true });
      return;
    }
    const parsed = JSON.parse(event.newValue);
    const anterior = memoryState;
    const state = normalizeState(parsed);
    memoryState = clone(state);
    const sinPreferencias = (valor) => {
      const copia = clone(valor || {});
      delete copia.preferencias;
      return JSON.stringify(copia);
    };
    const soloPreferencias = sinPreferencias(anterior) === sinPreferencias(state);
    notify(clone(state), { type: soloPreferencias ? 'preferencias' : 'change', source: 'storage' });
  } catch {
    notify(memoryState, {
      type: 'warning',
      source: 'storage',
      message: 'Otra pestaña guardó datos no válidos. Se mantuvo la información local.'
    });
  }
});

if (typeof window !== 'undefined') {
  window.__debug = { getAll, migrateV1, reset, getPreferencias, setPreferencias };
}
