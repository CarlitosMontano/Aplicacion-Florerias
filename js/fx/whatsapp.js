import { CONFIG, FX_CONFIG } from '../config.js';
import { registrarLimpiezaClave } from './fx-core.js';

const NS = 'http://www.w3.org/2000/svg';

function crearBoton() {
  const enlace = document.createElement('a');
  enlace.className = 'fx-whatsapp';
  enlace.href = CONFIG.whatsapp.link;
  enlace.target = '_blank';
  enlace.rel = 'noreferrer';
  enlace.setAttribute('aria-label', `Abrir WhatsApp (${CONFIG.whatsapp.numero}, número de demostración)`);

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 5 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.2-.2-.3-.5-.4Z');
  svg.appendChild(path);
  enlace.appendChild(svg);
  return enlace;
}

export function init(contenedor, opciones = {}) {
  if (!contenedor) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.botonWhatsapp)) return () => {};
  if (contenedor.querySelector('.fx-whatsapp')) return () => {};

  const enlace = crearBoton();
  contenedor.classList.add('fx-whatsapp-activo');
  contenedor.appendChild(enlace);

  return registrarLimpiezaClave(contenedor, 'whatsapp', () => {
    enlace.remove();
    contenedor.classList.remove('fx-whatsapp-activo');
  });
}

export function iniciar() {
  init(document.body);
}
