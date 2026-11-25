import { FX_CONFIG } from '../config.js';
import { registrarLimpieza } from './fx-core.js';

export function init(el, opciones = {}) {
  if (!el) return () => {};
  if (!(opciones.activo ?? FX_CONFIG.activar.pixelesTarjeta)) return () => {};

  const alEntrar = (event) => {
    const tarjeta = event.target.closest?.('.product-card');
    if (tarjeta) tarjeta.classList.add('fx-foco');
  };

  const alSalir = (event) => {
    const tarjeta = event.target.closest?.('.product-card');
    if (!tarjeta) return;
    if (event.relatedTarget && tarjeta.contains(event.relatedTarget)) return;
    tarjeta.classList.remove('fx-foco');
  };

  el.classList.add('fx-pixeles');
  el.addEventListener('focusin', alEntrar);
  el.addEventListener('focusout', alSalir);

  return registrarLimpieza(el, () => {
    el.removeEventListener('focusin', alEntrar);
    el.removeEventListener('focusout', alSalir);
    el.querySelectorAll('.product-card.fx-foco').forEach((tarjeta) => tarjeta.classList.remove('fx-foco'));
    el.classList.remove('fx-pixeles');
  });
}

export function iniciar() {
  init(document.getElementById('product-grid'));
}
