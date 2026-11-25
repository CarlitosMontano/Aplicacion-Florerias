import { FX_CONFIG } from '../config.js';
import {
  alCambiarPreferencia,
  esReduccionActiva,
  registrarLimpieza
} from './fx-core.js';

const registrados = new WeakSet();

function animacionesDe(el) {
  return typeof el.getAnimations === 'function' ? el.getAnimations() : [];
}

function cancelar(el) {
  for (const animacion of animacionesDe(el)) animacion.cancel();
}

export function init(el, opciones = {}) {
  if (!el || typeof el.animate !== 'function') return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.contadorCarrito)) return () => {};

  const cancelarSiOculto = () => {
    if (document.hidden) cancelar(el);
  };

  registrados.add(el);
  const stopReaccion = alCambiarPreferencia((reducido) => {
    if (reducido) cancelar(el);
  });
  document.addEventListener('visibilitychange', cancelarSiOculto);

  return registrarLimpieza(el, () => {
    stopReaccion();
    document.removeEventListener('visibilitychange', cancelarSiOculto);
    cancelar(el);
    registrados.delete(el);
  });
}

export function animar(el) {
  if (!el || !registrados.has(el)) return;
  if (typeof el.animate !== 'function') return;
  if (esReduccionActiva() || document.hidden) return;

  cancelar(el);
  el.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
    {
      duration: FX_CONFIG.parametros.contadorCarrito.duracionMs,
      easing: 'ease-out'
    }
  );
}

export function iniciar() {
  init(document.getElementById('cart-count'));
}
