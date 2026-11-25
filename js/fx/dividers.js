import { FX_CONFIG } from '../config.js';
import { observar, registrarLimpiezaClave } from './fx-core.js';

const NS = 'http://www.w3.org/2000/svg';
const SECCIONES = ['#testimonios', '#visitanos'];

function crearRamita() {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 240 44');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'fx-ramita');

  const trazos = [
    'M4 34 C 42 30, 74 34, 118 20 S 190 12, 236 8',
    'M62 30 C 66 18, 78 14, 88 16 C 84 27, 74 32, 62 30 Z',
    'M132 22 C 136 10, 150 7, 160 10 C 155 21, 144 25, 132 22 Z',
    'M190 15 C 194 25, 206 29, 216 25 C 212 14, 201 11, 190 15 Z'
  ];
  for (const d of trazos) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('pathLength', '100');
    svg.appendChild(path);
  }
  return svg;
}

export function init(seccion, opciones = {}) {
  if (!seccion) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.divisores)) return () => {};
  if (seccion.querySelector(':scope > svg.fx-ramita')) return () => {};

  const svg = crearRamita();
  seccion.classList.add('fx-ramita-host');
  seccion.insertBefore(svg, seccion.firstChild);
  const stopObservar = observar(seccion, (visible) => {
    if (visible) svg.classList.add('fx-visto');
  }, { threshold: 0.05 });

  return registrarLimpiezaClave(seccion, 'divisores', () => {
    stopObservar();
    svg.remove();
    seccion.classList.remove('fx-ramita-host');
  });
}

export function iniciar() {
  for (const selector of SECCIONES) init(document.querySelector(selector));
}
