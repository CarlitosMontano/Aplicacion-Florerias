import { CONFIG } from './config.js';
import { reset } from './inventory/storage.js';
import * as ui from './ui.js';

let handlers = {};
let eventosListos = false;

export async function resetDemo() {
  const aceptado = ui.confirmDialog('¿Reiniciar la demostración? Se perderán los datos locales actuales de esta demo.');
  if (!aceptado) return;
  await reset();
  ui.closeModal('demo-modal');
  ui.toast('Demostración reiniciada con datos ficticios');
}

export function openDemo() {
  const contenido = document.getElementById('demo-content');
  if (!contenido) return;
  ui.setHTML(contenido, ui.tpl`
    <h2>Modo Demo</h2>
    <p>${CONFIG.marca} · ${CONFIG.ciudad}, ${CONFIG.pais}</p>
    <div class="demo-list">
      <button type="button" data-demo-reset>Reiniciar demostración</button>
      <button type="button" data-demo-admin>Abrir administración</button>
    </div>
    <p class="small-note">WhatsApp ${CONFIG.whatsapp.codigo} ${CONFIG.whatsapp.numero} y teléfono ${CONFIG.telefono.numero}: ficticios, pendientes de confirmar. ${CONFIG.horario}.</p>
  `);
  ui.openModal('demo-modal');
}

export function init(opciones = {}) {
  handlers = opciones;
  if (eventosListos) return;
  const contenido = document.getElementById('demo-content');
  contenido?.addEventListener('click', async (event) => {
    if (event.target.closest('[data-demo-reset]')) await resetDemo();
    if (event.target.closest('[data-demo-admin]')) {
      ui.closeModal('demo-modal');
      handlers.onAdmin?.();
    }
  });
  eventosListos = true;
}
