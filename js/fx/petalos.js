import { FX_CONFIG } from '../config.js';
import {
  alCambiarPreferencia,
  esReduccionActiva,
  observar,
  programarFrame,
  registrarLimpieza
} from './fx-core.js';

const COLORES = ['#c98d9a', '#ebcbd2', '#c5a46d'];

function crearPetalo(ancho, alto) {
  return {
    x: Math.random() * ancho,
    y: -Math.random() * alto,
    radio: 3 + Math.random() * 4,
    caida: 0.35 + Math.random() * 0.5,
    deriva: (Math.random() - 0.5) * 0.35,
    fase: Math.random() * Math.PI * 2,
    opacidad: 0.3 + Math.random() * 0.35,
    color: COLORES[Math.floor(Math.random() * COLORES.length)]
  };
}

export function init(canvas, opciones = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.petalos)) return () => {};

  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const parametros = FX_CONFIG.parametros.petalos;
  const mediaMovil = typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 700px)')
    : null;
  const contenedor = canvas.parentElement || canvas;
  const observadorTamano = typeof ResizeObserver === 'function'
    ? new ResizeObserver(redimensionar)
    : null;
  let ancho = 1;
  let alto = 1;
  let petalos = [];
  let visible = false;
  let stopFrame = null;

  function redimensionar() {
    const rect = canvas.getBoundingClientRect();
    ancho = Math.max(1, rect.width);
    alto = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, parametros.dprMaximo);
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cantidad = mediaMovil?.matches ? parametros.movil : parametros.escritorio;
    petalos = esReduccionActiva()
      ? []
      : Array.from({ length: cantidad }, () => crearPetalo(ancho, alto));
    canvas.dataset.fxPetalos = String(petalos.length);
  }

  function dibujar(delta, tiempo) {
    ctx.clearRect(0, 0, ancho, alto);
    const paso = Math.min(delta, 34) / 16.7;
    for (const petalo of petalos) {
      petalo.y += petalo.caida * paso;
      petalo.x += (petalo.deriva + Math.sin(tiempo / 900 + petalo.fase) * 0.18) * paso;
      if (petalo.y > alto + 12) {
        petalo.y = -12;
        petalo.x = Math.random() * ancho;
      }
      if (petalo.x < -12) petalo.x = ancho + 12;
      else if (petalo.x > ancho + 12) petalo.x = -12;
      ctx.globalAlpha = petalo.opacidad;
      ctx.fillStyle = petalo.color;
      ctx.beginPath();
      ctx.ellipse(petalo.x, petalo.y, petalo.radio, petalo.radio * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function sincronizar() {
    const reducido = esReduccionActiva();
    if (reducido && petalos.length) redimensionar();
    const debeAnimar = visible && !reducido && !document.hidden;
    if (debeAnimar && !petalos.length) redimensionar();
    if (debeAnimar && !stopFrame) stopFrame = programarFrame(dibujar);
    if (!debeAnimar && stopFrame) {
      stopFrame();
      stopFrame = null;
      ctx.clearRect(0, 0, ancho, alto);
    }
  }

  canvas.dataset.fxContinuo = 'petalos';
  redimensionar();
  observadorTamano?.observe(contenedor);
  const stopObservar = observar(canvas, (estaVisible) => {
    visible = estaVisible;
    sincronizar();
  }, { threshold: 0.01 });
  const stopReaccion = alCambiarPreferencia(sincronizar);
  window.addEventListener('resize', redimensionar);
  mediaMovil?.addEventListener?.('change', redimensionar);
  document.addEventListener('visibilitychange', sincronizar);
  sincronizar();

  return registrarLimpieza(canvas, () => {
    stopFrame?.();
    stopFrame = null;
    stopObservar();
    stopReaccion();
    observadorTamano?.disconnect();
    window.removeEventListener('resize', redimensionar);
    mediaMovil?.removeEventListener?.('change', redimensionar);
    document.removeEventListener('visibilitychange', sincronizar);
    ctx.clearRect(0, 0, ancho, alto);
    delete canvas.dataset.fxContinuo;
    delete canvas.dataset.fxPetalos;
  });
}

export function iniciar() {
  init(document.querySelector('.fx-petalos'));
}
