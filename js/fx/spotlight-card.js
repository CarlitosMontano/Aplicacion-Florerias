import { FX_CONFIG } from '../config.js';
import {
  alCambiarPreferencia, esReduccionActiva, programarFrame,
  registrarLimpiezaClave, tokenNumero
} from './fx-core.js';

const selector = '.occasion-card';

export function init(contenedor, opciones = {}) {
  if (!contenedor) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.spotlightCard)) return () => {};

  const suavizado = Math.min(0.5, Math.max(0.05, tokenNumero('--fx-suavizado', 0.16)));
  const estados = new Map();
  let stopFrame = null;

  const parar = () => {
    stopFrame?.();
    stopFrame = null;
  };

  const tarea = () => {
    stopFrame = null;
    if (esReduccionActiva() || document.hidden) return;
    let sigue = false;
    for (const [el, estado] of estados) {
      estado.x += (estado.objetivoX - estado.x) * suavizado;
      estado.y += (estado.objetivoY - estado.y) * suavizado;
      el.style.setProperty('--mx', `${estado.x.toFixed(1)}%`);
      el.style.setProperty('--my', `${estado.y.toFixed(1)}%`);
      if (Math.abs(estado.objetivoX - estado.x) > 0.2 || Math.abs(estado.objetivoY - estado.y) > 0.2) sigue = true;
    }
    if (sigue) stopFrame = programarFrame(tarea);
  };

  const programar = () => {
    if (!stopFrame && !esReduccionActiva() && !document.hidden) stopFrame = programarFrame(tarea);
  };

  const estadoDe = (el) => {
    let estado = estados.get(el);
    if (!estado) {
      estado = { x: 50, y: 50, objetivoX: 50, objetivoY: 50 };
      estados.set(el, estado);
    }
    return estado;
  };

  const elegir = (event) => {
    const tarjeta = event.target.closest?.(selector);
    if (!tarjeta || tarjeta.closest('.product-card') || tarjeta.closest('.fx-pixeles')) return null;
    return tarjeta;
  };

  const alMover = (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const tarjeta = elegir(event);
    if (!tarjeta) return;
    const rect = tarjeta.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const estado = estadoDe(tarjeta);
    estado.objetivoX = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    estado.objetivoY = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    programar();
  };

  const alSalir = (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const tarjeta = elegir(event);
    if (!tarjeta || (event.relatedTarget && tarjeta.contains(event.relatedTarget))) return;
    const estado = estadoDe(tarjeta);
    estado.objetivoX = 50;
    estado.objetivoY = 50;
    programar();
  };

  const reiniciar = () => {
    for (const el of estados.keys()) {
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
    }
    for (const estado of estados.values()) {
      estado.x = 50;
      estado.y = 50;
      estado.objetivoX = 50;
      estado.objetivoY = 50;
    }
  };

  const sincronizar = (reducido) => {
    if (reducido || document.hidden) {
      parar();
      reiniciar();
    }
  };
  const alOcultar = () => sincronizar(esReduccionActiva());

  contenedor.classList.add('fx-spotlight');
  contenedor.addEventListener('pointermove', alMover, { passive: true });
  contenedor.addEventListener('pointerout', alSalir, { passive: true });
  const stopReaccion = alCambiarPreferencia(sincronizar);
  document.addEventListener('visibilitychange', alOcultar);

  return registrarLimpiezaClave(contenedor, 'spotlight', () => {
    parar();
    stopReaccion();
    document.removeEventListener('visibilitychange', alOcultar);
    contenedor.removeEventListener('pointermove', alMover);
    contenedor.removeEventListener('pointerout', alSalir);
    reiniciar();
    estados.clear();
    contenedor.classList.remove('fx-spotlight');
  });
}

export function iniciar() {
  init(document.body);
}
