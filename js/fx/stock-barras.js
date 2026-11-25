import { FX_CONFIG } from '../config.js';
import { alCambiarPreferencia, esReduccionActiva } from './fx-core.js';

const selector = '.stock-bar i';
const registrados = new WeakSet();
const desactivados = new WeakSet();
const activos = new Set();
let stopReaccion = null;
let total = 0;

function cancelar(el) {
  if (typeof el?.getAnimations !== 'function') return;
  for (const animacion of el.getAnimations({ subtree: true })) animacion.cancel();
}

function asegurarReaccion() {
  if (stopReaccion) return;
  stopReaccion = alCambiarPreferencia((reducido) => {
    if (!reducido) return;
    for (const el of [...activos]) cancelar(el);
  });
}

export function init(el, opciones = {}) {
  if (!el) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.stockBarras)) {
    desactivados.add(el);
    return () => desactivados.delete(el);
  }
  desactivados.delete(el);
  if (registrados.has(el)) return () => {};
  registrados.add(el);
  total += 1;
  asegurarReaccion();
  let vivo = true;
  return () => {
    if (!vivo) return;
    vivo = false;
    cancelar(el);
    activos.delete(el);
    registrados.delete(el);
    total -= 1;
    if (total === 0) {
      stopReaccion?.();
      stopReaccion = null;
    }
  };
}

export function animar(el) {
  if (!el || desactivados.has(el) || !FX_CONFIG.activar.stockBarras) return;
  if (!registrados.has(el)) init(el);
  if (!registrados.has(el) || esReduccionActiva() || document.hidden) return;
  cancelar(el);
  activos.add(el);
  const { duracionMs, escalonamientoMs } = FX_CONFIG.parametros.stockBarras;
  const animaciones = [...el.querySelectorAll(selector)].map((barra, indice) => barra.animate([
    { transform: 'scaleX(0)', transformOrigin: '0% 50%' },
    { transform: 'scaleX(1)', transformOrigin: '0% 50%' }
  ], {
    duration: duracionMs,
    delay: indice * escalonamientoMs,
    easing: 'cubic-bezier(.2,.8,.2,1)'
  }));
  if (animaciones.length) {
    Promise.allSettled(animaciones.map((animacion) => animacion.finished))
      .then(() => activos.delete(el));
  } else activos.delete(el);
}

export function iniciar() {}
