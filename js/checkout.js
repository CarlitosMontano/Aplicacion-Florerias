import { ETIQUETAS_OPCION } from './config.js';
import { getAll } from './inventory/storage.js';
import { validarDisponibilidad } from './inventory/operations.js';
import { createOrder } from './orders.js';
import * as ui from './ui.js';
import { animar as animarPaso } from './fx/paso-checkout.js';

const CAMPOS = ['nombre', 'telefono', 'direccion', 'fechaEntrega', 'notas'];
const ETIQUETAS = {
  nombre: 'Nombre completo',
  telefono: 'Teléfono / celular',
  direccion: 'Dirección de entrega',
  fechaEntrega: 'Fecha de entrega',
  notas: 'Notas para la entrega'
};

let paso = 1;
let datos = {};
let pedidoConfirmado = null;
let handlers = {};
let eventosListos = false;

function fechaLocalISO(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function hoyISO() {
  return fechaLocalISO(new Date());
}

function mananaISO() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 1);
  return fechaLocalISO(fecha);
}

function fechaMaximaISO() {
  const fecha = new Date();
  fecha.setFullYear(fecha.getFullYear() + 1);
  return fechaLocalISO(fecha);
}

function syncForm() {
  for (const campo of CAMPOS) {
    const nodo = document.getElementById(`co-${campo}`);
    if (nodo) datos[campo] = nodo.value;
  }
}

function renderPasos() {
  const etiqueta = paso === 4 ? 'Pedido registrado' : `Paso ${paso} de 3`;
  const pasos = [1, 2, 3].map((numero) => ui.tpl`<li${ui.raw(numero === paso ? ' aria-current="step"' : '')}><span class="${numero <= Math.min(paso, 3) ? 'on' : ''}"></span></li>`).join('');
  return ui.tpl`<ol class="checkout-steps" aria-label="${etiqueta}">${ui.raw(pasos)}</ol>`;
}

function renderDatos() {
  const controles = [
    { campo: 'nombre', tipo: 'text', extra: ' required maxlength="80" autocomplete="name"', ancho: '' },
    { campo: 'telefono', tipo: 'tel', extra: ' required maxlength="20" inputmode="tel" autocomplete="tel"', ancho: '' },
    { campo: 'fechaEntrega', tipo: 'date', extra: ` required min="${hoyISO()}" max="${fechaMaximaISO()}"`, ancho: '' },
    { campo: 'direccion', tipo: 'text', extra: ' required maxlength="160" autocomplete="street-address"', ancho: ' full' },
    { campo: 'notas', tipo: 'textarea', extra: ' maxlength="300"', ancho: ' full' }
  ];
  const campos = controles.map(({ campo, tipo, extra, ancho }) => {
    const valor = datos[campo] || '';
    const control = tipo === 'textarea'
      ? ui.tpl`<textarea id="co-${campo}" maxlength="300" placeholder="Opcional">${valor}</textarea>`
      : ui.tpl`<input id="co-${campo}" type="${tipo}" value="${valor}"${ui.raw(extra)}>`;
    const ayuda = campo === 'notas' ? '<small class="small-note">Máximo 160 caracteres.</small>' : '';
    return ui.tpl`<label class="${ancho.trim()}">${ETIQUETAS[campo]}${ui.raw(control)}${ui.raw(ayuda)}</label>`;
  }).join('');
  return ui.tpl`
    ${ui.raw(renderPasos())}
    <h2>Tus datos</h2>
    <div class="checkout-form">${ui.raw(campos)}</div>
    <div class="checkout-actions">
      <button class="button ghost" type="button" data-co-back-cart>Volver al carrito</button>
      <button class="button primary" type="button" data-co-next>Continuar</button>
    </div>
  `;
}

function resumenItems(state) {
  return (state.carrito || []).map((item) => {
    const opciones = Object.entries(item.opciones || {}).map(([clave, valor]) => `${ETIQUETAS_OPCION[clave] || clave}: ${valor}`).join(' · ');
    const nota = item.dedicatoria ? `Dedicatoria: ${item.dedicatoria}` : '';
    const detalle = [opciones, nota].filter(Boolean).join(' · ');
    return ui.tpl`
      <article class="cart-item">
        <img src="${item.imagen}" alt="${item.nombre}">
        <div class="cart-item-main">
          <strong>${item.nombre} ×${item.cantidad}</strong>
          <small>${detalle || 'Sin personalización'}</small>
        </div>
        <span class="cart-item-price">${ui.formatMoney(item.precioCentavos * item.cantidad)}</span>
      </article>
    `;
  }).join('');
}

function total(state) {
  return (state.carrito || []).reduce((suma, item) => suma + item.precioCentavos * item.cantidad, 0);
}

function renderRevision(state) {
  return ui.tpl`
    ${ui.raw(renderPasos())}
    <h2>Revisa tu pedido</h2>
    ${ui.raw(resumenItems(state))}
    <div class="cart-total"><span>Total</span><strong>${ui.formatMoney(total(state))}</strong></div>
    <p class="small-note">Entrega prevista: ${ui.formatFecha(datos.fechaEntrega)} · ${datos.direccion}</p>
    <div class="checkout-actions">
      <button class="button ghost" type="button" data-co-back>Editar datos</button>
      <button class="button primary" type="button" data-co-next>Continuar</button>
    </div>
  `;
}

function renderConfirmacion(state) {
  const validacion = validarDisponibilidad(state, state.carrito || []);
  const aviso = validacion.ok
    ? '<p class="small-note">El stock se descontará al confirmar el pedido.</p>'
    : ui.tpl`<div class="availability-message out small-note">No hay stock suficiente para continuar: ${validacion.faltantes.join(' · ')}. Vuelve al carrito para ajustar cantidades.</div>`;
  return ui.tpl`
    ${ui.raw(renderPasos())}
    <h2>Confirmación</h2>
    <p>Revisa los datos y confirma tu pedido para ${ui.formatFecha(datos.fechaEntrega)}.</p>
    ${ui.raw(aviso)}
    <div class="cart-total"><span>Total a pagar contra entrega</span><strong>${ui.formatMoney(total(state))}</strong></div>
    <div class="checkout-actions">
      <button class="button ghost" type="button" data-co-back>Volver</button>
      <button class="button primary" type="button" data-co-confirm ${validacion.ok ? '' : 'disabled'}>Confirmar pedido</button>
    </div>
  `;
}


function renderRecibo(pedido) {
  if (!pedido) return '<p class="small-note">No se pudo mostrar el comprobante.</p>';
  const resumen = (pedido.items || []).map((item) => `${item.nombre} ×${item.cantidad}`).join(', ');
  const mensaje = encodeURIComponent(`Hola, quiero consultar el pedido ${pedido.id}.`);
  return ui.tpl`
    ${ui.raw(renderPasos())}
    <div class="order-receipt">
      <h2>Pedido registrado</h2>
      <span class="receipt-id">N.º ${pedido.id.slice(-6).toUpperCase()}</span>
      <p>Guarda este número para consultar tu pedido en la demostración.</p>
      <div class="cart-total"><span>Total</span><strong>${ui.formatMoney(pedido.totalCentavos)}</strong></div>
      <p class="small-note">Entrega prevista: ${ui.formatFecha(pedido.fechaEntrega)} · ${pedido.cliente?.direccion || ''}</p>
      <p class="receipt-next">${resumen}</p>
      <p class="receipt-next">Los pedidos de esta demo quedan guardados solo en este dispositivo.</p>
      <div class="checkout-actions">
        <a class="button primary" href="https://wa.me/59160588102?text=${mensaje}" target="_blank" rel="noreferrer">Consultar por WhatsApp</a>
        <button class="button ghost" type="button" data-co-close>Cerrar</button>
      </div>
    </div>
  `;
}

async function render() {
  const state = await getAll();
  const contenido = document.getElementById('checkout-content');
  if (!contenido) return;
  if (paso === 1) ui.setHTML(contenido, renderDatos());
  else if (paso === 2) ui.setHTML(contenido, renderRevision(state));
  else if (paso === 3) ui.setHTML(contenido, renderConfirmacion(state));
  else ui.setHTML(contenido, renderRecibo(pedidoConfirmado));
  animarPaso(contenido);
}

function validarDatos() {
  syncForm();
  for (const campo of ['nombre', 'telefono', 'direccion', 'fechaEntrega']) {
    const nodo = document.getElementById(`co-${campo}`);
    if (!nodo || !nodo.checkValidity()) {
      nodo?.reportValidity();
      ui.toast('Completa los datos obligatorios');
      return false;
    }
  }
  const telefono = String(datos.telefono || '').replace(/[\s()-]/g, '');
  if (!/^[2-79]\d{6,7}$/.test(telefono)) {
    ui.toast('Ingresa un teléfono boliviano válido de 7 u 8 dígitos');
    return false;
  }
  if (datos.fechaEntrega < hoyISO() || datos.fechaEntrega > fechaMaximaISO()) {
    ui.toast('Elige una fecha de entrega dentro del próximo año');
    return false;
  }
  return true;
}

async function confirmar() {
  syncForm();
  try {
    const pedido = await createOrder(datos);
    if (!pedido) {
      ui.toast('No se pudo registrar el pedido');
      return;
    }
    pedidoConfirmado = pedido;
    paso = 4;
    await render();
  } catch (error) {
    ui.toast(error.message || 'No se pudo registrar el pedido', 'error');
    await render();
  }
}

export async function openCheckout() {
  const state = await getAll();
  if (!state.carrito?.length) {
    ui.toast('Tu carrito está vacío');
    return;
  }
  paso = 1;
  pedidoConfirmado = null;
  datos = { nombre: '', telefono: '', direccion: '', fechaEntrega: mananaISO(), notas: '' };
  await render();
  ui.openModal('checkout-modal');
}

export function init(opciones = {}) {
  handlers = opciones;
  if (eventosListos) return;
  const contenido = document.getElementById('checkout-content');
  contenido?.addEventListener('input', syncForm);
  contenido?.addEventListener('change', syncForm);
  contenido?.addEventListener('click', async (event) => {
    if (event.target.closest('[data-co-back-cart]')) {
      ui.closeModal('checkout-modal');
      handlers.onBackToCart?.();
      return;
    }
    if (event.target.closest('[data-co-back]')) {
      paso = Math.max(1, paso - 1);
      await render();
      return;
    }
    if (event.target.closest('[data-co-next]')) {
      if (paso === 1 && !validarDatos()) return;
      paso = Math.min(3, paso + 1);
      await render();
      return;
    }
    if (event.target.closest('[data-co-confirm]')) await confirmar();
    if (event.target.closest('[data-co-close]')) ui.closeModal('checkout-modal');
  });
  eventosListos = true;
}
