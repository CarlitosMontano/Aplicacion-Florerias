import { FX_CONFIG } from '../config.js';
import {
  alCambiarPreferencia,
  esReduccionActiva,
  observar,
  programarFrame,
  registrarLimpiezaClave,
  tokenNumero
} from './fx-core.js';

const NS = 'http://www.w3.org/2000/svg';

function crearMariposa() {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 80 60');
  svg.setAttribute('class', 'fx-mariposa');
  svg.setAttribute('aria-hidden', 'true');

  const alaIzquierda = document.createElementNS(NS, 'path');
  alaIzquierda.setAttribute('d', 'M39 30 C 22 4, 4 8, 8 24 C 11 36, 27 39, 39 30 Z');
  alaIzquierda.setAttribute('class', 'fx-mariposa-ala');

  const alaDerecha = document.createElementNS(NS, 'path');
  alaDerecha.setAttribute('d', 'M41 30 C 58 4, 76 8, 72 24 C 69 36, 53 39, 41 30 Z');
  alaDerecha.setAttribute('class', 'fx-mariposa-ala');

  const cuerpo = document.createElementNS(NS, 'path');
  cuerpo.setAttribute('d', 'M40 18 C 43 18, 44 24, 43 34 C 42 40, 38 40, 37 34 C 36 24, 37 18, 40 18 Z');
  cuerpo.setAttribute('class', 'fx-mariposa-cuerpo');

  const antenas = document.createElementNS(NS, 'path');
  antenas.setAttribute('d', 'M39 18 C 36 10, 32 8, 29 7 M41 18 C 44 10, 48 8, 51 7');
  antenas.setAttribute('class', 'fx-mariposa-antena');

  svg.append(alaIzquierda, alaDerecha, cuerpo, antenas);
  return svg;
}

export function init(seccion, opciones = {}) {
  if (!seccion) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.mariposaCatalogo)) return () => {};
  if (seccion.querySelector('.fx-mariposa-host')) return () => {};

  const duracion = Math.max(1200, tokenNumero('--fx-dur-vuelo', 9000));
  const amplitud = Math.max(0, tokenNumero('--fx-amplitud-vuelo', 26));
  const frecuenciaAlas = Math.max(120, tokenNumero('--fx-frecuencia-alas', 520));

  const host = document.createElement('div');
  host.className = 'fx-mariposa-host';
  host.setAttribute('aria-hidden', 'true');
  const mariposa = crearMariposa();
  host.appendChild(mariposa);

  let visible = false;
  let stopFrame = null;
  let transcurrido = 0;

  const reiniciar = () => {
    mariposa.style.removeProperty('--fx-vuelo-x');
    mariposa.style.removeProperty('--fx-vuelo-y');
    mariposa.style.removeProperty('--fx-vuelo-rot');
    mariposa.style.removeProperty('--fx-alas');
  };

  const dibujar = (delta) => {
    transcurrido = (transcurrido + Math.min(delta, 34)) % duracion;
    const fase = (transcurrido / duracion) * Math.PI * 2;
    const x = Math.sin(fase * 0.8) * amplitud;
    const y = Math.sin(fase * 1.6 + 0.8) * amplitud * 0.45;
    const giro = Math.sin(fase * 1.2) * 8;
    const alas = 0.72 + Math.abs(Math.sin((transcurrido / frecuenciaAlas) * Math.PI)) * 0.28;
    mariposa.style.setProperty('--fx-vuelo-x', `${x.toFixed(1)}px`);
    mariposa.style.setProperty('--fx-vuelo-y', `${y.toFixed(1)}px`);
    mariposa.style.setProperty('--fx-vuelo-rot', `${giro.toFixed(2)}deg`);
    mariposa.style.setProperty('--fx-alas', alas.toFixed(3));
  };

  const sincronizar = () => {
    const debeAnimar = visible && !esReduccionActiva() && !document.hidden;
    host.classList.toggle('fx-activo', debeAnimar);
    if (debeAnimar && !stopFrame) stopFrame = programarFrame(dibujar);
    if (!debeAnimar && stopFrame) {
      stopFrame();
      stopFrame = null;
      reiniciar();
    }
  };

  seccion.classList.add('fx-mariposa-seccion');
  host.dataset.fxContinuo = 'mariposa';
  seccion.appendChild(host);
  const stopObservar = observar(host, (estaVisible) => {
    visible = estaVisible;
    sincronizar();
  }, { threshold: 0.12 });
  const stopReaccion = alCambiarPreferencia(sincronizar);
  document.addEventListener('visibilitychange', sincronizar);
  sincronizar();

  return registrarLimpiezaClave(seccion, 'mariposa', () => {
    stopFrame?.();
    stopFrame = null;
    stopObservar();
    stopReaccion();
    document.removeEventListener('visibilitychange', sincronizar);
    reiniciar();
    delete host.dataset.fxContinuo;
    host.remove();
    seccion.classList.remove('fx-mariposa-seccion');
  });
}

export function iniciar() {
  init(document.querySelector('#catalogo'));
}
