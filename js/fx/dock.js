import { FX_CONFIG } from '../config.js';
import {
  alCambiarPreferencia, esReduccionActiva, programarFrame,
  registrarLimpiezaClave, tokenNumero
} from './fx-core.js';

export function init(contenedor, opciones = {}) {
  if (!contenedor) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.dock)) return () => {};

  const escalaMaxima = Math.max(1, tokenNumero('--fx-escala-dock', 1.16));
  const radio = Math.max(1, tokenNumero('--fx-radio-dock', 140));
  const suavizado = Math.min(0.5, Math.max(0.05, tokenNumero('--fx-suavizado', 0.16)));
  const estados = new Map();
  let stopFrame = null;
  let puntero = null;

  const parar = () => {
    stopFrame?.();
    stopFrame = null;
  };

  const estadoDe = (el) => {
    let estado = estados.get(el);
    if (!estado) {
      estado = { actual: 1 };
      estados.set(el, estado);
    }
    return estado;
  };

  const tarea = () => {
    stopFrame = null;
    if (esReduccionActiva() || document.hidden) return;
    let sigue = false;
    for (const boton of contenedor.querySelectorAll('button')) {
      const rect = boton.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const distancia = puntero
        ? Math.hypot(puntero.x - (rect.left + rect.width / 2), puntero.y - (rect.top + rect.height / 2))
        : radio;
      const objetivo = 1 + (escalaMaxima - 1) * Math.max(0, 1 - distancia / radio);
      const estado = estadoDe(boton);
      estado.actual += (objetivo - estado.actual) * suavizado;
      boton.style.setProperty('--fx-dock-scale', estado.actual.toFixed(3));
      if (Math.abs(objetivo - estado.actual) > 0.005) sigue = true;
    }
    if (sigue) stopFrame = programarFrame(tarea);
  };

  const programar = () => {
    if (!stopFrame && !esReduccionActiva() && !document.hidden) stopFrame = programarFrame(tarea);
  };

  const alMover = (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (esReduccionActiva() || document.hidden) return;
    puntero = { x: event.clientX, y: event.clientY };
    programar();
  };

  const alSalir = (event) => {
    if (event.relatedTarget && contenedor.contains(event.relatedTarget)) return;
    puntero = null;
    programar();
  };

  const reiniciar = () => {
    for (const boton of contenedor.querySelectorAll('button')) {
      boton.style.removeProperty('--fx-dock-scale');
    }
    for (const estado of estados.values()) estado.actual = 1;
  };

  const sincronizar = (reducido) => {
    if (reducido || document.hidden) {
      parar();
      puntero = null;
      reiniciar();
    }
  };
  const alOcultar = () => sincronizar(esReduccionActiva());

  contenedor.classList.add('fx-dock');
  contenedor.addEventListener('pointermove', alMover, { passive: true });
  contenedor.addEventListener('pointerout', alSalir, { passive: true });
  const stopReaccion = alCambiarPreferencia(sincronizar);
  document.addEventListener('visibilitychange', alOcultar);

  return registrarLimpiezaClave(contenedor, 'dock', () => {
    parar();
    stopReaccion();
    document.removeEventListener('visibilitychange', alOcultar);
    contenedor.removeEventListener('pointermove', alMover);
    contenedor.removeEventListener('pointerout', alSalir);
    puntero = null;
    reiniciar();
    estados.clear();
    contenedor.classList.remove('fx-dock');
  });
}

export function iniciar() {
  init(document.getElementById('mobile-bottom-bar'));
}
