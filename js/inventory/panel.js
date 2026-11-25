import { getAll, update, recalcBalances } from './storage.js';
import { formatearCantidad, registrarMovimiento, guardarInsumo, guardarReceta } from './operations.js';
import * as ui from '../ui.js';

const VISTAS = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'insumos', etiqueta: 'Insumos' },
  { id: 'recetas', etiqueta: 'Recetas' },
  { id: 'lotes', etiqueta: 'Lotes' },
  { id: 'movimientos', etiqueta: 'Movimientos' },
  { id: 'mermas', etiqueta: 'Mermas' }
];

let vista = 'resumen';
let instancia = null;
let eventosListos = false;
let ultimoEstado = null;
let onRecargar = null;

function fmtCantidad(valor, unidad) {
  const texto = formatearCantidad(valor);
  return unidad ? `${texto} ${unidad}` : texto;
}

function fmtFecha(iso) {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
}

function insumoPorId(state, id) {
  return (state.inventario?.insumos || []).find((insumo) => insumo.id === id);
}

function productoPorId(state, id) {
  return (state.productos || []).find((producto) => producto.id === id);
}

function lotePorId(state, id) {
  return (state.inventario?.lotes || []).find((lote) => lote.id === id);
}

function diasParaCaducar(fechaISO) {
  if (!fechaISO) return null;
  const fecha = new Date(`${fechaISO}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.ceil((fecha.getTime() - hoy.getTime()) / 86400000);
}

function estadoLote(lote) {
  if (lote.activo === false || Number(lote.cantidadActual) <= 0) return 'Agotado';
  const dias = diasParaCaducar(lote.fechaCaducidad);
  if (dias === null) return 'Activo';
  if (dias < 0) return 'Vencido';
  if (dias <= 7) return 'Por vencer';
  return 'Activo';
}

function boton(label, accion, primario = false) {
  return ui.raw(ui.tpl`<button type="button" class="button small ${primario ? 'primary' : 'ghost'}" data-accion="${accion}">${label}</button>`);
}

function tabla(headers, filas, vacio) {
  if (!filas.length) return `<p class="small-note">${ui.escapeHtml(vacio)}</p>`;
  const cabeceras = headers.map((h) => ui.tpl`<th>${h}</th>`).join('');
  return ui.tpl`<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${ui.raw(cabeceras)}</tr></thead><tbody>${ui.raw(filas.join(''))}</tbody></table></div>`;
}

function barraStock(insumo, maximo) {
  const actual = Math.max(0, Number(insumo.stockActual) || 0);
  const minimo = Number(insumo.stockMinimo) || 0;
  const ancho = Math.min(100, Math.round((actual / maximo) * 100));
  return ui.tpl`<span class="stock-bar${actual <= minimo ? ' bajo' : ''}" aria-hidden="true"><i style="width:${ancho}%"></i></span>`;
}

function renderResumen(state) {
  const inventario = state.inventario || {};
  const insumos = inventario.insumos || [];
  const lotes = inventario.lotes || [];
  const movimientos = inventario.movimientos || [];
  const criticos = insumos.filter((insumo) => insumo.activo !== false && (Number(insumo.stockActual) || 0) <= (Number(insumo.stockMinimo) || 0));
  const lotesActivos = lotes.filter((lote) => lote.activo !== false && (Number(lote.cantidadActual) || 0) > 0);
  const vencidos = lotesActivos.filter((lote) => {
    const dias = diasParaCaducar(lote.fechaCaducidad);
    return dias !== null && dias < 0;
  });
  const recientes = [...movimientos].slice(-8).reverse();
  const criticosHtml = criticos.length
    ? criticos.map((insumo) => ui.tpl`<li>${insumo.nombre}: ${fmtCantidad(insumo.stockActual, insumo.unidad)} (mín. ${fmtCantidad(insumo.stockMinimo, insumo.unidad)})</li>`).join('')
    : '<li>No hay insumos por debajo del mínimo.</li>';
  const recientesHtml = recientes.length
    ? recientes.map((movimiento) => {
      const insumo = insumoPorId(state, movimiento.insumoId);
      return ui.tpl`<li>${fmtFecha(movimiento.fecha)} · ${movimiento.tipo} · ${insumo ? insumo.nombre : movimiento.insumoId} · ${fmtCantidad(movimiento.cantidad, insumo?.unidad)}</li>`;
    }).join('')
    : '<li>Aún no hay movimientos.</li>';

  return ui.tpl`
    <div class="metrics-grid">
      <div class="metric-card"><strong>${insumos.length}</strong><small>Insumos</small></div>
      <div class="metric-card"><strong>${lotesActivos.length}</strong><small>Lotes activos</small></div>
      <div class="metric-card"><strong>${criticos.length}</strong><small>Bajo mínimo</small></div>
      <div class="metric-card"><strong>${vencidos.length}</strong><small>Lotes vencidos</small></div>
    </div>
    <div class="admin-panels">
      <div class="admin-panel"><h3>Reposición sugerida</h3><ul>${ui.raw(criticosHtml)}</ul></div>
      <div class="admin-panel"><h3>Últimos movimientos</h3><ul>${ui.raw(recientesHtml)}</ul></div>
    </div>`;
}

function renderInsumos(state) {
  const insumos = state.inventario?.insumos || [];
  const maximo = Math.max(1, ...insumos.map((insumo) => Math.max(0, Number(insumo.stockActual) || 0)));
  const filas = insumos.map((insumo) => ui.tpl`
    <tr>
      <td>${insumo.nombre}${insumo.activo === false ? ' (inactivo)' : ''}</td>
      <td>${insumo.unidad}</td>
      <td>${fmtCantidad(insumo.stockActual, insumo.unidad)}${ui.raw(barraStock(insumo, maximo))}</td>
      <td>${fmtCantidad(insumo.stockMinimo, insumo.unidad)}</td>
      <td>${ui.formatMoney(insumo.costoUnitarioCentavos || 0)}</td>
      <td class="admin-actions">
        ${boton('Entrada', `entrada:${insumo.id}`)}
        ${boton('Editar', `insumo:${insumo.id}`)}
        ${boton(insumo.activo === false ? 'Activar' : 'Desactivar', `toggle-insumo:${insumo.id}`)}
      </td>
    </tr>`);
  return ui.tpl`
    <div class="admin-actions">
      ${boton('Nuevo insumo', 'insumo:nuevo', true)}
      ${boton('Ver mermas', 'mermas')}
    </div>
    ${ui.raw(tabla(['Insumo', 'Unidad', 'Stock', 'Mínimo', 'Costo', 'Acciones'], filas, 'Registra el primer insumo para comenzar.'))}`;
}

function renderRecetas(state) {
  const filas = (state.inventario?.recetas || []).map((receta) => {
    const producto = productoPorId(state, receta.productoId);
    const detalle = (receta.items || []).map((item) => {
      const insumo = insumoPorId(state, item.insumoId);
      return `${insumo?.nombre || item.insumoId}: ${fmtCantidad(item.cantidad, insumo?.unidad)}`;
    }).join(' · ');
    return ui.tpl`
      <tr>
        <td>${receta.nombre || producto?.nombre || 'Receta'}</td>
        <td>${producto ? producto.nombre : 'Producto no disponible'}</td>
        <td>${detalle || 'Sin insumos'}</td>
        <td><span class="status-pill">${receta.activo === false ? 'Inactiva' : 'Activa'}</span></td>
        <td class="admin-actions">
          ${boton('Editar', `receta:${receta.id}`)}
          ${boton(receta.activo === false ? 'Activar' : 'Desactivar', `toggle-receta:${receta.id}`)}
        </td>
      </tr>`;
  });
  return ui.tpl`
    <div class="admin-actions">${boton('Nueva receta', 'receta:nueva', true)}</div>
    ${ui.raw(tabla(['Receta', 'Producto', 'Insumos por unidad', 'Estado', 'Acciones'], filas, 'No hay recetas registradas.'))}`;
}

function renderLotes(state) {
  const filas = (state.inventario?.lotes || []).map((lote) => {
    const insumo = insumoPorId(state, lote.insumoId);
    return ui.tpl`
      <tr>
        <td>${insumo?.nombre || lote.insumoId}</td>
        <td>${fmtCantidad(lote.cantidadInicial, insumo?.unidad)}</td>
        <td>${fmtCantidad(lote.cantidadActual, insumo?.unidad)}</td>
        <td>${fmtFecha(lote.fechaIngreso)}</td>
        <td>${lote.fechaCaducidad || '—'}</td>
        <td><span class="status-pill">${estadoLote(lote)}</span></td>
        <td class="admin-actions">${boton('Ajustar', `ajuste:${insumo?.id || ''}`)}</td>
      </tr>`;
  });
  return ui.tpl`
    <div class="admin-actions">${boton('Nueva entrada', 'entrada:nueva', true)}</div>
    ${ui.raw(tabla(['Insumo', 'Inicial', 'Actual', 'Ingreso', 'Caducidad', 'Estado', 'Acciones'], filas, 'No hay lotes registrados.'))}`;
}

function renderMovimientos(state) {
  const filas = (state.inventario?.movimientos || []).slice().reverse().map((movimiento) => {
    const insumo = insumoPorId(state, movimiento.insumoId);
    const lote = movimiento.loteId ? lotePorId(state, movimiento.loteId) : null;
    return ui.tpl`
      <tr>
        <td>${fmtFecha(movimiento.fecha)}</td>
        <td>${movimiento.tipo}</td>
        <td>${insumo?.nombre || movimiento.insumoId}</td>
        <td>${movimiento.cantidad > 0 ? '+' : ''}${fmtCantidad(movimiento.cantidad, insumo?.unidad)}</td>
        <td>${movimiento.motivo || '—'}</td>
        <td>${lote ? lote.id.slice(-6) : '—'}</td>
      </tr>`;
  });
  return ui.tpl`
    <div class="admin-actions">
      ${boton('Nueva entrada', 'entrada:nueva', true)}
      ${boton('Registrar merma', 'merma:nueva')}
    </div>
    ${ui.raw(tabla(['Fecha', 'Tipo', 'Insumo', 'Cantidad', 'Motivo', 'Lote'], filas, 'Todavía no hay movimientos.'))}`;
}

function renderMermas(state) {
  const filas = (state.inventario?.mermas || []).slice().reverse().map((merma) => {
    const insumo = insumoPorId(state, merma.insumoId);
    const movimiento = (state.inventario?.movimientos || []).find((item) => item.id === merma.movimientoId);
    return ui.tpl`
      <tr>
        <td>${fmtFecha(merma.fecha)}</td>
        <td>${insumo?.nombre || merma.insumoId}</td>
        <td>${movimiento ? fmtCantidad(Math.abs(movimiento.cantidad), insumo?.unidad) : '—'}</td>
        <td>${merma.motivo || '—'}</td>
        <td class="admin-actions">${boton('Eliminar', `merma-eliminar:${merma.id}`)}</td>
      </tr>`;
  });
  return ui.tpl`
    <div class="admin-actions">${boton('Registrar merma', 'merma:nueva', true)}</div>
    ${ui.raw(tabla(['Fecha', 'Insumo', 'Cantidad', 'Motivo', 'Acciones'], filas, 'No se han registrado mermas.'))}`;
}

function renderContenido(state) {
  const contenidos = {
    resumen: renderResumen,
    insumos: renderInsumos,
    recetas: renderRecetas,
    lotes: renderLotes,
    movimientos: renderMovimientos,
    mermas: renderMermas
  };
  return (contenidos[vista] || renderResumen)(state);
}

function render(state = ultimoEstado) {
  ultimoEstado = state || null;
  if (!instancia) return;
  const nav = VISTAS.map((item) => ui.tpl`<button type="button" class="button small ${item.id === vista ? 'primary' : 'ghost'}" data-vista="${item.id}">${item.etiqueta}</button>`).join('');
  ui.setHTML(instancia.nav, nav);
  ui.setHTML(instancia.contenido, renderContenido(state || { inventario: {}, productos: [] }));
}

function asegurarModal() {
  let modal = document.getElementById('modal-generico');
  if (modal) return modal;
  modal = document.createElement('dialog');
  modal.className = 'modal';
  modal.id = 'modal-generico';
  ui.setHTML(modal, ui.tpl`
    <button class="modal-close" type="button" data-close-modal aria-label="Cerrar">×</button>
    <div class="detail-copy" style="padding:28px">
      <h3 id="modal-generico-titulo"></h3>
      <div id="modal-generico-cuerpo"></div>
    </div>
  `);
  document.body.appendChild(modal);
  return modal;
}

function abrirModal(titulo, cuerpo) {
  const modal = asegurarModal();
  const tituloNode = modal.querySelector('#modal-generico-titulo');
  const cuerpoNode = modal.querySelector('#modal-generico-cuerpo');
  if (tituloNode) tituloNode.textContent = titulo;
  if (cuerpoNode) ui.setHTML(cuerpoNode, cuerpo);
  ui.openModal('modal-generico');
  return modal;
}

function cerrarModal() {
  ui.closeModal('modal-generico');
}

function campoTexto(nombre, etiqueta, valor = '', tipo = 'text', attrs = '') {
  return ui.tpl`<label><span>${etiqueta}</span><input type="${tipo}" name="${nombre}" value="${valor}" ${ui.raw(attrs)}></label>`;
}

function campoSelect(nombre, etiqueta, opciones, seleccionado = '') {
  const html = opciones.map((opcion) => `<option value="${ui.escapeHtml(opcion.valor)}"${opcion.valor === seleccionado ? ' selected' : ''}>${ui.escapeHtml(opcion.etiqueta)}</option>`).join('');
  return ui.tpl`<label><span>${etiqueta}</span><select name="${nombre}">${ui.raw(html)}</select></label>`;
}

function opcionesInsumos(state) {
  return (state.inventario?.insumos || []).filter((insumo) => insumo.activo !== false).map((insumo) => ({
    valor: insumo.id,
    etiqueta: `${insumo.nombre} (${fmtCantidad(insumo.stockActual, insumo.unidad)} ${insumo.unidad})`
  }));
}

function opcionesLotes(state, insumoId) {
  const insumo = insumoPorId(state, insumoId);
  return (state.inventario?.lotes || [])
    .filter((lote) => lote.insumoId === insumoId && Number(lote.cantidadActual) > 0 && lote.activo !== false)
    .map((lote) => ({
      valor: lote.id,
      etiqueta: `${fmtFecha(lote.fechaIngreso)} · ${fmtCantidad(lote.cantidadActual, insumo?.unidad)} ${insumo?.unidad || ''}`
    }));
}

function modalInsumo(state, id) {
  const insumo = id && id !== 'nuevo' ? insumoPorId(state, id) : null;
  const cuerpo = ui.tpl`
    <form class="checkout-form" data-form="insumo" data-id="${insumo?.id || ''}">
      ${ui.raw(campoTexto('nombre', 'Nombre', insumo?.nombre || '', 'text', 'required maxlength="80"'))}
      ${ui.raw(campoTexto('unidad', 'Unidad', insumo?.unidad || 'unidad', 'text', 'required maxlength="20"'))}
      ${ui.raw(campoTexto('stockMinimo', 'Stock mínimo', insumo?.stockMinimo ?? 0, 'number', 'min="0" step="0.001"'))}
      ${ui.raw(campoTexto('costoUnitarioCentavos', 'Costo unitario (Bs)', ((insumo?.costoUnitarioCentavos || 0) / 100).toFixed(2), 'number', 'min="0" step="0.01"'))}
      ${ui.raw(campoSelect('permiteDecimales', 'Permite decimales', [{ valor: 'no', etiqueta: 'No' }, { valor: 'si', etiqueta: 'Sí' }], insumo?.permiteDecimales ? 'si' : 'no'))}
      ${ui.raw(campoSelect('activo', 'Estado', [{ valor: 'si', etiqueta: 'Activo' }, { valor: 'no', etiqueta: 'Inactivo' }], insumo?.activo === false ? 'no' : 'si'))}
      <p class="small-note">El stock se calcula con los movimientos; para aumentarlo registra una entrada.</p>
      <div class="button-row"><button class="button primary" type="submit">Guardar insumo</button></div>
    </form>`;
  abrirModal(insumo ? 'Editar insumo' : 'Nuevo insumo', cuerpo);
}

function modalMovimiento(state, tipo, insumoId) {
  const opciones = opcionesInsumos(state);
  if (!opciones.length) {
    ui.toast('Registra insumos antes de crear movimientos', 'error');
    return;
  }
  const seleccionado = insumoId && opciones.some((opcion) => opcion.valor === insumoId) ? insumoId : opciones[0].valor;
  const esEntrada = tipo === 'entrada';
  const conLote = tipo === 'ajuste';
  const instruccion = tipo === 'merma'
    ? 'La merma descuenta del lote más antiguo (FIFO).'
    : tipo === 'ajuste'
      ? 'Cantidad positiva para sumar o negativa para restar; no permite stock negativo.'
      : 'Crea un lote nuevo con la cantidad indicada.';
  const lotes = opcionesLotes(state, seleccionado);
  const cuerpo = ui.tpl`
    <form class="checkout-form" data-form="movimiento" data-tipo="${tipo}">
      ${ui.raw(campoSelect('insumoId', 'Insumo', opciones, seleccionado))}
      ${conLote ? ui.raw(campoSelect('loteId', 'Lote (opcional)', [{ valor: '', etiqueta: 'Ajuste global' }, ...lotes])) : ''}
      ${ui.raw(campoTexto('cantidad', esEntrada ? 'Cantidad a ingresar' : 'Cantidad', '', 'number', `min="${esEntrada || tipo === 'merma' ? 0 : -999999}" step="0.001" required`))}
      ${esEntrada ? ui.raw(campoTexto('costoUnitarioCentavos', 'Costo unitario (Bs)', '0', 'number', 'min="0" step="0.01"')) : ''}
      ${ui.raw(campoTexto('motivo', 'Motivo', '', 'text', 'maxlength="120"'))}
      <p class="small-note">${instruccion}</p>
      <div class="button-row"><button class="button primary" type="submit">Guardar ${tipo}</button></div>
    </form>`;
  abrirModal({ entrada: 'Registrar entrada', ajuste: 'Registrar ajuste', merma: 'Registrar merma' }[tipo] || 'Movimiento', cuerpo);
}

function modalReceta(state, id) {
  const receta = id && id !== 'nueva' ? (state.inventario?.recetas || []).find((item) => item.id === id) : null;
  const productos = (state.productos || []).map((producto) => ({ valor: producto.id, etiqueta: producto.nombre }));
  const insumos = state.inventario?.insumos || [];
  const filasInsumos = insumos.map((insumo) => {
    const cantidad = (receta?.items || []).find((item) => item.insumoId === insumo.id)?.cantidad ?? '';
    return ui.tpl`<label><span>${insumo.nombre} (${insumo.unidad})</span><input type="number" name="item:${insumo.id}" value="${cantidad}" min="0" step="${insumo.permiteDecimales ? '0.001' : '1'}" placeholder="0"></label>`;
  }).join('');
  const cuerpo = ui.tpl`
    <form class="checkout-form" data-form="receta" data-id="${receta?.id || ''}">
      ${ui.raw(campoSelect('productoId', 'Producto', productos.length ? productos : [{ valor: '', etiqueta: 'No hay productos' }], receta?.productoId || ''))}
      ${ui.raw(campoTexto('nombre', 'Nombre de la receta', receta?.nombre || '', 'text', 'maxlength="80"'))}
      <fieldset class="option-group"><legend>Insumos por unidad</legend><div class="checkout-form">${ui.raw(filasInsumos)}</div></fieldset>
      ${ui.raw(campoSelect('activo', 'Estado', [{ valor: 'si', etiqueta: 'Activa' }, { valor: 'no', etiqueta: 'Inactiva' }], receta?.activo === false ? 'no' : 'si'))}
      <p class="small-note">Solo las recetas activas descuentan stock al confirmar pedidos.</p>
      <div class="button-row"><button class="button primary" type="submit">Guardar receta</button></div>
    </form>`;
  abrirModal(receta ? 'Editar receta' : 'Nueva receta', cuerpo);
}

async function recargar() {
  const estado = await getAll();
  render(estado);
  onRecargar?.();
}

async function ejecutarAccion(accion, estado) {
  const [nombre, id] = accion.split(':');
  if (nombre === 'insumo') return modalInsumo(estado, id);
  if (nombre === 'entrada' || nombre === 'ajuste' || nombre === 'merma') return modalMovimiento(estado, nombre, id && id !== 'nueva' ? id : '');
  if (nombre === 'receta') return modalReceta(estado, id);
  if (nombre === 'mermas') {
    vista = 'mermas';
    return recargar();
  }
  if (nombre === 'toggle-insumo') {
    const insumo = insumoPorId(estado, id);
    if (!insumo) return undefined;
    await guardarInsumo({ ...insumo, activo: insumo.activo === false }, id);
    ui.toast(insumo.activo === false ? 'Insumo activado' : 'Insumo desactivado');
    return recargar();
  }
  if (nombre === 'toggle-receta') {
    const receta = (estado.inventario?.recetas || []).find((item) => item.id === id);
    if (!receta) return undefined;
    const items = Object.fromEntries((receta.items || []).map((item) => [item.insumoId, item.cantidad]));
    await guardarReceta({ productoId: receta.productoId, nombre: receta.nombre, items, activo: receta.activo === false }, id);
    ui.toast(receta.activo === false ? 'Receta activada' : 'Receta desactivada');
    return recargar();
  }
  if (nombre === 'merma-eliminar') {
    const merma = (estado.inventario?.mermas || []).find((item) => item.id === id);
    if (!merma) return undefined;
    if (!ui.confirmDialog('¿Eliminar esta merma? Se revertirá el movimiento de stock.')) return undefined;
    await update((draft) => {
      const indice = draft.inventario.mermas.findIndex((item) => item.id === id);
      if (indice >= 0) draft.inventario.mermas.splice(indice, 1);
      const indiceMov = draft.inventario.movimientos.findIndex((item) => item.id === merma.movimientoId);
      if (indiceMov >= 0) draft.inventario.movimientos.splice(indiceMov, 1);
      recalcBalances(draft);
    });
    ui.toast('Merma eliminada');
    return recargar();
  }
  return undefined;
}

async function submitForm(form, estado) {
  const datos = Object.fromEntries(new FormData(form).entries());
  if (form.dataset.form === 'insumo') {
    await guardarInsumo({
      nombre: datos.nombre,
      unidad: datos.unidad,
      stockMinimo: Number(datos.stockMinimo) || 0,
      costoUnitarioCentavos: Math.round((Number(datos.costoUnitarioCentavos) || 0) * 100),
      permiteDecimales: datos.permiteDecimales === 'si',
      activo: datos.activo === 'si'
    }, form.dataset.id || undefined);
    ui.toast(form.dataset.id ? 'Insumo actualizado' : 'Insumo registrado');
  } else if (form.dataset.form === 'movimiento') {
    const tipo = form.dataset.tipo;
    await registrarMovimiento({
      tipo,
      insumoId: datos.insumoId,
      loteId: datos.loteId || null,
      cantidad: Number(datos.cantidad),
      costoUnitarioCentavos: Math.round((Number(datos.costoUnitarioCentavos) || 0) * 100),
      motivo: datos.motivo
    });
    ui.toast({ entrada: 'Entrada registrada', ajuste: 'Ajuste registrado', merma: 'Merma registrada' }[tipo]);
  } else if (form.dataset.form === 'receta') {
    const items = {};
    for (const [clave, valor] of Object.entries(datos)) {
      if (clave.startsWith('item:') && Number(valor) > 0) items[clave.slice(5)] = Number(valor);
    }
    await guardarReceta({
      productoId: datos.productoId,
      nombre: datos.nombre,
      items,
      activo: datos.activo === 'si'
    }, form.dataset.id || undefined);
    ui.toast('Receta guardada');
  }
  cerrarModal();
  await recargar();
}

function crearEventos() {
  if (eventosListos) return;
  eventosListos = true;
  document.addEventListener('click', (event) => {
    if (!instancia || !document.body.contains(instancia.raiz)) return;
    const vistaBtn = event.target.closest('[data-vista]');
    if (vistaBtn && instancia.nav.contains(vistaBtn)) {
      vista = vistaBtn.dataset.vista;
      recargar().catch((error) => ui.toast(error.message, 'error'));
      return;
    }
    const accionBtn = event.target.closest('[data-accion]');
    if (!accionBtn || !instancia.contenido.contains(accionBtn)) return;
    ejecutarAccion(accionBtn.dataset.accion, ultimoEstado || { inventario: {}, productos: [] })
      .catch((error) => ui.toast(error.message, 'error'));
  });
  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-form]');
    if (!form || !document.body.contains(form)) return;
    event.preventDefault();
    submitForm(form, ultimoEstado || { inventario: {}, productos: [] })
      .catch((error) => ui.toast(error.message, 'error'));
  });
  document.addEventListener('change', (event) => {
    if (event.target.name !== 'insumoId') return;
    const form = event.target.closest('[data-form="movimiento"]');
    if (!form || form.dataset.tipo !== 'ajuste') return;
    const select = form.querySelector('[name="loteId"]');
    if (!select) return;
    const opciones = [{ valor: '', etiqueta: 'Automático (FIFO)' }, ...opcionesLotes(ultimoEstado || {}, event.target.value)];
    const temporal = document.createElement('div');
    ui.setHTML(temporal, campoSelect('loteId', 'Lote (opcional)', opciones));
    const nuevoSelect = temporal.querySelector('select');
    if (nuevoSelect) select.replaceWith(nuevoSelect);
  });
}

export function init(raiz, opciones = {}) {
  instancia = {
    raiz,
    nav: raiz.querySelector('#inv-nav'),
    contenido: raiz.querySelector('#inv-contenido')
  };
  if (!instancia.nav || !instancia.contenido) return Promise.resolve();
  crearEventos();
  onRecargar = typeof opciones.recargar === 'function' ? opciones.recargar : null;
  if (opciones.estado) {
    render(opciones.estado);
    return Promise.resolve();
  }
  return recargar();
}

export function renderPanel(state) {
  ultimoEstado = state;
  render(state);
}

export { recargar };
