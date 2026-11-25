import { FX_CONFIG } from '../config.js';
import { alCambiarPreferencia, esReduccionActiva, registrarLimpieza } from './fx-core.js';

export function init(el, opciones = {}) {
  if (!el) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.testimonios)) return () => {};

  const tarjetas = [...el.querySelectorAll('.testimonio-card')];
  if (!tarjetas.length) return () => {};

  const { duracionMs, escalonamientoMs } = FX_CONFIG.parametros.testimonios;
  el.style.setProperty('--fx-dur', `${duracionMs}ms`);
  el.style.setProperty('--fx-paso', `${escalonamientoMs}ms`);
  tarjetas.forEach((tarjeta, indice) => tarjeta.style.setProperty('--fx-i', String(indice)));
  el.classList.add('fx-testimonios');

  let observador = null;

  const activar = () => {
    if (observador || el.classList.contains('fx-visto')) return;
    if (esReduccionActiva() || typeof IntersectionObserver !== 'function') {
      el.classList.add('fx-visto');
      return;
    }
    observador = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        el.classList.add('fx-visto');
        observador?.disconnect();
        observador = null;
      }
    }, { threshold: 0.15 });
    observador.observe(el);
  };

  activar();
  const stopReaccion = alCambiarPreferencia((reducido) => {
    if (!reducido) {
      activar();
      return;
    }
    el.classList.remove('fx-visto');
    observador?.disconnect();
    observador = null;
  });

  return registrarLimpieza(el, () => {
    stopReaccion();
    observador?.disconnect();
    observador = null;
    el.classList.remove('fx-visto', 'fx-testimonios');
    el.style.removeProperty('--fx-dur');
    el.style.removeProperty('--fx-paso');
    tarjetas.forEach((tarjeta) => tarjeta.style.removeProperty('--fx-i'));
  });
}

export function iniciar() {
  init(document.getElementById('testimonios'));
}
