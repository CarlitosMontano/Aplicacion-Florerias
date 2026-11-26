import { ETIQUETAS_OPCION } from './config.js';
import { getAll, update } from './inventory/storage.js';
import { estadoProducto, productoDisponible, validarDisponibilidad } from './inventory/operations.js';
import * as ui from './ui.js';
import { animar as animarContador } from './fx/contador-carrito.js';

let handlers = {};

export async function addItem({ productId, cantidad, opciones, dedicatoria }) {
  const cantidadNumero = Number(cantidad);
  if (!Number.isInteger(cantidadNumero) || cantidadNumero < 1 || cantidadNumero > 20) {
    ui.toast('Cantidad no válida');
    return false;
  }
  let mensaje = '';
  let agregado = false;
  await update((draft) => {
    const producto = draft.productos.find((p) => p.id === productId);
    if (!producto) {
      mensaje = 'No se encontró el producto';
      return false;
    }
    const estado = estadoProducto(draft, producto);
    if (!estado.disponible) {
      mensaje = estado.etiqueta === 'Sin stock' ? 'Sin stock suficiente para este arreglo' : 'Este producto está agotado';
      return false;
    }
    const proyecto = [...(draft.carrito || []), { productId: producto.id, cantidad: cantidadNumero }];
    const validacion = validarDisponibilidad(draft, proyecto);
    if (!validacion.ok) {
      mensaje = `Sin stock suficiente: ${validacion.faltantes.join(' · ')}`;
      return false;
    }
    draft.carrito.push({
      id: ui.uid('item'),
      productId: producto.id,
      nombre: producto.nombre,
      imagen: producto.imagen,
      precioCentavos: producto.precioCentavos,
      cantidad: cantidadNumero,
      opciones: { ...(opciones || {}) },
      dedicatoria: String(dedicatoria || '').trim().slice(0, 160)
    });
    agregado = true;
  });
  ui.toast(mensaje || (agregado ? 'Agregado al carrito' : 'No se pudo agregar'));
  return agregado;
}

export async function removeItem(id) {
  await update((draft) => {
    draft.carrito = draft.carrito.filter((item) => item.id !== id);
  });
}

function totalCarrito(items) {
  return items.reduce((suma, item) => suma + item.precioCentavos * item.cantidad, 0);
}

export function render(state) {
  const items = Array.isArray(state.carrito) ? state.carrito : [];
  const contador = items.reduce((suma, item) => suma + Number(item.cantidad || 0), 0);
  const badge = document.getElementById('cart-count');
  if (badge) {
    const texto = String(contador);
    if (badge.textContent !== texto) {
      badge.textContent = texto;
      animarContador(badge);
    }
  }

  const contenido = document.getElementById('cart-content');
  if (!contenido) return;
  if (!items.length) {
    ui.setHTML(contenido, ui.tpl`
      <h2>Tu carrito</h2>
      <p class="cart-empty">Todavía no elegiste flores. Explora la colección y agrega tu primer arreglo.</p>
      <div class="checkout-actions"><button class="button ghost" type="button" data-cart-close>Seguir comprando</button></div>
    `);
    return;
  }

  const filas = items.map((item) => {
    const producto = (state.productos || []).find((p) => p.id === item.productId);
    const disponible = producto ? productoDisponible(state, producto) : false;
    const detalles = Object.entries(item.opciones || {}).map(([clave, valor]) => `${ETIQUETAS_OPCION[clave] || clave}: ${valor}`).join(' · ');
    const nota = item.dedicatoria ? ` · Dedicatoria: ${item.dedicatoria}` : '';
    return ui.tpl`
      <article class="cart-item">
        <img src="${item.imagen}" alt="${item.nombre}">
        <div class="cart-item-main">
          <strong>${item.nombre}</strong>
          <small>${detalles}${nota}${detalles || nota ? ' · ' : ''}Cantidad: ${item.cantidad}</small>
          ${disponible ? '' : ui.raw(ui.tpl`<small class="availability-message out small-note">Sin stock disponible</small>`)}
        </div>
        <span class="cart-item-price">${ui.formatMoney(item.precioCentavos * item.cantidad)}</span>
        <button class="remove-button" type="button" data-remove-item="${item.id}" aria-label="Quitar ${item.nombre}">Quitar</button>
      </article>
    `;
  }).join('');

  const validacion = validarDisponibilidad(state, items);
  const aviso = validacion.ok ? '' : ui.tpl`<div class="availability-message out small-note">Stock insuficiente: ${validacion.faltantes.join(' · ')}</div>`;
  ui.setHTML(contenido, ui.tpl`
    <h2>Tu carrito</h2>
    ${ui.raw(filas)}
    ${ui.raw(aviso)}
    <div class="cart-total"><span>Total</span><strong>${ui.formatMoney(totalCarrito(items))}</strong></div>
    <div class="checkout-actions">
      <button class="button ghost" type="button" data-cart-close>Seguir comprando</button>
      <button class="button primary" type="button" data-cart-checkout ${validacion.ok ? '' : 'disabled'}>Continuar al pedido</button>
    </div>
  `);
}

export async function openCart() {
  const state = await getAll();
  render(state);
  ui.openModal('cart-modal');
}

export function init(opciones = {}) {
  handlers = opciones;
  const contenido = document.getElementById('cart-content');
  contenido?.addEventListener('click', async (event) => {
    if (event.target.closest('[data-cart-close]')) {
      ui.closeModal('cart-modal');
      return;
    }
    if (event.target.closest('[data-cart-checkout]')) {
      ui.closeModal('cart-modal');
      handlers.onCheckout?.();
      return;
    }
    const boton = event.target.closest('[data-remove-item]');
    if (boton) {
      await removeItem(boton.dataset.removeItem);
      ui.toast('Producto quitado del carrito');
    }
  });
}
