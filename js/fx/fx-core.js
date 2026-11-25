import { FX_CONFIG } from '../config.js';
import { getPreferencias, setPreferencias, subscribe } from '../inventory/storage.js';
import { iniciar as iniciarReveal } from './reveal.js';
import { iniciar as iniciarAurora } from './aurora.js';
import { iniciar as iniciarPetalos } from './petalos.js';
import { iniciar as iniciarPixelesTarjeta } from './pixeles-tarjeta.js';
import { iniciar as iniciarContadorCarrito } from './contador-carrito.js';
import { iniciar as iniciarPasoCheckout } from './paso-checkout.js';
import { iniciar as iniciarMagnet } from './magnet.js';
import { iniciar as iniciarTestimonios } from './testimonios.js';
import { iniciar as iniciarGaleria } from './galeria.js';
import { iniciar as iniciarCountup } from './countup.js';
import { iniciar as iniciarBarras } from './barras.js';
import { iniciar as iniciarStockBarras } from './stock-barras.js';
import { iniciar as iniciarSpotlightCard } from './spotlight-card.js';
import { iniciar as iniciarDock } from './dock.js';
import { iniciar as iniciarAnotacionesTexto } from './annotated-text.js';
import { iniciar as iniciarVineProgreso } from './vine-progress.js';
import { iniciar as iniciarGirasol } from './sunflower.js';
import { iniciar as iniciarDivisores } from './dividers.js';
import { iniciar as iniciarBotonWhatsapp } from './whatsapp.js';
import { iniciar as iniciarMariposa } from './mariposa.js';

const media = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;
const observadores = new Map();
const visibilidades = new WeakMap();
const tareas = new Set();
const limpiezas = new WeakMap();
const limpiezasPorClave = new WeakMap();
const reacciones = new Set();

let reducidoSitio = false;
let pausaAdmin = false;
let cuadro = null;
let ultimoTiempo = 0;
let boton = null;
let iniciado = false;

function esReducido() {
  return reducidoSitio || media?.matches === true;
}

export function esReduccionActiva() {
  return esReducido();
}

export function token(nombre, fallback = '') {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return valor || fallback;
}

export function tokenNumero(nombre, fallback) {
  const valor = Number.parseFloat(token(nombre));
  return Number.isFinite(valor) ? valor : fallback;
}

function notificarPreferencia() {
  document.documentElement.classList.toggle('fx-reduced', esReducido());
  if (boton) boton.setAttribute('aria-pressed', String(reducidoSitio));
  for (const reaccion of [...reacciones]) {
    try { reaccion(esReducido()); }
    catch (error) { console.error('[fx] reacción de preferencia falló:', error); }
  }
}

function bucle(tiempo) {
  cuadro = null;
  if (document.hidden || pausaAdmin || !tareas.size) return;
  const delta = ultimoTiempo ? tiempo - ultimoTiempo : 16.7;
  ultimoTiempo = tiempo;
  for (const tarea of [...tareas]) {
    try { tarea(delta, tiempo); }
    catch (error) { console.error('[fx] tarea de fotograma falló:', error); }
  }
  if (tareas.size && !document.hidden) cuadro = requestAnimationFrame(bucle);
  else ultimoTiempo = 0;
}

function reanudar() {
  if (cuadro === null && tareas.size && !document.hidden && !pausaAdmin) {
    ultimoTiempo = 0;
    cuadro = requestAnimationFrame(bucle);
  }
}

export function programarFrame(fn) {
  if (typeof fn !== 'function') return () => {};
  tareas.add(fn);
  reanudar();
  return () => {
    tareas.delete(fn);
    if (!tareas.size && cuadro !== null) {
      cancelAnimationFrame(cuadro);
      cuadro = null;
      ultimoTiempo = 0;
    }
  };
}

export function observar(el, callback, opciones = {}) {
  if (!el || typeof callback !== 'function') return () => {};
  const threshold = opciones.threshold ?? 0.12;
  if (esReducido() || !('IntersectionObserver' in window)) {
    callback(true, el);
    return () => {};
  }
  if (!observadores.has(threshold)) {
    const observador = new IntersectionObserver((entradas, obs) => {
      for (const entrada of entradas) {
        const cb = visibilidades.get(entrada.target);
        if (!cb) continue;
        cb(entrada.isIntersecting, entrada.target);
        if (entrada.isIntersecting && !entrada.target.dataset.fxContinuo) obs.unobserve(entrada.target);
      }
    }, { threshold });
    observadores.set(threshold, observador);
  }
  const observador = observadores.get(threshold);
  visibilidades.set(el, callback);
  observador.observe(el);
  return () => {
    observador.unobserve(el);
    visibilidades.delete(el);
  };
}

export function registrarLimpieza(target, fn) {
  if (!target || typeof fn !== 'function') return () => {};
  const anterior = limpiezas.get(target);
  if (anterior) anterior();
  const limpieza = () => {
    if (limpiezas.get(target) !== limpieza) return;
    try { fn(); } catch (error) { console.error('[fx] limpieza falló:', error); }
    limpiezas.delete(target);
  };
  limpiezas.set(target, limpieza);
  return limpieza;
}

export function registrarLimpiezaClave(target, clave, fn) {
  if (!target || !clave || typeof fn !== 'function') return () => {};
  let mapa = limpiezasPorClave.get(target);
  if (!mapa) {
    mapa = new Map();
    limpiezasPorClave.set(target, mapa);
  }
  mapa.get(clave)?.();
  const limpieza = () => {
    if (mapa.get(clave) !== limpieza) return;
    try { fn(); } catch (error) { console.error('[fx] limpieza falló:', error); }
    mapa.delete(clave);
    if (!mapa.size) limpiezasPorClave.delete(target);
  };
  mapa.set(clave, limpieza);
  return limpieza;
}

export function limpiarNodo(target) {
  const limpieza = limpiezas.get(target);
  if (limpieza) limpieza();
  const mapa = limpiezasPorClave.get(target);
  if (mapa) for (const limpiezaClave of [...mapa.values()]) limpiezaClave();
}

export function pausarAnimacionesCSS(el, pausa) {
  if (!el || typeof el.getAnimations !== 'function') return;
  for (const animacion of el.getAnimations({ subtree: true })) {
    try {
      if (pausa) animacion.pause();
      else animacion.play();
    } catch (error) { console.error('[fx] no se pudo controlar la animación:', error); }
  }
}

export function alCambiarPreferencia(fn) {
  if (typeof fn !== 'function') return () => {};
  reacciones.add(fn);
  fn(esReducido());
  return () => reacciones.delete(fn);
}

export function activarModoAdmin(activo) {
  const siguiente = Boolean(activo);
  if (siguiente === pausaAdmin) return;
  pausaAdmin = siguiente;
  document.documentElement.classList.toggle('fx-admin', pausaAdmin);
  if (pausaAdmin) {
    pausarAnimacionesCSS(document.body, true);
    if (cuadro !== null) cancelAnimationFrame(cuadro);
    cuadro = null;
    ultimoTiempo = 0;
  } else {
    pausarAnimacionesCSS(document.body, false);
    reanudar();
  }
}

export async function alternarReduccion() {
  await setPreferencias({ reducirAnimaciones: !reducidoSitio });
}

export async function init() {
  if (iniciado) return;
  iniciado = true;
  const preferidas = await getPreferencias();
  reducidoSitio = preferidas.reducirAnimaciones === true;
  boton = document.getElementById('motion-toggle');
  boton?.addEventListener('click', () => {
    alternarReduccion().catch((error) => console.error('[fx] no se pudo guardar la preferencia:', error));
  });
  media?.addEventListener?.('change', notificarPreferencia);
  subscribe((state, event) => {
    if (!state || event?.type === 'warning') return;
    const siguiente = state.preferencias?.reducirAnimaciones === true;
    if (siguiente === reducidoSitio) return;
    reducidoSitio = siguiente;
    notificarPreferencia();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (cuadro !== null) cancelAnimationFrame(cuadro);
      cuadro = null;
      ultimoTiempo = 0;
    } else reanudar();
  });
  notificarPreferencia();
  if (FX_CONFIG.activar.reveal) iniciarReveal();
  if (FX_CONFIG.activar.aurora) iniciarAurora();
  if (FX_CONFIG.activar.petalos) iniciarPetalos();
  if (FX_CONFIG.activar.pixelesTarjeta) iniciarPixelesTarjeta();
  if (FX_CONFIG.activar.contadorCarrito) iniciarContadorCarrito();
  if (FX_CONFIG.activar.pasoCheckout) iniciarPasoCheckout();
  if (FX_CONFIG.activar.magnet) iniciarMagnet();
  if (FX_CONFIG.activar.testimonios) iniciarTestimonios();
  if (FX_CONFIG.activar.galeria) iniciarGaleria();
  if (FX_CONFIG.activar.countup) iniciarCountup();
  if (FX_CONFIG.activar.barras) iniciarBarras();
  if (FX_CONFIG.activar.stockBarras) iniciarStockBarras();
  if (FX_CONFIG.activar.spotlightCard) iniciarSpotlightCard();
  if (FX_CONFIG.activar.dock) iniciarDock();
  if (FX_CONFIG.activar.anotacionesTexto) iniciarAnotacionesTexto();
  if (FX_CONFIG.activar.vineProgreso) iniciarVineProgreso();
  if (FX_CONFIG.activar.girasol) iniciarGirasol();
  if (FX_CONFIG.activar.divisores) iniciarDivisores();
  if (FX_CONFIG.activar.botonWhatsapp) iniciarBotonWhatsapp();
  if (FX_CONFIG.activar.mariposaCatalogo) iniciarMariposa();
}
