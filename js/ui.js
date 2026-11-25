import { CONFIG } from './config.js';
import { FALLBACK_IMAGE } from './seed-base.js';

let toastTimer = null;
let toastPrioridad = 0;

export function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function raw(value) {
  return { __raw: String(value) };
}

export function tpl(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    out += value && typeof value === 'object' && '__raw' in value ? value.__raw : escapeHtml(value);
    out += strings[i + 1];
  }
  return out;
}

export function setHTML(node, html) {
  if (!node) return;
  node.innerHTML = String(html);
}

export function uid(prefix = 'id') {
  const random = globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

export function formatMoney(cents) {
  return `${CONFIG.moneda.simbolo} ${(Number(cents || 0) / 100).toFixed(CONFIG.moneda.decimales)}`;
}

export function formatFecha(valor) {
  if (!valor) return '—';
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const fecha = soloFecha ? new Date(`${valor}T12:00:00`) : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }).format(fecha);
}

export function toast(message, prioridad = 1) {
  const node = document.getElementById('toast');
  if (!node) return;
  if (prioridad < toastPrioridad && node.classList.contains('show')) return;
  toastPrioridad = prioridad;
  node.textContent = String(message);
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.classList.remove('show');
    toastPrioridad = 0;
  }, 3200);
}

export function confirmDialog(message) {
  return window.confirm(message);
}

export function openModal(id) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('modal-open');
}

export function closeModal(id) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (dialog.open) dialog.close();
  if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
}

export function initGlobal() {
  document.addEventListener('click', (event) => {
    const boton = event.target.closest('[data-close-modal]');
    if (!boton) return;
    const dialog = boton.closest('dialog');
    if (dialog && dialog.id) closeModal(dialog.id);
  });

  document.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
  }, true);

  document.addEventListener('error', (event) => {
    const imagen = event.target;
    if (!imagen || imagen.tagName !== 'IMG' || imagen.dataset.fallbackApplied) return;
    imagen.dataset.fallbackApplied = '1';
    imagen.src = FALLBACK_IMAGE;
  }, true);
}

function inyectarBotonAdminMobile(onAdmin) {
  const barra = document.getElementById('mobile-bottom-bar');
  if (!barra || document.getElementById('mobile-admin')) return;
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.id = 'mobile-admin';
  boton.textContent = 'Admin';
  boton.setAttribute('aria-label', 'Abrir administración');
  barra.appendChild(boton);
  boton.addEventListener('click', onAdmin);
}

function initScroll() {
  const header = document.getElementById('site-header');
  const progress = document.getElementById('reading-progress');
  const bottomBar = document.getElementById('mobile-bottom-bar');
  const enlaces = [...document.querySelectorAll('#main-nav a')];
  const secciones = [...document.querySelectorAll('main section[id]')];
  let ultimaY = window.scrollY;

  function actualizar() {
    const y = window.scrollY;
    const altura = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (progress) progress.style.width = `${altura ? (y / altura) * 100 : 0}%`;
    if (header) {
      header.classList.toggle('compact', y > 12);
      header.classList.toggle('hidden', y > 240 && y > ultimaY + 4);
      if (y < ultimaY - 4) header.classList.remove('hidden');
    }
    if (bottomBar) bottomBar.classList.toggle('visible', y > 320);
    let activo = '';
    for (const seccion of secciones) {
      if (seccion.offsetTop - 150 <= y) activo = seccion.id;
    }
    enlaces.forEach((enlace) => enlace.classList.toggle('active', enlace.getAttribute('href') === `#${activo}`));
    ultimaY = y;
  }

  window.addEventListener('scroll', actualizar, { passive: true });
  window.addEventListener('resize', actualizar);
  actualizar();
}

export function initChrome(handlers = {}) {
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const abierto = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(abierto));
      toggle.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
    });
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-scroll-catalog]')) {
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (event.target.closest('#cart-button')) handlers.onCart?.();
    if (event.target.closest('#demo-button')) handlers.onDemo?.();
    if (event.target.closest('#admin-link')) handlers.onAdmin?.();
    if (event.target.closest('#mobile-order')) handlers.onCheckout?.();
  });

  inyectarBotonAdminMobile(() => handlers.onAdmin?.());
  initScroll();
}
