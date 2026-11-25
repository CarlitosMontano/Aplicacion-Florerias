import { FX_CONFIG } from '../config.js';
import {
  alCambiarPreferencia,
  esReduccionActiva,
  observar,
  pausarAnimacionesCSS,
  registrarLimpieza
} from './fx-core.js';

export function init(el, opciones = {}) {
  if (!el) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.aurora)) return () => {};

  el.dataset.fxContinuo = 'aurora';
  el.classList.add('fx-activo');
  let visible = false;

  const sincronizar = () => {
    const reducido = esReduccionActiva();
    el.classList.toggle('fx-moviendo', !reducido && !document.hidden && visible);
    el.classList.toggle('fx-quieto', reducido);
    pausarAnimacionesCSS(el, reducido || document.hidden || !visible);
  };

  const stopObservar = observar(el, (estaVisible) => {
    visible = estaVisible;
    sincronizar();
  }, { threshold: 0.01 });
  const stopReaccion = alCambiarPreferencia(sincronizar);
  document.addEventListener('visibilitychange', sincronizar);
  sincronizar();

  return registrarLimpieza(el, () => {
    stopObservar();
    stopReaccion();
    document.removeEventListener('visibilitychange', sincronizar);
    pausarAnimacionesCSS(el, true);
    el.classList.remove('fx-activo', 'fx-quieto', 'fx-moviendo');
    delete el.dataset.fxContinuo;
  });
}

export function iniciar() {
  init(document.querySelector('.fx-aurora'));
}
