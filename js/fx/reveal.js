import { FX_CONFIG } from '../config.js';
import { alCambiarPreferencia, esReduccionActiva, observar, registrarLimpieza } from './fx-core.js';

const estados = new Map();

function registrarObservador(el, estado) {
  if (estado.stopObservar || el.classList.contains('is-visible')) return;
  estado.stopObservar = observar(el, (visible) => {
    if (!visible) return;
    el.classList.add('is-visible');
    estado.stopObservar?.();
    estado.stopObservar = null;
  }, { threshold: FX_CONFIG.parametros.reveal.threshold });
}

export function init(el, opciones = {}) {
  if (!el || estados.has(el)) return () => {};
  if (opciones.visible || esReduccionActiva() || !('IntersectionObserver' in window)) {
    el.classList.add('is-visible');
  }
  const estado = { stopObservar: null, stopRegistro: null };
  estados.set(el, estado);
  estado.stopRegistro = registrarLimpieza(el, () => {
    estado.stopObservar?.();
    estados.delete(el);
  });
  if (!el.classList.contains('is-visible')) registrarObservador(el, estado);
  return () => { estado.stopRegistro?.(); };
}

function aplicarPreferencia(reducido) {
  for (const [el, estado] of estados) {
    if (reducido) {
      el.classList.add('is-visible');
      estado.stopObservar?.();
      estado.stopObservar = null;
    } else {
      registrarObservador(el, estado);
    }
  }
}

export function iniciar() {
  document.querySelectorAll('.reveal').forEach((el) => init(el));
  alCambiarPreferencia(aplicarPreferencia);
}
