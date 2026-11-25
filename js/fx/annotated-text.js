import { FX_CONFIG } from '../config.js';
import { alCambiarPreferencia, esReduccionActiva, observar, registrarLimpiezaClave } from './fx-core.js';

const NS = 'http://www.w3.org/2000/svg';
const TRAZOS = Object.freeze({
  underline: Object.freeze({ viewBox: '0 0 100 20', d: 'M3 13 C 22 8, 38 17, 56 11 S 84 15, 97 10' }),
  circle: Object.freeze({ viewBox: '0 0 100 40', d: 'M96 20 C 92 4, 8 4, 4 20 C 8 36, 92 36, 96 20 Z' }),
  highlight: Object.freeze({ viewBox: '0 0 100 20', d: 'M3 12 C 30 7, 70 16, 97 11' })
});

function crearSVG(tipo) {
  const trazo = TRAZOS[tipo];
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', trazo.viewBox);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'fx-anotacion');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', trazo.d);
  path.setAttribute('pathLength', '100');
  svg.appendChild(path);
  return svg;
}

export function init(contenedor, opciones = {}) {
  if (!contenedor) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.anotacionesTexto)) return () => {};

  const elementos = [...contenedor.querySelectorAll('[data-annotate]')]
    .filter((el) => TRAZOS[el.dataset.annotate] && !el.querySelector('svg.fx-anotacion'));
  if (!elementos.length) return () => {};

  const estados = [];
  elementos.forEach((el, indice) => {
    el.style.setProperty('--fx-i', String(indice));
    el.classList.add('fx-revelar');
    el.appendChild(crearSVG(el.dataset.annotate));
    if (esReduccionActiva()) {
      el.classList.add('fx-visto');
      return;
    }
    const stop = observar(el, (visible) => {
      if (visible) el.classList.add('fx-visto');
    }, { threshold: 0.2 });
    estados.push({ el, stop });
  });

  const stopReaccion = alCambiarPreferencia((reducido) => {
    if (!reducido) return;
    for (const { el, stop } of estados) {
      el.classList.add('fx-visto');
      stop?.();
    }
  });

  return registrarLimpiezaClave(contenedor, 'anotaciones', () => {
    stopReaccion();
    for (const { el, stop } of estados) {
      stop?.();
      el.classList.remove('fx-visto');
      el.querySelector('svg.fx-anotacion')?.remove();
      el.style.removeProperty('--fx-i');
    }
    for (const el of elementos) {
      el.classList.remove('fx-revelar', 'fx-visto');
      el.querySelector('svg.fx-anotacion')?.remove();
      el.style.removeProperty('--fx-i');
    }
  });
}

export function iniciar() {
  init(document.body);
}
