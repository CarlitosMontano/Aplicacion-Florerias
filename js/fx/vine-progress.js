import { FX_CONFIG } from '../config.js';
import {
  alCambiarPreferencia, esReduccionActiva, programarFrame,
  registrarLimpiezaClave
} from './fx-core.js';

const NS = 'http://www.w3.org/2000/svg';

function crearEnredadera() {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 300 9');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'fx-vine');

  const tallo = document.createElementNS(NS, 'path');
  tallo.setAttribute('d', 'M1 5 C 30 2, 48 8, 78 4 S 128 2, 158 5 S 214 8, 246 3 S 284 7, 299 4');
  tallo.setAttribute('pathLength', '100');
  svg.appendChild(tallo);

  for (const [x, y] of [[52, 4], [132, 5], [228, 4]]) {
    const hoja = document.createElementNS(NS, 'ellipse');
    hoja.setAttribute('cx', String(x));
    hoja.setAttribute('cy', String(y));
    hoja.setAttribute('rx', '4');
    hoja.setAttribute('ry', '2.2');
    hoja.setAttribute('class', 'fx-vine-hoja');
    svg.appendChild(hoja);
  }
  return svg;
}

export function init(barra, opciones = {}) {
  if (!barra) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.vineProgreso)) return () => {};

  const svg = crearEnredadera();
  let stopFrame = null;
  let ultimo = -1;
  let maximo = 0;
  let observadorAlto = null;

  const medir = () => {
    maximo = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    ultimo = -1;
  };

  const actualizar = () => {
    stopFrame = null;
    if (esReduccionActiva() || document.hidden) return;
    const valor = maximo ? Math.min(1, Math.max(0, window.scrollY / maximo)) : 0;
    if (Math.abs(valor - ultimo) < 0.002) return;
    ultimo = valor;
    barra.style.setProperty('--fx-progreso', `${(valor * 100).toFixed(2)}%`);
  };

  const alScroll = () => {
    if (!stopFrame && !esReduccionActiva() && !document.hidden) stopFrame = programarFrame(actualizar);
  };

  const alResize = () => {
    medir();
    alScroll();
  };

  const sincronizar = (reducido) => {
    if (reducido || document.hidden) {
      stopFrame?.();
      stopFrame = null;
      ultimo = -1;
      barra.style.removeProperty('--fx-progreso');
    } else alScroll();
  };
  const alOcultar = () => sincronizar(esReduccionActiva());

  barra.classList.add('fx-vine');
  barra.appendChild(svg);
  medir();
  window.addEventListener('scroll', alScroll, { passive: true });
  window.addEventListener('resize', alResize);
  document.addEventListener('visibilitychange', alOcultar);
  if ('ResizeObserver' in window) {
    observadorAlto = new ResizeObserver(alResize);
    observadorAlto.observe(document.body);
  }
  const stopReaccion = alCambiarPreferencia(sincronizar);
  alScroll();

  return registrarLimpiezaClave(barra, 'vine', () => {
    stopFrame?.();
    stopFrame = null;
    stopReaccion();
    observadorAlto?.disconnect();
    window.removeEventListener('scroll', alScroll);
    window.removeEventListener('resize', alResize);
    document.removeEventListener('visibilitychange', alOcultar);
    svg.remove();
    barra.classList.remove('fx-vine');
    barra.style.removeProperty('--fx-progreso');
  });
}

export function iniciar() {
  init(document.querySelector('.progress-bar'));
}
