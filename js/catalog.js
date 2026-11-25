import { CONFIG, ETIQUETAS_OPCION } from './config.js';
import { OCASIONES } from './seed-base.js';
import { getAll } from './inventory/storage.js';
import { estadoProducto, formatearCantidad, validarDisponibilidad } from './inventory/operations.js';
import * as ui from './ui.js';
import * as cart from './cart.js';

const filtros = { texto: '', categoria: 'all', precio: 'all' };
let productos = [];
let ocasionesListas = false;
let eventosListos = false;
let productoActual = null;

function disponible(producto, state) {
  return estadoProducto(state, producto).disponible;
}

function pasaFiltro(producto) {
  const texto = filtros.texto;
  if (texto && !`${producto.nombre} ${producto.descripcion} ${producto.categoria}`.toLowerCase().includes(texto)) return false;
  if (filtros.categoria !== 'all' && producto.categoria !== filtros.categoria) return false;
  const precio = producto.precioCentavos / 100;
  if (filtros.precio === 'under150' && precio > 150) return false;
  if (filtros.precio === '150to250' && (precio < 150 || precio > 250)) return false;
  if (filtros.precio === 'over250' && precio <= 250) return false;
  return true;
}

function renderOcasiones() {
  const grid = document.getElementById('occasion-grid');
  if (!grid || ocasionesListas) return;
  const html = OCASIONES.map((ocasion) => ui.tpl`
    <article class="occasion-card">
      <img src="${ocasion.imagen}" alt="${ocasion.titulo}" loading="lazy">
      <h3>${ocasion.titulo}</h3>
      <p>${ocasion.descripcion}</p>
    </article>
  `).join('');
  ui.setHTML(grid, html);
  ocasionesListas = true;
}

function renderCategorias() {
  const select = document.getElementById('category-filter');
  if (!select) return;
  const categorias = [...new Set(productos.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, 'es'));
  const seleccionActual = filtros.categoria;
  const opciones = categorias.map((categoria) => ui.tpl`<option value="${categoria}">${categoria}</option>`).join('');
  ui.setHTML(select, ui.tpl`<option value="all">Todas las categorías</option>${ui.raw(opciones)}`);
  select.value = seleccionActual;
  if (![...select.options].some((opcion) => opcion.value === seleccionActual)) {
    select.value = 'all';
    filtros.categoria = 'all';
  }
}

export function render(state) {
  productos = Array.isArray(state.productos) ? state.productos : [];
  renderOcasiones();
  renderCategorias();
  renderProductos(state);
}

function renderProductos(state) {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  const visibles = productos.filter(pasaFiltro);
  if (!visibles.length) {
    ui.setHTML(grid, '<p class="small-note">No encontramos arreglos con esos filtros.</p>');
    return;
  }
  const html = visibles.map((producto) => {
    const estado = estadoProducto(state, producto);
    const disabled = estado.disponible ? '' : ' disabled';
    return ui.tpl`
      <article class="product-card">
        <div class="product-image">
          <img src="${producto.imagen}" alt="${producto.nombre}" loading="lazy">
          <span class="availability ${estado.etiqueta === 'Sin stock' ? 'out' : ''}">${estado.etiqueta}</span>
        </div>
        <div class="product-body">
          <h3>${producto.nombre}</h3>
          <div class="product-meta">
            <span class="product-price">${ui.formatMoney(producto.precioCentavos)}</span>
            <button class="add-button" type="button" data-add-product="${producto.id}" aria-label="Ver ${producto.nombre}"${ui.raw(disabled)}>${estado.disponible ? '+' : '×'}</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
  ui.setHTML(grid, html);
}

function construirOpciones() {
  return Object.entries(CONFIG.opciones).map(([clave, valores]) => {
    const radios = valores.map((valor, indice) => ui.tpl`
      <label><input type="radio" name="opt-${clave}" value="${valor}"${ui.raw(indice === 0 ? ' checked' : '')}> ${valor}</label>
    `).join('');
    return ui.tpl`
      <fieldset class="option-group">
        <legend>${ETIQUETAS_OPCION[clave] || clave}</legend>
        <div class="option-options">${ui.raw(radios)}</div>
      </fieldset>
    `;
  }).join('');
}

export async function openProduct(id) {
  const state = await getAll();
  const producto = state.productos.find((p) => p.id === id);
  if (!producto) {
    ui.toast('No se encontró el producto');
    return;
  }
  const estado = estadoProducto(state, producto);
  if (!estado.disponible) {
    ui.toast(estado.etiqueta === 'Sin stock' ? 'Sin stock disponible para este arreglo' : 'Este producto está agotado');
    return;
  }
  productoActual = producto;
  const opciones = construirOpciones();
  const requerimientos = estado.requerimientos || [];
  const detalleStock = requerimientos.length
    ? ui.tpl`<p class="small-note">Insumos: ${requerimientos.map((req) => `${req.insumo.nombre} ${formatearCantidad(req.requerido)} ${req.insumo.unidad} (disponible ${formatearCantidad(req.stock)})`).join(' · ')}</p>`
    : '';
  const html = ui.tpl`
    <div class="detail-image"><img src="${producto.imagen}" alt="${producto.nombre}"></div>
    <div class="detail-copy">
      <h2>${producto.nombre}</h2>
      <p>${producto.descripcion}</p>
      <div class="detail-price">${ui.formatMoney(producto.precioCentavos)}</div>
      ${ui.raw(detalleStock)}
      ${ui.raw(opciones)}
      <fieldset class="option-group">
        <legend>Dedicatoria (opcional)</legend>
        <textarea id="detail-dedicatoria" maxlength="160" placeholder="Escribe un mensaje corto..."></textarea>
      </fieldset>
      <div class="qty-control">
        <button type="button" data-qty-minus aria-label="Disminuir cantidad">−</button>
        <output id="detail-qty">1</output>
        <button type="button" data-qty-plus aria-label="Aumentar cantidad">+</button>
      </div>
      <button class="button primary" type="button" data-confirm-add="${producto.id}">Añadir al carrito</button>
    </div>
  `;
  ui.setHTML(document.getElementById('product-detail'), html);
  ui.openModal('product-modal');
}

async function confirmarAgregado() {
  if (!productoActual) return;
  const salida = document.getElementById('detail-qty');
  const cantidad = Number(salida?.textContent || 1);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 20) {
    ui.toast('La cantidad debe estar entre 1 y 20');
    return;
  }
  const opciones = {};
  document.querySelectorAll('#product-detail input[type="radio"]:checked').forEach((input) => {
    const clave = input.name.replace('opt-', '');
    opciones[clave] = input.value;
  });
  const dedicatoria = document.getElementById('detail-dedicatoria')?.value || '';
  const state = await getAll();
  const valido = validarDisponibilidad(state, [{ productId: productoActual.id, cantidad }]);
  if (!valido.ok) {
    ui.toast(`Sin stock suficiente: ${valido.faltantes.join(' · ')}`, 'error');
    return;
  }
  const ok = await cart.addItem({ productId: productoActual.id, cantidad, opciones, dedicatoria });
  if (ok) ui.closeModal('product-modal');
}

export function init() {
  if (eventosListos) return;
  const grid = document.getElementById('product-grid');
  const busqueda = document.getElementById('product-search');
  const categoria = document.getElementById('category-filter');
  const precio = document.getElementById('price-filter');
  const detalle = document.getElementById('product-detail');

  busqueda?.addEventListener('input', () => {
    filtros.texto = busqueda.value.trim().toLowerCase();
    getAll().then(render);
  });
  categoria?.addEventListener('change', () => {
    filtros.categoria = categoria.value;
    getAll().then(render);
  });
  precio?.addEventListener('change', () => {
    filtros.precio = precio.value;
    getAll().then(render);
  });
  grid?.addEventListener('click', (event) => {
    const boton = event.target.closest('[data-add-product]');
    if (boton && !boton.disabled) openProduct(boton.dataset.addProduct);
  });
  detalle?.addEventListener('click', (event) => {
    const salida = document.getElementById('detail-qty');
    if (!salida) return;
    if (event.target.closest('[data-qty-minus]')) salida.textContent = String(Math.max(1, Number(salida.textContent) - 1));
    if (event.target.closest('[data-qty-plus]')) salida.textContent = String(Math.min(20, Number(salida.textContent) + 1));
    if (event.target.closest('[data-confirm-add]')) confirmarAgregado();
  });
  eventosListos = true;
}
