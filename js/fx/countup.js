import { FX_CONFIG } from '../config.js';
import { alCambiarPreferencia, esReduccionActiva, programarFrame } from './fx-core.js';

const registrados = new WeakSet();
const desactivados = new WeakSet();
const porContenedor = new WeakMap();
const activos = new Set();
let stopReaccion = null;
let total = 0;

function finalizar(estado, restaurar) {
  for (const stop of estado.stops) stop();
  estado.stops.clear();
  if (restaurar) for (const [nodo, texto] of estado.textos) nodo.textContent = texto;
  estado.textos.clear();
  activos.delete(estado);
}

function asegurarReaccion() {
  if (stopReaccion) return;
  stopReaccion = alCambiarPreferencia((reducido) => {
    if (!reducido) return;
    for (const estado of [...activos]) finalizar(estado, true);
  });
}

export function init(el, opciones = {}) {
  if (!el) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.countup)) {
    desactivados.add(el);
    return () => desactivados.delete(el);
  }
  desactivados.delete(el);
  if (registrados.has(el)) return () => {};
  registrados.add(el);
  porContenedor.set(el, { stops: new Set(), textos: new Map() });
  total += 1;
  asegurarReaccion();
  let vivo = true;
  return () => {
    if (!vivo) return;
    vivo = false;
    const estado = porContenedor.get(el);
    if (estado) finalizar(estado, true);
    porContenedor.delete(el);
    registrados.delete(el);
    total -= 1;
    if (total === 0) {
      stopReaccion?.();
      stopReaccion = null;
    }
  };
}

export function animar(el) {
  if (!el || desactivados.has(el) || !FX_CONFIG.activar.countup) return;
  if (!registrados.has(el)) init(el);
  const estado = porContenedor.get(el);
  if (!estado || esReduccionActiva() || document.hidden) return;
  finalizar(estado, true);
  activos.add(estado);
  const duracion = FX_CONFIG.parametros.countup.duracionMs;

  for (const nodo of el.querySelectorAll('.metric-card strong')) {
    const original = nodo.textContent;
    const partes = /^(\D*)(-?\d+(?:\.\d+)?)(\D*)$/.exec(original);
    if (!partes) continue;
    const [, prefijo, numero, sufijo] = partes;
    const destino = Number(numero);
    if (!Number.isFinite(destino)) continue;
    const decimales = numero.includes('.') ? numero.split('.')[1].length : 0;
    estado.textos.set(nodo, original);
    let inicio = null;
    const stop = programarFrame((_delta, tiempo) => {
      if (inicio === null) inicio = tiempo;
      const avance = Math.min(1, (tiempo - inicio) / duracion);
      const valor = destino * (1 - Math.pow(1 - avance, 3));
      nodo.textContent = `${prefijo}${valor.toFixed(decimales)}${sufijo}`;
      if (avance >= 1) {
        nodo.textContent = original;
        estado.textos.delete(nodo);
        estado.stops.delete(stop);
        if (!estado.stops.size) activos.delete(estado);
      }
    });
    estado.stops.add(stop);
  }
  if (!estado.stops.size) activos.delete(estado);
}

export function iniciar() {}
