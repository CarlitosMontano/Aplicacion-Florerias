import { FX_CONFIG } from '../config.js';
import { alCambiarPreferencia, observar, registrarLimpieza } from './fx-core.js';

export function init(el, opciones = {}) {
  if (!el) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.galeria)) return () => {};

  let listo = false;
  let stopObservar = null;
  let stopReaccion = null;

  const configurar = () => {
    if (listo) return;
    const tarjetas = [...el.querySelectorAll('.occasion-card')];
    if (!tarjetas.length) return;
    listo = true;
    observadorTarjetas?.disconnect();

    el.style.setProperty('--fx-paso', `${FX_CONFIG.parametros.galeria.escalonamientoMs}ms`);
    tarjetas.forEach((tarjeta, indice) => tarjeta.style.setProperty('--fx-i', String(indice)));
    el.classList.add('fx-galeria');

    stopObservar = observar(el, (visible) => {
      if (visible) el.classList.add('fx-visto');
    }, { threshold: 0.08 });
    stopReaccion = alCambiarPreferencia((reducido) => {
      if (reducido) el.classList.remove('fx-visto');
    });
  };

  const observadorTarjetas = typeof MutationObserver === 'function'
    ? new MutationObserver(configurar)
    : null;
  observadorTarjetas?.observe(el, { childList: true });
  configurar();

  return registrarLimpieza(el, () => {
    observadorTarjetas?.disconnect();
    stopObservar?.();
    stopReaccion?.();
    el.classList.remove('fx-visto', 'fx-galeria');
    el.style.removeProperty('--fx-paso');
    el.querySelectorAll('.occasion-card').forEach((tarjeta) => tarjeta.style.removeProperty('--fx-i'));
  });
}

export function iniciar() {
  init(document.getElementById('occasion-grid'));
}
