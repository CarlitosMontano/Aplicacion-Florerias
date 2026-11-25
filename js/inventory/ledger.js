export function newId(prefix = 'id') {
  const uuid = globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}

function redondear(valor) {
  return Number(Number(valor || 0).toFixed(3));
}

export function deltaMovimiento(movimiento) {
  const cantidad = Math.abs(Number(movimiento?.cantidad || 0));
  if (movimiento?.tipo === 'ajuste') return redondear(Number(movimiento.cantidad || 0));
  if (movimiento?.tipo === 'entrada' || movimiento?.tipo === 'apertura') return redondear(cantidad);
  if (movimiento?.tipo === 'salida' || movimiento?.tipo === 'merma') return -redondear(cantidad);
  return 0;
}

export function recalcBalances(state) {
  const inventario = state?.inventario;
  if (!inventario) return state;
  const movimientos = Array.isArray(inventario.movimientos) ? inventario.movimientos : [];
  const ordenados = [...movimientos].sort((a, b) =>
    String(a.fecha || '').localeCompare(String(b.fecha || '')) || String(a.id || '').localeCompare(String(b.id || ''))
  );

  const saldos = new Map();
  for (const movimiento of ordenados) {
    const saldo = redondear((saldos.get(movimiento.insumoId) || 0) + deltaMovimiento(movimiento));
    saldos.set(movimiento.insumoId, saldo);
    movimiento.saldo = saldo;
  }

  for (const insumo of Array.isArray(inventario.insumos) ? inventario.insumos : []) {
    insumo.stockActual = redondear(saldos.get(insumo.id) || 0);
  }

  for (const lote of Array.isArray(inventario.lotes) ? inventario.lotes : []) {
    lote.cantidadActual = redondear(
      ordenados.filter((movimiento) => movimiento.loteId === lote.id)
        .reduce((suma, movimiento) => suma + deltaMovimiento(movimiento), 0)
    );
  }
  return state;
}

export function consumeFIFO(state, insumoId, cantidad, referencia = { tipo: 'manual', id: null }, opciones = {}) {
  const requerido = Math.abs(Number(cantidad || 0));
  if (!insumoId || requerido <= 0) throw new Error('Consumo FIFO inválido');
  const inventario = state?.inventario;
  if (!inventario || !Array.isArray(inventario.movimientos)) throw new Error('Inventario no inicializado');

  const lotes = (Array.isArray(inventario.lotes) ? inventario.lotes : [])
    .filter((lote) => lote.insumoId === insumoId && lote.activo !== false && Number(lote.cantidadActual || 0) > 0)
    .sort((a, b) => String(a.fechaIngreso).localeCompare(String(b.fechaIngreso)) || String(a.id).localeCompare(String(b.id)));

  let restante = redondear(requerido);
  const plan = [];
  for (const lote of lotes) {
    if (restante <= 0) break;
    const tomar = redondear(Math.min(restante, Number(lote.cantidadActual)));
    plan.push({ lote, tomar });
    restante = redondear(restante - tomar);
  }

  // No se muta el ledger si no hay stock suficiente: las salidas son atómicas.
  if (restante > 0) throw new Error(`Stock insuficiente para ${insumoId}: faltan ${restante}`);

  const creados = plan.map(({ lote, tomar }) => {
    const movimiento = {
      id: newId('mov'),
      tipo: opciones.tipo || 'salida',
      insumoId,
      cantidad: tomar,
      fecha: opciones.fecha || new Date().toISOString(),
      motivo: opciones.motivo || 'consumo',
      referencia: { ...referencia },
      loteId: lote.id,
      costoUnitarioCentavos: Number(lote.costoUnitarioCentavos) || 0,
      saldo: 0
    };
    inventario.movimientos.push(movimiento);
    return movimiento;
  });

  recalcBalances(state);
  return creados;
}
