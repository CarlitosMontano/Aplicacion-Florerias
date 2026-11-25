import * as ui from './ui.js';

function normalizarTelefono(valor) {
  return String(valor || '').replace(/[\s()-]/g, '');
}

export function upsertInDraft(draft, order) {
  const telefono = normalizarTelefono(order.cliente?.telefono);
  let cliente = draft.clientes.find((c) => normalizarTelefono(c.telefono) === telefono && telefono);
  if (!cliente) {
    cliente = {
      id: ui.uid('cli'),
      nombre: order.cliente.nombre,
      telefono: order.cliente.telefono,
      direccion: order.cliente.direccion,
      pedidos: 0,
      totalCentavos: 0,
      ultimoPedido: null,
      ultimaFecha: null
    };
    draft.clientes.push(cliente);
  }
  cliente.nombre = order.cliente.nombre;
  cliente.direccion = order.cliente.direccion;
  cliente.pedidos = Number(cliente.pedidos || 0) + 1;
  cliente.totalCentavos = Number(cliente.totalCentavos || 0) + Number(order.totalCentavos || 0);
  cliente.ultimoPedido = order.id;
  cliente.ultimaFecha = order.fechaCreacion;
  return cliente;
}

export function renderTable(state) {
  const clientes = Array.isArray(state.clientes) ? [...state.clientes].reverse() : [];
  if (!clientes.length) return '<p class="small-note">Todavía no hay clientes registrados.</p>';
  const filas = clientes.map((cliente) => ui.tpl`
    <tr>
      <td>${cliente.nombre}</td>
      <td>${cliente.telefono}</td>
      <td>${cliente.direccion}</td>
      <td>${cliente.pedidos}</td>
      <td>${ui.formatMoney(cliente.totalCentavos)}</td>
      <td>${ui.formatFecha(cliente.ultimaFecha)}</td>
    </tr>
  `).join('');
  return ui.tpl`
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Cliente</th><th>Teléfono</th><th>Dirección</th><th>Pedidos</th><th>Total</th><th>Último pedido</th></tr></thead>
        <tbody>${ui.raw(filas)}</tbody>
      </table>
    </div>
  `;
}
