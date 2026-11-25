import { update, consumeFIFO, newId, recalcBalances } from './storage.js';

const ahoraISO = () => new Date().toISOString();

function dinero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.max(0, Math.round(numero)) : 0;
}

function activo(valor) {
  return valor !== false && valor !== 'no' && valor !== '0' && valor !== 0;
}

export function formatearCantidad(valor) {
  return Number(valor || 0).toLocaleString('es-BO', { maximumFractionDigits: 3 });
}

function insumoPorId(inventario, id) {
  return (inventario?.insumos || []).find((insumo) => insumo.id === id);
}

function recetaActiva(state, producto) {
  if (!producto) return null;
  return (state?.inventario?.recetas || []).find((receta) =>
    receta.id === producto.recetaId && receta.activo !== false
  ) || null;
}

/** Requerimientos de un producto con existencia actual de cada insumo. */
export function requerimientos(state, producto) {
  const receta = recetaActiva(state, producto);
  if (!receta) return [];
  return receta.items
    .map((item) => {
      const insumo = insumoPorId(state.inventario, item.insumoId);
      if (!insumo) return null;
      const requerido = Number(item.cantidad) || 0;
      const stock = Number(insumo.stockActual) || 0;
      return {
        insumo,
        requerido,
        stock,
        suficiente: insumo.activo !== false && stock + 1e-9 >= requerido
      };
    })
    .filter(Boolean);
}

/** Estado de venta de un producto: manual, por stock o sin receta activa. */
export function estadoProducto(state, producto) {
  if (!producto || producto.activo === false || state?.disponibilidad?.[producto.id] === false) {
    return { disponible: false, etiqueta: 'Agotado', motivo: 'manual' };
  }
  const reqs = requerimientos(state, producto);
  if (!reqs.length) return { disponible: true, etiqueta: 'Disponible', motivo: 'sin-receta', requerimientos: [] };
  const faltan = reqs.filter((req) => !req.suficiente);
  if (!faltan.length) return { disponible: true, etiqueta: 'Disponible', motivo: 'stock', requerimientos: reqs };
  return { disponible: false, etiqueta: 'Sin stock', motivo: 'stock', faltan, requerimientos: reqs };
}

export function productoDisponible(state, producto) {
  return estadoProducto(state, producto).disponible;
}

/**
 * Demanda agregada por insumo de una lista de ítems (carrito o pedido).
 * Solo recetas activas generan consumo.
 */
export function validarDisponibilidad(state, items) {
  const demanda = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const producto = (state.productos || []).find((p) => p.id === item.productId);
    const receta = recetaActiva(state, producto);
    if (!receta) continue;
    const cantidadItems = Math.abs(Number(item.cantidad) || 0);
    for (const req of receta.items) {
      const insumo = insumoPorId(state.inventario, req.insumoId);
      if (!insumo || insumo.activo === false) continue;
      const total = (Number(req.cantidad) || 0) * cantidadItems;
      demanda.set(insumo.id, (demanda.get(insumo.id) || 0) + total);
    }
  }

  const faltantes = [];
  for (const [insumoId, requerido] of demanda) {
    const insumo = insumoPorId(state.inventario, insumoId);
    const stock = Number(insumo.stockActual) || 0;
    if (stock + 1e-9 < requerido) {
      faltantes.push(`${insumo.nombre}: faltan ${formatearCantidad(requerido - stock)} ${insumo.unidad}`);
    }
  }
  return { ok: faltantes.length === 0, faltantes, demanda };
}

/** Descuenta FIFO un pedido ya validado. Mutables: se llama dentro de `update`. */
export function descontarPedido(draft, pedido) {
  const validacion = validarDisponibilidad(draft, pedido.items || []);
  if (!validacion.ok) throw new Error(`Stock insuficiente: ${validacion.faltantes.join(' · ')}`);

  const movimientos = [];
  for (const [insumoId, cantidad] of validacion.demanda) {
    movimientos.push(...consumeFIFO(
      draft,
      insumoId,
      cantidad,
      { tipo: 'pedido', id: pedido.id, itemId: null },
      { fecha: pedido.fechaCreacion || ahoraISO(), motivo: `venta ${pedido.id.slice(-6)}` }
    ));
  }

  pedido.inventarioDescontado = true;
  pedido.inventarioDescontadoEn = ahoraISO();
  pedido.inventarioMovimientos = movimientos.map((movimiento) => movimiento.id);
  return movimientos;
}

export function registrarMovimientoEnDraft(draft, datos) {
  const inventario = draft.inventario;
  const insumo = insumoPorId(inventario, datos.insumoId);
  if (!insumo) throw new Error('Selecciona un insumo válido');

  const tipo = String(datos.tipo || '');
  if (!['entrada', 'ajuste', 'merma'].includes(tipo)) throw new Error('Tipo de movimiento no válido');

  let cantidad = Number(datos.cantidad);
  if (!Number.isFinite(cantidad) || cantidad === 0) throw new Error('La cantidad debe ser distinta de cero');
  cantidad = insumo.permiteDecimales ? Number(cantidad.toFixed(3)) : Math.round(cantidad);
  if (tipo === 'entrada' || tipo === 'merma') cantidad = Math.abs(cantidad);
  if (cantidad === 0) throw new Error('La cantidad debe ser distinta de cero');
  if (tipo === 'ajuste' && cantidad < 0 && Math.abs(cantidad) > (Number(insumo.stockActual) || 0) + 1e-9) {
    throw new Error(`El ajuste no puede dejar ${insumo.nombre} en stock negativo`);
  }

  const fecha = ahoraISO();
  const motivo = String(datos.motivo || '').trim().slice(0, 120);
  const costoUnitarioCentavos = dinero(datos.costoUnitarioCentavos);

  if (tipo === 'merma') {
    // Las mermas son salidas: se consumen FIFO y se vinculan a cada lote afectado.
    const creados = consumeFIFO(
      draft,
      insumo.id,
      cantidad,
      { tipo: datos.origen || 'manual', id: datos.referenciaId || null },
      { tipo: 'merma', fecha, motivo }
    );
    for (const movimiento of creados) {
      inventario.mermas.push({
        id: newId('mer'),
        movimientoId: movimiento.id,
        insumoId: insumo.id,
        fecha,
        motivo
      });
    }
    return creados[0];
  }

  let loteId = typeof datos.loteId === 'string' && datos.loteId ? datos.loteId : null;
  if (tipo === 'entrada') {
    const lote = {
      id: newId('lote'),
      insumoId: insumo.id,
      cantidadInicial: cantidad,
      cantidadActual: 0,
      fechaIngreso: fecha,
      costoUnitarioCentavos,
      proveedorId: typeof datos.proveedorId === 'string' && datos.proveedorId ? datos.proveedorId : (insumo.proveedorId || null),
      activo: true
    };
    inventario.lotes.push(lote);
    loteId = lote.id;
  } else if (loteId) {
    const lote = inventario.lotes.find((item) => item.id === loteId && item.insumoId === insumo.id);
    if (!lote) throw new Error('El lote seleccionado no corresponde al insumo');
    if (cantidad < 0 && Math.abs(cantidad) > (Number(lote.cantidadActual) || 0) + 1e-9) {
      throw new Error(`El ajuste no puede dejar el lote en cantidad negativa`);
    }
  }

  const movimiento = {
    id: newId('mov'),
    tipo,
    insumoId: insumo.id,
    cantidad,
    fecha,
    motivo,
    referencia: { tipo: datos.origen || 'manual', id: datos.referenciaId || null },
    loteId,
    costoUnitarioCentavos,
    saldo: 0
  };
  inventario.movimientos.push(movimiento);
  recalcBalances(draft);
  return movimiento;
}

export async function registrarMovimiento(datos) {
  let creado = null;
  await update((draft) => {
    creado = registrarMovimientoEnDraft(draft, datos);
  });
  return creado;
}

export function guardarInsumoEnDraft(draft, datos, id) {
  const inventario = draft.inventario;
  const existente = id ? inventario.insumos.find((insumo) => insumo.id === id) : null;
  if (id && !existente) throw new Error('Insumo no encontrado');

  const nombre = String(datos.nombre || '').trim();
  if (!nombre) throw new Error('El nombre del insumo es obligatorio');

  const destino = existente || { id: newId('ins'), stockActual: 0 };
  Object.assign(destino, {
    nombre,
    unidad: String(datos.unidad || 'unidad').trim() || 'unidad',
    permiteDecimales: datos.permiteDecimales === true || datos.permiteDecimales === 'si' || datos.permiteDecimales === 'true',
    costoUnitarioCentavos: dinero(datos.costoUnitarioCentavos),
    proveedorId: typeof datos.proveedorId === 'string' && datos.proveedorId ? datos.proveedorId : null,
    activo: activo(datos.activo)
  });
  if (!existente) inventario.insumos.push(destino);
  return destino;
}

export async function guardarInsumo(datos, id) {
  let guardado = null;
  await update((draft) => {
    guardado = guardarInsumoEnDraft(draft, datos, id);
  });
  return guardado;
}

export function guardarRecetaEnDraft(draft, datos, id) {
  const inventario = draft.inventario;
  const existente = id ? inventario.recetas.find((receta) => receta.id === id) : null;
  if (id && !existente) throw new Error('Receta no encontrada');

  const productoId = String(datos.productoId || '');
  const producto = draft.productos.find((p) => p.id === productoId);
  if (!producto) throw new Error('Selecciona un producto válido');

  const items = [];
  for (const [insumoId, valor] of Object.entries(datos.items || {})) {
    const insumo = insumoPorId(inventario, insumoId);
    const cantidad = Number(valor);
    if (!insumo || !Number.isFinite(cantidad) || cantidad <= 0) continue;
    items.push({
      insumoId,
      cantidad: insumo.permiteDecimales ? Number(cantidad.toFixed(3)) : Math.round(cantidad)
    });
  }

  if (existente && existente.productoId !== productoId) {
    const anterior = draft.productos.find((p) => p.id === existente.productoId);
    if (anterior && anterior.recetaId === existente.id) anterior.recetaId = null;
  }

  const receta = existente || { id: newId('rec') };
  Object.assign(receta, {
    productoId,
    nombre: String(datos.nombre || '').trim() || producto.nombre,
    activo: activo(datos.activo),
    items
  });
  if (!existente) inventario.recetas.push(receta);
  producto.recetaId = receta.id;
  return receta;
}

export async function guardarReceta(datos, id) {
  let guardado = null;
  await update((draft) => {
    guardado = guardarRecetaEnDraft(draft, datos, id);
  });
  return guardado;
}
