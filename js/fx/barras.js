import { FX_CONFIG } from '../config.js';
import { alCambiarPreferencia, esReduccionActiva } from './fx-core.js';

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
  if (!(opciones.activo ?? FX_CONFIG.activar.barras)) {
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
  if (!el || desactivados.has(el) || !FX_CONFIG.activar.barras) return;
  if (!registrados.has(el)) init(el);
  if (!registrados.has(el) || esReduccionActiva() || document.hidden) return;
  cancelar(el);
  activos.add(el);
  const { duracionMs, escalonamientoMs } = FX_CONFIG.parametros.barras;
  const animaciones = [];
  for (const grafico of el.querySelectorAll('.bar-chart')) {
    [...grafico.querySelectorAll('i')].forEach((barra, indice) => {
      animaciones.push(barra.animate([
        { transform: 'scaleY(0)', transformOrigin: '50% 100%', opacity: 0.7 },
        { transform: 'scaleY(1)', transformOrigin: '50% 100%', opacity: 1 }
      ], {
        duration: duracionMs,
        delay: indice * escalonamientoMs,
        easing: 'cubic-bezier(.2,.8,.2,1)'
      }));
    });
  }
  if (animaciones.length) {
    Promise.allSettled(animaciones.map((animacion) => animacion.finished))
      .then(() => activos.delete(el));
  } else activos.delete(el);
}

export function iniciar() {}
