import { getAll, subscribe } from './inventory/storage.js';
import * as ui from './ui.js';
import * as catalog from './catalog.js';
import * as cart from './cart.js';
import * as checkout from './checkout.js';
import * as admin from './admin.js';
import * as demo from './demo.js';
import * as fx from './fx/fx-core.js';

async function boot() {
  document.documentElement.classList.add('js-ready');
  ui.initGlobal();
  await fx.init();

  const render = (state) => {
    if (!state) return;
    catalog.render(state);
    cart.render(state);
    admin.renderIfOpen(state);
  };

  subscribe((state, event) => {
    if (event?.type === 'warning') {
      ui.toast(event.message, 2);
      return;
    }
    if (event?.type === 'preferencias') return;
    if (event?.removed || !state) {
      getAll().then(render);
      return;
    }
    render(state);
  });

  ui.initChrome({
    onCart: () => cart.openCart(),
    onCheckout: () => checkout.openCheckout(),
    onAdmin: () => admin.openAdmin(),
    onDemo: () => demo.openDemo()
  });

  catalog.init();
  cart.init({ onCheckout: () => checkout.openCheckout() });
  checkout.init({ onBackToCart: () => cart.openCart() });
  admin.init();
  demo.init({ onAdmin: () => admin.openAdmin() });

  const anio = document.getElementById('current-year');
  if (anio) anio.textContent = String(new Date().getFullYear());

  const state = await getAll();
  render(state);
}

boot().catch((error) => {
  console.error('No se pudo iniciar la demostración:', error);
  ui.toast('No se pudo iniciar la demostración');
});
