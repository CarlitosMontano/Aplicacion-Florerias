import { CONFIG } from './config.js';
import { getAll, update } from './inventory/storage.js';
import * as ui from './ui.js';
import * as orders from './orders.js';
import * as customers from './customers.js';
import * as calendar from './calendar.js';
import * as demo from './demo.js';
import * as inventarioPanel from './inventory/panel.js';
import { activarModoAdmin } from './fx/fx-core.js';

const PANELES = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'pedidos', etiqueta: 'Pedidos' },
  { id: 'calendario', etiqueta: 'Calendario' },
  { id: 'clientes', etiqueta: 'Clientes' },
  { id: 'productos', etiqueta: 'Productos' },
  { id: 'inventario', etiqueta: 'Inventario' },
  { id: 'demo', etiqueta: 'Modo Demo' }
];

let abierto = false;
let panel = 'resumen';
let filtroPedidos = 'all';
let ultimoEstado = null;
let eventosListos = false;

function totalIngresos(state) {
  return (state.pedidos || []).reduce((suma, pedido) => suma + Number(pedido.totalCentavos || 0), 0);
}

function renderResumen(state) {
  const metricas = [
    { titulo: 'Pedidos registrados', valor: String(state.pedidos?.length || 0) },
    { titulo: 'Ingresos registrados', valor: ui.formatMoney(totalIngresos(state)) },
    { titulo: 'Clientes', valor: String(state.clientes?.length || 0) },
    { titulo: 'Productos en carrito', valor: String(state.carrito?.length || 0) }
  ];
  const tarjetas = metricas.map((metrica) => ui.tpl`
    <article class="metric-card"><small>${metrica.titulo}</small><strong>${metrica.valor}</strong></article>
  `).join('');
  return ui.tpl`
    <div class="metrics-grid">${ui.raw(tarjetas)}</div>
    <div class="admin-panels">
      <section class="admin-panel">
        <h3>Pedidos por estado</h3>
        <div class="bar-chart">${ui.raw(orders.renderBarChart(state))}</div>
      </section>
      <section class="admin-panel">
        <h3>Estado de pedidos</h3>
        <div class="status-list">${ui.raw(orders.renderStatusList(state))}</div>
      </section>
    </div>
  `;
}

function renderPedidos(state) {
  const opciones = ['all', ...CONFIG.estadosPedido].map((estado) => ui.tpl`
    <option value="${estado}"${ui.raw(estado === filtroPedidos ? ' selected' : '')}>${estado === 'all' ? 'Todos los estados' : estado}</option>
  `).join('');
  return ui.tpl`
    <div class="admin-actions">
      <select class="admin-select" data-filtro-pedidos aria-label="Filtrar pedidos">${ui.raw(opciones)}</select>
    </div>
    ${ui.raw(orders.renderTable(state, filtroPedidos))}
  `;
}

function renderProductos(state) {
  const productos = Array.isArray(state.productos) ? state.productos : [];
  const filas = productos.map((producto) => {
    const agotado = state.disponibilidad?.[producto.id] === false;
    return ui.tpl`
      <tr>
        <td>${producto.nombre}</td>
        <td>${producto.categoria}</td>
        <td>${ui.formatMoney(producto.precioCentavos)}</td>
        <td>
          <select class="admin-select" data-toggle-disponibilidad="${producto.id}" aria-label="Disponibilidad de ${producto.nombre}">
            <option value="Disponible"${ui.raw(agotado ? '' : ' selected')}>Disponible</option>
            <option value="Agotado"${ui.raw(agotado ? ' selected' : '')}>Agotado</option>
          </select>
        </td>
      </tr>
    `;
  }).join('');
  return ui.tpl`
    <p class="small-note">La disponibilidad manual permite forzar un producto como agotado en el catálogo público.</p>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Disponibilidad</th></tr></thead>
        <tbody>${ui.raw(filas)}</tbody>
      </table>
    </div>
  `;
}

function renderDemoPanel() {
  return ui.tpl`
    <section class="admin-panel">
      <h3>Modo demostración</h3>
      <p>Los productos, pedidos, clientes y contactos son ficticios. El número de WhatsApp ${CONFIG.whatsapp.numero} está pendiente de confirmación comercial.</p>
      <div class="admin-actions">
        <button type="button" data-admin-reset>Reiniciar demostración</button>
      </div>
      <p class="small-note">El reinicio pide confirmación y solo reemplaza la clave propia de esta demo.</p>
    </section>
  `;
}

function renderPanel(state) {
  const contenido = document.getElementById('admin-content');
  if (!contenido || !state) return;
  let html = '';
  if (panel === 'resumen') html = renderResumen(state);
  else if (panel === 'pedidos') html = renderPedidos(state);
  else if (panel === 'calendario') html = calendar.render(state);
  else if (panel === 'clientes') html = customers.renderTable(state);
  else if (panel === 'productos') html = renderProductos(state);
  else if (panel === 'inventario') {
    html = ui.tpl`
      <section class="admin-panel">
        <h3>Inventario</h3>
        <div class="button-row" id="inv-nav"></div>
        <div id="inv-contenido"></div>
      </section>
    `;
  } else html = renderDemoPanel();
  ui.setHTML(contenido, html);
  if (panel === 'inventario') {
    inventarioPanel.init(contenido, {
      estado: state,
      recargar: async () => { ultimoEstado = await getAll(); }
    });
  }
  actualizarNavegacion();
}

function actualizarNavegacion() {
  document.querySelectorAll('#admin-shell [data-admin-panel]').forEach((boton) => {
    boton.classList.toggle('active', boton.dataset.adminPanel === panel);
  });
  const selector = document.querySelector('#admin-shell [data-admin-panel-select]');
  if (selector) selector.value = panel;
}

function renderShell(state) {
  const shell = document.getElementById('admin-shell');
  const navegacion = PANELES.map((item) => ui.tpl`
    <button type="button" data-admin-panel="${item.id}" class="${item.id === panel ? 'active' : ''}">${item.etiqueta}</button>
  `).join('');
  const opciones = PANELES.map((item) => ui.tpl`
    <option value="${item.id}"${ui.raw(item.id === panel ? ' selected' : '')}>${item.etiqueta}</option>
  `).join('');
  ui.setHTML(shell, ui.tpl`
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <div class="brand">
          <span class="brand-mark">FN</span>
          <span><strong>${CONFIG.marca}</strong><small>Panel administrativo</small></span>
        </div>
        <nav class="admin-nav" aria-label="Secciones de administración">${ui.raw(navegacion)}</nav>
      </aside>
      <main class="admin-main">
        <header class="admin-top">
          <div><span class="admin-kicker">Administración · demo</span><h1>${CONFIG.marca}</h1></div>
          <div class="admin-actions">
            <select class="admin-select" data-admin-panel-select aria-label="Sección del panel">${ui.raw(opciones)}</select>
            <button class="admin-close" type="button" data-admin-close>Cerrar</button>
          </div>
        </header>
        <div id="admin-content"></div>
      </main>
    </div>
  `);
  renderPanel(state);
}

export async function openAdmin() {
  const shell = document.getElementById('admin-shell');
  if (!shell) return;
  abierto = true;
  activarModoAdmin(true);
  shell.hidden = false;
  ultimoEstado = await getAll();
  renderShell(ultimoEstado);
}

export function closeAdmin() {
  const shell = document.getElementById('admin-shell');
  abierto = false;
  activarModoAdmin(false);
  if (shell) shell.hidden = true;
}

export function renderIfOpen(state) {
  if (!abierto || !state) return;
  ultimoEstado = state;
  renderPanel(state);
}

export function init() {
  if (eventosListos) return;
  const shell = document.getElementById('admin-shell');
  shell?.addEventListener('click', async (event) => {
    if (event.target.closest('[data-admin-close]')) {
      closeAdmin();
      return;
    }
    const botonPanel = event.target.closest('[data-admin-panel]');
    if (botonPanel) {
      panel = botonPanel.dataset.adminPanel;
      if (ultimoEstado) renderPanel(ultimoEstado);
      return;
    }
    if (event.target.closest('[data-cal-prev]')) {
      calendar.prev();
      if (ultimoEstado) renderPanel(ultimoEstado);
      return;
    }
    if (event.target.closest('[data-cal-next]')) {
      calendar.next();
      if (ultimoEstado) renderPanel(ultimoEstado);
      return;
    }
    if (event.target.closest('[data-admin-reset]')) await demo.resetDemo();
  });

  shell?.addEventListener('change', async (event) => {
    const selector = event.target.closest('[data-admin-panel-select]');
    if (selector) {
      panel = selector.value;
      if (ultimoEstado) renderPanel(ultimoEstado);
      return;
    }
    const filtro = event.target.closest('[data-filtro-pedidos]');
    if (filtro) {
      filtroPedidos = filtro.value;
      if (ultimoEstado) renderPanel(ultimoEstado);
      return;
    }
    const estado = event.target.closest('[data-cambiar-estado]');
    if (estado) {
      const cambiado = await orders.changeStatus(estado.dataset.cambiarEstado, estado.value);
      ui.toast(cambiado ? 'Estado del pedido actualizado' : 'Transición de estado no permitida');
      return;
    }
    const disponibilidad = event.target.closest('[data-toggle-disponibilidad]');
    if (disponibilidad) {
      const agotado = disponibilidad.value === 'Agotado';
      await update((draft) => {
        draft.disponibilidad = draft.disponibilidad || {};
        draft.disponibilidad[disponibilidad.dataset.toggleDisponibilidad] = !agotado;
      });
    }
  });
  eventosListos = true;
}
