import { CONFIG, TRANSICIONES } from './config.js';
import { update } from './inventory/storage.js';
import { descontarPedido, validarDisponibilidad } from './inventory/operations.js';
import { upsertInDraft } from './customers.js';
import * as ui from './ui.js';

export async function createOrder(datos) {
  let creado = null;
  await update((draft) => {
    if (!Array.isArray(draft.carrito) || !draft.carrito.length) return false;
    const items = draft.carrito.map((item) => ({ ...item }));

    // Se valida la demanda agregada antes de mutar: si falla, el draft se descarta.
    const validacion = validarDisponibilidad(draft, items);
    if (!validacion.ok) throw new Error(`Stock insuficiente: ${validacion.faltantes.join(' · ')}`);

    creado = {
      id: ui.uid('ped'),
      fechaCreacion: new Date().toISOString(),
      fechaEntrega: datos.fechaEntrega,
      cliente: {
        nombre: String(datos.nombre || '').trim(),
        telefono: String(datos.telefono || '').trim(),
        direccion: String(datos.direccion || '').trim(),
        notas: String(datos.notas || '').trim().slice(0, 300)
      },
      items,
      totalCentavos: items.reduce((suma, item) => suma + item.precioCentavos * item.cantidad, 0),
      estado: 'Pendiente',
      inventarioDescontado: false
    };
    descontarPedido(draft, creado);
    draft.pedidos.unshift(creado);
    draft.carrito = [];
    upsertInDraft(draft, creado);
  });
  return creado;
}

export async function changeStatus(id, estadoNuevo) {
  let cambiado = false;
  await update((draft) => {
    const pedido = draft.pedidos.find((p) => p.id === id);
    if (!pedido || !TRANSICIONES[pedido.estado]?.includes(estadoNuevo)) return false;
    pedido.estado = estadoNuevo;
    pedido.actualizadoEn = new Date().toISOString();
    cambiado = true;
  });
  return cambiado;
}

export function renderTable(state, filtro = 'all') {
  const pedidos = Array.isArray(state.pedidos)
    ? state.pedidos.filter((p) => filtro === 'all' || p.estado === filtro)
    : [];
  if (!pedidos.length) return '<p class="small-note">No hay pedidos con ese filtro.</p>';

  const filas = pedidos.map((pedido) => {
    const opciones = CONFIG.estadosPedido.map((estado) => ui.tpl`
      <option value="${estado}"${ui.raw(estado === pedido.estado ? ' selected' : '')}>${estado}</option>
    `).join('');
    const resumen = (pedido.items || []).map((item) => `${item.nombre} ×${item.cantidad}`).join(', ');
    return ui.tpl`
      <tr>
        <td>${pedido.id.slice(-6)}</td>
        <td>${pedido.cliente?.nombre || '—'}<br><small>${pedido.cliente?.telefono || ''}</small></td>
        <td>${ui.formatFecha(pedido.fechaEntrega)}<br><small>${ui.formatFecha(pedido.fechaCreacion)}</small></td>
        <td>${resumen}</td>
        <td>${ui.formatMoney(pedido.totalCentavos)}</td>
        <td><select class="admin-select" data-cambiar-estado="${pedido.id}" aria-label="Estado del pedido ${pedido.id.slice(-6)}">${ui.raw(opciones)}</select></td>
      </tr>
    `;
  }).join('');

  return ui.tpl`
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Pedido</th><th>Cliente</th><th>Entrega / creación</th><th>Arreglos</th><th>Total</th><th>Estado</th></tr></thead>
        <tbody>${ui.raw(filas)}</tbody>
      </table>
    </div>
  `;
}

export function renderStatusList(state) {
  const pedidos = Array.isArray(state.pedidos) ? state.pedidos : [];
  return CONFIG.estadosPedido.map((estado) => {
    const total = pedidos.filter((p) => p.estado === estado).length;
    return ui.tpl`<div class="status-row"><span>${estado}</span><strong>${total}</strong></div>`;
  }).join('');
}

export function renderBarChart(state) {
  const pedidos = Array.isArray(state.pedidos) ? state.pedidos : [];
  const conteos = CONFIG.estadosPedido.map((estado) => ({
    estado,
    total: pedidos.filter((p) => p.estado === estado).length
  }));
  const maximo = Math.max(1, ...conteos.map((c) => c.total));
  return conteos.map((conteo) => {
    const altura = Math.max(8, Math.round((conteo.total / maximo) * 100));
    return ui.tpl`<i style="height:${altura}%"><span>${conteo.estado.slice(0, 4)} ${conteo.total}</span></i>`;
  }).join('');
}
