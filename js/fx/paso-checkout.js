import { FX_CONFIG } from '../config.js';
import { alCambiarPreferencia, esReduccionActiva, registrarLimpieza } from './fx-core.js';

const registrados = new WeakSet();

const cancelar = (el) => {
  if (typeof el.getAnimations === 'function') {
    for (const animacion of el.getAnimations()) animacion.cancel();
  }
};

export function init(el, opciones = {}) {
  if (!el || typeof el.animate !== 'function') return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.pasoCheckout)) return () => {};

  registrados.add(el);
  const stopReaccion = alCambiarPreferencia((reducido) => {
    if (reducido) cancelar(el);
  });

  return registrarLimpieza(el, () => {
    stopReaccion();
    cancelar(el);
    registrados.delete(el);
  });
}

export function animar(el) {
  if (!el || !registrados.has(el) || typeof el.animate !== 'function') return;
  if (!el.closest('dialog')?.open || esReduccionActiva() || document.hidden) return;

  const { duracionMs, desplazamientoPx } = FX_CONFIG.parametros.pasoCheckout;
  cancelar(el);
  el.animate(
    [
      { opacity: 0, transform: `translate3d(0, ${desplazamientoPx}px, 0)` },
      { opacity: 1, transform: 'translate3d(0, 0, 0)' }
    ],
    { duration: duracionMs, easing: 'ease-out' }
  );
}

export function iniciar() {
  init(document.getElementById('checkout-content'));
}
