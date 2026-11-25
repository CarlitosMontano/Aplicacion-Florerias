# Flor del Nilo — Boutique Floral

Demo comercial frontend para una floristería de Cochabamba, desarrollada por Aethelyn Software.

## Objetivo

Presentar una experiencia digital completa sin backend: landing page, catálogo, personalización, carrito, checkout simulado, pedidos, panel administrativo e inventario operativo, conectados mediante `localStorage`.

## Stack

- HTML5 semántico (`index.html`).
- CSS3 nativo, responsive y mobile-first (`css/styles.css`).
- JavaScript ES6+ con módulos ES nativos; sin frameworks, npm, build ni backend.
- Persistencia local bajo una sola clave: `flor-del-nilo-demo-v1`, con `schemaVersion: 2` dentro del JSON.
- Datos ficticios en `js/seed-base.js` y `js/inventory/seed.js`.
- Pruebas con `console.assert` en `tests.html`.

## Ejecución local

Desde esta carpeta ejecuta:

```bash
python -m http.server 5500
```

Luego abre <http://localhost:5500>. También puedes usar la extensión **Live Server** de VS Code. No abras `index.html` directamente con `file://`.

Para verificar el modelo de inventario abre <http://localhost:5500/tests.html> y revisa el resumen o `window.__testResults`. Actualmente hay **80 aserciones**.

## Estructura

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Estructura pública, modales y contenedores. No se edita desde JS. |
| `css/styles.css` | Identidad visual, componentes, responsive y administración. |
| `js/app.js` | Arranque: conecta módulos, suscripción a cambios y render global. |
| `js/config.js` | Marca, contactos, moneda, claves, opciones y transiciones de pedido. |
| `js/ui.js` | Escape (`tpl`, `raw`, `escapeHtml`), toasts, modales, fechas, money y chrome global. |
| `js/seed-base.js` | 9 productos, 4 ocasiones, imagen de respaldo y semilla base. |
| `js/catalog.js` | Catálogo, filtros, detalle y disponibilidad. |
| `js/cart.js` | Carrito persistente y validación de stock agregado. |
| `js/checkout.js` | Checkout de tres pasos y aviso de stock. |
| `js/orders.js` | Creación de pedidos, descuento FIFO y cambios de estado. |
| `js/customers.js` | Clientes derivados de los pedidos. |
| `js/calendar.js` | Calendario mensual de entregas. |
| `js/admin.js` | Panel administrativo y sus secciones. |
| `js/demo.js` | Modo Demo y reinicio confirmado. |
| `js/fx/` | Efectos botánicos modulares: revelados, aurora, pétalos, pixeles, contador, pasos, magnet, testimonios, galería, halo, dock, anotaciones, enredadera, girasol, ramitas, WhatsApp y mariposa. |
| `js/fx/fx-core.js` | Tokens, preferencia de movimiento, scheduler compartido, observadores y limpieza idempotente. |
| `css/fx-tokens.css` | Colores, duraciones y curvas del sistema de animaciones. |
| `css/animations.css` | Estados y reglas de los efectos, incluido el modo administrativo estático. |
| `js/inventory/storage.js` | Único módulo que toca `localStorage`: lectura, migración, guardado y eventos. |
| `js/inventory/ledger.js` | Ledger append-only, saldos derivados y FIFO. |
| `js/inventory/seed.js` | Semilla v2 de inventario. |
| `js/inventory/operations.js` | Operaciones de inventario usadas por UI, carrito, checkout y pedidos. |
| `js/inventory/panel.js` | Panel de inventario inyectado en administración. |
| `tests.html` | Pruebas del modelo y de las operaciones de inventario. |
| `docs/MODELO-INVENTARIO.md` | Contrato detallado del esquema v2 y decisiones. |

## Funcionalidades implementadas

### Pública

- **Landing**: cabecera sticky, menú móvil, barra de progreso, secciones revelables al hacer scroll, rail izquierdo en escritorio y dock flotante inferior centrado en móvil.
- **Catálogo**: 9 arreglos ficticios, 4 ocasiones, búsqueda por texto y filtros por categoría y rango de precio.
- **Detalle de producto**: opciones de color, presentación y tamaño, dedicatoria y cantidad de 1 a 20.
- **Disponibilidad**: control manual (`Agotado`) y control automático por stock (`Sin stock`). Los productos sin receta activa conservan el control manual.
- **Carrito**: agregar/quitar items, persistencia, contador, validación de disponibilidad y de demanda agregada antes de agregar.
- **Checkout**: tres pasos (datos, revisión, confirmación), validación de teléfono de 7 u 8 dígitos, fecha de entrega no anterior a hoy, aviso de faltantes y botón de confirmación deshabilitado si no hay stock.
- **Pedidos**: creación local con total en centavos, cliente, `fechaEntrega`, `inventarioDescontado` y movimientos FIFO referidos al pedido.
- **Modo Demo**: contactos y horarios marcados como ficticios/pendientes de confirmación y reinicio de datos con confirmación.

### Administración

Secciones disponibles en `#admin-shell`:

- **Resumen**: pedidos, ingresos, estados, gráfico de barras y métricas.
- **Pedidos**: tabla filtrable por estado y cambio de estado respetando transiciones (`Pendiente → En preparación → Listo → Entregado`, con `Cancelado` permitido desde estados iniciales).
- **Calendario**: navegación mensual y días con entregas.
- **Clientes**: alta implícita desde pedidos y tabla de contactos.
- **Productos**: activación/desactivación manual de disponibilidad.
- **Inventario**:
  - Resumen de insumos, lotes activos, insumos bajo mínimo y lotes vencidos.
  - Altas y ediciones de insumos y recetas.
  - Entradas (crean lote), ajustes con signo y mermas FIFO con lote.
  - Baja lógica de insumos y recetas mediante `activo`.
  - Tablas de stock derivado, lotes, ledger cronológico y mermas.
  - Eliminación de mermas con reversión del movimiento y recálculo de saldos.
  - Modal genérico creado en runtime, sin tocar `index.html`.
- **Modo Demo**: reinicio y acceso al panel.

El botón «Admin» móvil se inyecta por JS en `#mobile-bottom-bar`. Ese contenedor es un rail izquierdo en escritorio y un dock flotante inferior centrado en móvil, por encima del resto de la interfaz. El panel es estático: sin animaciones, transiciones ni contadores.

## Animaciones botánicas (Fases 0–8)

El movimiento es decorativo, suave y completamente opcional. Se construyó en fases incrementales y puede desactivarse efecto por efecto desde `FX_CONFIG.activar`:

- **Fase 0–5**: línea base de rendimiento, revelados al scroll (`reveal`), aurora y pétalos del hero, pixeles de producto, contador del carrito, pasos del checkout, magnetismo de botones, testimonios y galería.
- **Fase 6**: halo cálido en ocasiones (`spotlightCard`), dock magnético y anotaciones a pincel (`anotacionesTexto`).
- **Fase 7**: enredadera de progreso (`vineProgreso`), girasol que sigue al puntero (`girasol`), ramitas dibujadas al llegar a cada sección (`divisores`) y botón de WhatsApp con pulso (`botonWhatsapp`).
- **Fase 8**: mariposa que revolotea sobre el catálogo (`mariposaCatalogo`), inyectada en `#catalogo` sin tocar `index.html`.

Reglas del sistema:

- Un solo efecto ambiental protagonista por pantalla; como máximo 4 `.fx-revelar` por página.
- Colores, duraciones, curvas y amplitudes viven en `css/fx-tokens.css`; los módulos de `js/fx/` los leen con `getComputedStyle` mediante `token()` y `tokenNumero()`.
- Entradas entre 600 y 1200 ms con `cubic-bezier(.22,1,.36,1)`; sin rebotes, neón ni glitch.
- El interruptor «Reducir animaciones» y `prefers-reduced-motion` comparten estado: no rerenderizan ni pierden foco o datos.
- Todo efecto se pausa fuera de viewport y con la pestaña oculta; la limpieza es idempotente y el DPR se limita a 2 en los efectos de canvas.
- El panel administrativo no tiene animaciones de ningún tipo: solo paleta de colores. Al abrirlo se pausa el scheduler global.

## Inventario v2

El estado incluye `productos`, `carrito`, `pedidos`, `clientes`, `disponibilidad`, `legacy` y un objeto `inventario` con:

- `insumos`, `proveedores`, `lotes`, `movimientos`, `recetas` y `mermas`.
- `stockActual` y `lotes[].cantidadActual` **derivados** de los movimientos; nunca se editan a mano.
- Ledger append-only: `apertura`, `entrada`, `salida`, `ajuste` y `merma`. Las correcciones son `ajuste`; las mermas se consumen FIFO y conservan `loteId`.
- Dinero en enteros centavos; IDs con prefijo + `crypto.randomUUID()`; fechas ISO 8601; decimales solo si la unidad lo permite.
- Semilla con 6 insumos, 7 lotes (rosas tiene dos para demostrar FIFO), 9 recetas activas y 9 productos con `recetaId`.

### API principal

| Módulo | Funciones |
| --- | --- |
| `storage.js` | `getAll`, `save`, `update`, `subscribe`, `migrateV1`, `normalizeState`, `recalcBalances`, `reset`, `remove`, `isFallback`, `getFallbackReason`. Re-exporta `newId`, `deltaMovimiento`, `consumeFIFO` y `recalcBalances`. |
| `ledger.js` | `newId`, `deltaMovimiento`, `recalcBalances`, `consumeFIFO(state, insumoId, cantidad, referencia, opciones)`. |
| `operations.js` | `formatearCantidad`, `requerimientos`, `estadoProducto`, `productoDisponible`, `validarDisponibilidad`, `descontarPedido`, `registrarMovimiento`, `guardarInsumo`, `guardarReceta` y sus variantes `EnDraft`. |
| `panel.js` | `init`, `renderPanel`, `recargar`. |

`window.__debug = { getAll, migrateV1, reset, getPreferencias, setPreferencias }` queda expuesto para inspección manual desde la consola.

## Persistencia, migración y seguridad

- Solo `js/inventory/storage.js` accede a `localStorage`; el resto usa el adapter.
- Si la clave no existe se guarda la semilla v2.
- JSON inválido: se respalda como `flor-del-nilo-demo-v1.corrupt-<fecha>` y se restaura la semilla.
- Formato anterior: se respalda como `flor-del-nilo-demo-v1.backup-<fecha>`, se normaliza a v2 y se escribe una sola vez. Las claves no reconocidas se conservan en `legacy`.
- `reset()` restaura la semilla y limpia `legacy`, sin borrar otras claves ni los respaldos `.backup-`/`.corrupt-`.
- Si `localStorage` falla por cuota o bloqueo, se activa un fallback en memoria con aviso prioritario.
- Los cambios se sincronizan entre pestañas mediante eventos `storage`.
- Todo texto del usuario se renderiza con `textContent` o `ui.tpl`/`ui.raw`; no se interpola HTML sin escapar.

## Limitaciones

La aplicación es demostrativa. No autentica usuarios, no procesa pagos, no envía pedidos, no usa base de datos remota y no debe confundirse con información comercial confirmada. Teléfonos, horarios, nombres, precios, costos y pedidos son ficticios o pendientes de confirmación.

El formato v1 histórico no se pudo verificar: la migración tolera cualquier forma y las fixtures de v1 en `tests.html` están marcadas como supuestos de prueba, no como datos reales.

## Mejoras futuras

Conectar un backend seguro, autenticación de administración, base de datos, gestiones reales de inventario, pasarela de pagos, notificaciones y recursos visuales autorizados por el negocio.
