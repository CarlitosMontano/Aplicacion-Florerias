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
    <ul class="demo-notes">
      <li>Productos, nombres y precios ficticios: sirven para presentar la experiencia digital.</li>
      <li>El texto institucional y el horario de atención son propuestas pendientes de confirmación.</li>
      <li>WhatsApp ${CONFIG.whatsapp.codigo} ${CONFIG.whatsapp.numero} y teléfono ${CONFIG.telefono.numero} son ficticios, pendientes de confirmar.</li>
      <li>No se procesa ningún pago: los pedidos quedan guardados solo en este dispositivo.</li>
    </ul>
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
