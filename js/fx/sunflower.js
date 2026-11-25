import { FX_CONFIG } from '../config.js';
import {
  alCambiarPreferencia, esReduccionActiva, observar,
  programarFrame, registrarLimpiezaClave, tokenNumero
} from './fx-core.js';

const NS = 'http://www.w3.org/2000/svg';

function crearGirasol() {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 140');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'fx-girasol');

  const tallo = document.createElementNS(NS, 'path');
  tallo.setAttribute('d', 'M60 138 C 57 112, 63 90, 60 64');
  tallo.setAttribute('class', 'fx-girasol-tallo');
  svg.appendChild(tallo);

  const hoja = document.createElementNS(NS, 'path');
  hoja.setAttribute('d', 'M60 110 C 78 106, 88 94, 85 82 C 70 84, 62 95, 60 110 Z');
  hoja.setAttribute('class', 'fx-girasol-hoja');
  svg.appendChild(hoja);

  const cabeza = document.createElementNS(NS, 'g');
  cabeza.setAttribute('class', 'fx-girasol-cabeza');
  for (let indice = 0; indice < 10; indice += 1) {
    const petalo = document.createElementNS(NS, 'ellipse');
    petalo.setAttribute('cx', '60');
    petalo.setAttribute('cy', '22');
    petalo.setAttribute('rx', '6');
    petalo.setAttribute('ry', '15');
    petalo.setAttribute('transform', `rotate(${indice * 36} 60 45)`);
    petalo.setAttribute('class', 'fx-girasol-petalo');
    cabeza.appendChild(petalo);
  }
  const centro = document.createElementNS(NS, 'circle');
  centro.setAttribute('cx', '60');
  centro.setAttribute('cy', '45');
  centro.setAttribute('r', '15');
  centro.setAttribute('class', 'fx-girasol-centro');
  cabeza.appendChild(centro);
  svg.appendChild(cabeza);
  return { svg, cabeza };
}

export function init(host, opciones = {}) {
  if (!host) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.girasol)) return () => {};

  const giroMaximo = tokenNumero('--fx-giro-max', 18);
  const suavizado = Math.min(0.5, Math.max(0.05, tokenNumero('--fx-suavizado', 0.16)));
  let tactil = typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches;
  const { svg, cabeza } = crearGirasol();
  let stopFrame = null;
  let objetivo = 0;
  let actual = 0;
  let visible = false;
  let stopObservar = null;

  const tarea = () => {
    stopFrame = null;
    if (esReduccionActiva() || document.hidden) return;
    actual += (objetivo - actual) * suavizado;
    svg.style.setProperty('--fx-giro', `${actual.toFixed(2)}deg`);
    if (Math.abs(objetivo - actual) > 0.15) stopFrame = programarFrame(tarea);
  };

  const programar = () => {
    if (!stopFrame && !esReduccionActiva() && !document.hidden) stopFrame = programarFrame(tarea);
  };

  const alMover = (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (tactil) {
      tactil = false;
      sincronizar(esReduccionActiva());
    }
    if (esReduccionActiva() || document.hidden) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = rect.left + rect.width * (60 / 120);
    const y = rect.top + rect.height * (45 / 140);
    const angulo = Math.atan2(event.clientY - y, event.clientX - x) * (180 / Math.PI) / 10;
    objetivo = Math.max(-giroMaximo, Math.min(giroMaximo, angulo));
    programar();
  };

  const sincronizar = (reducido) => {
    svg.classList.toggle('fx-balanceo', tactil && !reducido && visible && !document.hidden);
    if (reducido || document.hidden) {
      stopFrame?.();
      stopFrame = null;
      objetivo = 0;
      actual = 0;
      svg.style.removeProperty('--fx-giro');
    }
  };
  const alOcultar = () => sincronizar(esReduccionActiva());
  const alTacto = (event) => {
    if (event.pointerType !== 'touch' || tactil) return;
    tactil = true;
    stopFrame?.();
    stopFrame = null;
    objetivo = 0;
    actual = 0;
    svg.style.removeProperty('--fx-giro');
    sincronizar(esReduccionActiva());
  };

  host.classList.add('fx-girasol-host');
  host.appendChild(svg);
  host.addEventListener('pointermove', alMover, { passive: true });
  host.addEventListener('pointerdown', alTacto, { passive: true });
  stopObservar = observar(host, (estaVisible) => {
    visible = estaVisible;
    sincronizar(esReduccionActiva());
  }, { threshold: 0.05 });
  const stopReaccion = alCambiarPreferencia(sincronizar);
  document.addEventListener('visibilitychange', alOcultar);

  return registrarLimpiezaClave(host, 'girasol', () => {
    stopFrame?.();
    stopFrame = null;
    stopObservar?.();
    stopReaccion();
    host.removeEventListener('pointermove', alMover);
    host.removeEventListener('pointerdown', alTacto);
    document.removeEventListener('visibilitychange', alOcultar);
    svg.remove();
    host.classList.remove('fx-girasol-host');
  });
}

export function iniciar() {
  init(document.querySelector('#visitanos .location-art'));
}
