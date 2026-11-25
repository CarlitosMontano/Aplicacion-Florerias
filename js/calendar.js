import * as ui from './ui.js';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
let anio = new Date().getFullYear();
let mes = new Date().getMonth();

function isoLocal(fecha) {
  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0')
  ].join('-');
}

export function etiqueta() {
  return new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric' }).format(new Date(anio, mes, 1));
}

export function prev() {
  mes -= 1;
  if (mes < 0) {
    mes = 11;
    anio -= 1;
  }
}

export function next() {
  mes += 1;
  if (mes > 11) {
    mes = 0;
    anio += 1;
  }
}

export function render(state) {
  const pedidos = Array.isArray(state.pedidos) ? state.pedidos : [];
  const primero = new Date(anio, mes, 1);
  const inicio = new Date(anio, mes, 1 - primero.getDay());
  const celdas = [];
  for (let i = 0; i < 42; i += 1) {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    const clave = isoLocal(dia);
    const delMes = dia.getMonth() === mes;
    const pedidosDia = pedidos.filter((pedido) => pedido.fechaEntrega === clave);
    const clase = ['calendar-day', pedidosDia.length ? 'has-order' : ''].filter(Boolean).join(' ');
    const detalle = pedidosDia.length
      ? ui.tpl`<em>${pedidosDia.length} pedido${pedidosDia.length === 1 ? '' : 's'} · ${pedidosDia[0].cliente?.nombre || 'Cliente'}</em>`
      : '';
    celdas.push(ui.tpl`
      <div class="${clase}" title="${clave}">
        <strong class="${delMes ? '' : 'small-note'}">${dia.getDate()}</strong>
        ${ui.raw(detalle)}
      </div>
    `);
  }
  const cabezales = DIAS.map((dia) => ui.tpl`<span>${dia}</span>`).join('');
  return ui.tpl`
    <div class="admin-actions">
      <button type="button" data-cal-prev aria-label="Mes anterior">← Mes anterior</button>
      <button type="button" data-cal-next aria-label="Mes siguiente">Mes siguiente →</button>
    </div>
    <h3>${etiqueta()}</h3>
    <div class="calendar-grid">
      ${ui.raw(cabezales)}
      ${ui.raw(celdas.join(''))}
    </div>
    <p class="small-note">Los días con pedido programado se resaltan en rosa.</p>
  `;
}
