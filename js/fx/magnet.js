import { FX_CONFIG } from '../config.js';
import {
  alCambiarPreferencia, esReduccionActiva, programarFrame, registrarLimpieza
} from './fx-core.js';

export function init(contenedor, opciones = {}) {
  if (!contenedor) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.magnet)) return () => {};

  const maxima = FX_CONFIG.parametros.magnet.maximaPx;
  const objetivos = [...contenedor.querySelectorAll('.button.primary')];
  if (!objetivos.length) return () => {};

  const pendientes = new Map();
  let stopFrame = null;

  const aplicar = () => {
    stopFrame = null;
    for (const [el, { x, y }] of pendientes) {
      el.style.setProperty('--mx', `${x.toFixed(2)}px`);
      el.style.setProperty('--my', `${y.toFixed(2)}px`);
    }
    pendientes.clear();
  };

  const programs = (el, x, y) => {
    pendientes.set(el, { x, y });
    if (!stopFrame) stopFrame = programarFrame(aplicar);
  };

  const alMover = (event) => {
    if (esReduccionActiva() || document.hidden) return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const limite = (valor) => Math.max(-maxima, Math.min(maxima, valor));
    programs(el,
      limite(((event.clientX - rect.left) / rect.width - 0.5) * 2 * maxima),
      limite(((event.clientY - rect.top) / rect.height - 0.5) * 2 * maxima));
  };

  const alSalir = (event) => programs(event.currentTarget, 0, 0);

  const reiniciar = () => {
    for (const el of objetivos) {
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
    }
    pendientes.clear();
  };

  const sincronizar = (reducido) => {
    if (reducido || document.hidden) {
      stopFrame?.();
      stopFrame = null;
      reiniciar();
    }
  };
  const alOcultar = () => sincronizar(esReduccionActiva());

  contenedor.classList.add('fx-magnet');
  for (const el of objetivos) {
    el.addEventListener('pointermove', alMover, { passive: true });
    el.addEventListener('pointerleave', alSalir, { passive: true });
  }
  const stopReaccion = alCambiarPreferencia(sincronizar);
  document.addEventListener('visibilitychange', alOcultar);

  return registrarLimpieza(contenedor, () => {
    stopFrame?.();
    stopFrame = null;
    stopReaccion();
    document.removeEventListener('visibilitychange', alOcultar);
    for (const el of objetivos) {
      el.removeEventListener('pointermove', alMover);
      el.removeEventListener('pointerleave', alSalir);
    }
    reiniciar();
    contenedor.classList.remove('fx-magnet');
  });
}

export function iniciar() {
  init(document.body);
}
