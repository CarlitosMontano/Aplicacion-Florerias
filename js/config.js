export const CONFIG = Object.freeze({
  marca: 'Flor del Nilo',
  pais: 'Bolivia',
  ciudad: 'Cochabamba',
  whatsapp: Object.freeze({
    codigo: '591',
    numero: '60588102',
    link: 'https://wa.me/59160588102',
    nota: 'Ficticio / pendiente de confirmación comercial'
  }),
  telefono: Object.freeze({
    numero: '4064447',
    nota: 'Ficticio / pendiente de confirmación comercial'
  }),
  moneda: Object.freeze({ codigo: 'Bs', simbolo: 'Bs', decimales: 2 }),
  direccion: 'Parque Demetrio Canelas, edificio Demetrio Canelas N.º 2407, esquina calle Tocopilla, entre Av. Beijing y Av. Melchor Pérez.',
  horario: 'Consultar horario de atención',
  storageKey: 'flor-del-nilo-demo-v1',
  schemaVersion: 2,
  opciones: Object.freeze({
    color: Object.freeze(['Natural', 'Rosado', 'Blanco', 'Mixto']),
    presentacion: Object.freeze(['Ramo', 'Arreglo', 'Caja']),
    tamano: Object.freeze(['Pequeño', 'Mediano', 'Grande'])
  }),
  estadosPedido: Object.freeze(['Pendiente', 'En preparación', 'Listo', 'Entregado', 'Cancelado'])
});

export const ETIQUETAS_OPCION = Object.freeze({
  color: 'Color',
  presentacion: 'Presentación',
  tamano: 'Tamaño'
});

export const TRANSICIONES = Object.freeze({
  Pendiente: Object.freeze(['En preparación', 'Cancelado']),
  'En preparación': Object.freeze(['Listo', 'Cancelado']),
  Listo: Object.freeze(['Entregado', 'Cancelado']),
  Entregado: Object.freeze([]),
  Cancelado: Object.freeze([])
});

export const FX_CONFIG = Object.freeze({
  preferenciasPorDefecto: Object.freeze({ reducirAnimaciones: false }),
  activar: Object.freeze({
    reveal: true,
    aurora: true,
    petalos: true,
    pixelesTarjeta: true,
    contadorCarrito: true,
    pasoCheckout: true,
    magnet: true,
    testimonios: true,
    galeria: true,
    countup: false,
    barras: false,
    stockBarras: false,
    spotlightCard: true,
    dock: true,
    anotacionesTexto: true,
    vineProgreso: true,
    girasol: true,
    divisores: true,
    botonWhatsapp: true,
    mariposaCatalogo: true
  }),
  parametros: Object.freeze({
    reveal: Object.freeze({ threshold: 0.12 }),
    petalos: Object.freeze({ escritorio: 40, movil: 15, dprMaximo: 2 }),
    contadorCarrito: Object.freeze({ duracionMs: 320 }),
    pasoCheckout: Object.freeze({ duracionMs: 260, desplazamientoPx: 8 }),
    magnet: Object.freeze({ maximaPx: 5 }),
    testimonios: Object.freeze({ duracionMs: 550, escalonamientoMs: 90 }),
    galeria: Object.freeze({ escalonamientoMs: 70 }),
    countup: Object.freeze({ duracionMs: 700 }),
    barras: Object.freeze({ duracionMs: 520, escalonamientoMs: 60 }),
    stockBarras: Object.freeze({ duracionMs: 480, escalonamientoMs: 45 }),
    raf: Object.freeze({ pausaAlOcultar: true })
  })
});
