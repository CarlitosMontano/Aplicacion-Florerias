# Modelo de inventario v2 · Flor del Nilo

Demo sin backend. Todo el estado vive en `localStorage` bajo la clave `flor-del-nilo-demo-v1` (se conserva el nombre de la clave; el **schema** es independiente y ahora es `2`).

> **Advertencia sobre v1:** no fue posible verificar el formato v1 histórico. La versión v1 interina de Fase 1 fue una reconstrucción propia, no el datos original. La migración de esta fase no asume una forma concreta: tolera cualquier forma (objeto, arreglo, `null`, JSON inválido) y conserva lo que no reconoce. Las fixtures de `tests.html` están marcadas explícitamente como **supuestos de prueba**, no como datos v1 reales.

## Estructura del estado v2

```js
{
  schemaVersion: 2,
  creadoEn, actualizadoEn, migradoEn,   // ISO 8601
  productos: [{ id, nombre, categoria, descripcion, precioCentavos, imagen, activo, recetaId }],
  carrito: [],
  pedidos: [{ id, fechaCreacion, fechaEntrega, cliente, items,
              totalCentavos, estado, inventarioDescontado }],
  clientes: [],
  disponibilidad: {},                   // id de producto -> bool (manual, Fase 1)
  inventario: {
    insumos:     [{ id, nombre, unidad, permiteDecimales, costoUnitarioCentavos,
                    proveedorId, activo, stockActual }],
    proveedores: [{ id, nombre, telefono, direccion, activo }],
    lotes:       [{ id, insumoId, cantidadInicial, cantidadActual, fechaIngreso,
                    costoUnitarioCentavos, proveedorId, activo }],
    movimientos: [{ id, tipo, insumoId, cantidad, fecha, motivo, referencia,
                    loteId, costoUnitarioCentavos, saldo }],
    recetas:     [{ id, productoId, nombre, activo, items: [{ insumoId, cantidad }] }],
    mermas:      [{ id, movimientoId, insumoId, fecha, motivo }],
    configuracion: { metodoSalida: 'FIFO', permiteDecimalesPorUnidad: true }
  },
  notaDemo: '…',
  legacy: {}                            // claves no reconocidas
}
```

### Semilla

`createSeedState()` (en `js/inventory/seed.js`) genera la semilla completa con `schemaVersion: 2`. Incluye seis insumos ficticios: **rosas, claveles, girasoles, follaje, papel y cintas**, con proveedores, siete lotes (rosas tiene dos lotes para demostrar FIFO), un movimiento de `apertura` por lote, nueve recetas (una por producto), `mermas: []` y todos los productos con `recetaId`.

### Colecciones de inventario

- **insumos**: materiales. `stockActual` es **derivado**, nunca se edita a mano.
- **proveedores**: datos ficticios; `activo` permite baja lógica.
- **lotes**: `cantidadActual` es **derivada** de los movimientos con `loteId`. `fechaIngreso` ordena FIFO.
- **movimientos**: ledger append-only. Tipos: `apertura`, `entrada`, `salida`, `ajuste`, `merma`.
- **recetas**: componentes por producto. `activo: false` significa “no descontable” (Fase 3).
- **mermas**: metadatos que apuntan al movimiento `tipo: 'merma'` correspondiente; la merma en sí siempre es un movimiento.

## Invariantes

1. **Dinero entero**: todo `*Centavos` es entero. Formato Bs con dos decimales solo al mostrar.
2. **IDs**: `prefijo + crypto.randomUUID()` (`ins-`, `prov-`, `lote-`, `mov-`, `rec-`, `mer-`, `ped-`, `cli-`, `item-`). Hay fallback determinista si `randomUUID` no existe.
3. **Fechas ISO 8601**: `new Date().toISOString()` para timestamps; `YYYY-MM-DD` para `fechaEntrega`.
4. **Decimales restringidos**: `tallos` y `pliegos` se redondean a enteros; solo unidades con `permiteDecimales: true` (p. ej. `rollos`) conservan hasta 3 decimales. Aplica a movimientos, lotes e ítems de receta.
5. **Ledger append-only**: no existe API para borrar movimientos. Una corrección se registra como `tipo: 'ajuste'` con `cantidad` positiva o negativa; no se reescribe el histórico. Las aperturas de semilla son `tipo: 'apertura'`.
6. **Saldos derivados**: `recalcBalances(state)` recalcula `insumos[].stockActual`, `lotes[].cantidadActual` y `movimientos[].saldo` sumando `deltaMovimiento` en orden cronológico. Se ejecuta al normalizar/cargar y al guardar.
7. **FIFO**: `consumeFIFO(state, insumoId, cantidad, referencia, opciones)` genera **un movimiento por lote** (ordenado por `fechaIngreso`), propaga `referencia` y lanza `Stock insuficiente para <id>: faltan <n>` si no alcanza. Por defecto el tipo es `salida`; las mermas llaman con `opciones.tipo: 'merma'`.
8. **Baja lógica**: `activo !== false` en insumos, proveedores, lotes, recetas y productos. No se eliminan registros.
9. **Trazabilidad de pedidos**: todo producto tiene `recetaId`; todo pedido tiene `fechaEntrega` e `inventarioDescontado`. Al confirmar, `descontarPedido` marca `inventarioDescontado: true`, guarda `inventarioDescontadoEn` y `inventarioMovimientos`, y genera salidas FIFO con `referencia.tipo: 'pedido'`. Si no hay stock, `createOrder` lanza `Stock insuficiente: …` y la transacción se descarta sin mutar el estado.
10. **Aislamiento**: solo `js/inventory/storage.js` accede a `localStorage`. El resto importa el adapter.

## API del adapter (`js/inventory/storage.js`)

| Export | Tipo | Comportamiento |
| --- | --- | --- |
| `getAll()` | `async` | Lee, detecta versión/corrupción, migra si hace falta, normaliza, recalcula y devuelve una copia. Si no hay clave, guarda la semilla. |
| `save(state)` | `async` | Valida, normaliza saldos, escribe una vez, actualiza `actualizadoEn` y notifica `change`. |
| `update(mutator)` | `async` | Cola serializada: `getAll` → clonar → mutar → `save`. Si el mutator devuelve `false`, descarta. |
| `remove()` | `async` | Borra solo la clave de la demo y notifica `removed`. No toca otras claves. |
| `subscribe(fn)` | `() => void` | Eventos `change` / `warning`; devuelve `unsubscribe`. |
| `migrateV1(origen, opciones?)` | `async` | Acepta texto JSON o objeto; respalda, normaliza y escribe el estado migrado una sola vez. |
| `normalizeState(raw)` | sync | Convierte cualquier forma a v2, conserva claves desconocidas en `legacy` y recalcula saldos. |
| `recalcBalances(state)` | sync | Re-exportado desde `ledger.js`. Recalcula saldos derivados. |
| `reset()` | `async` | Restaura semilla v2 completa y deja `legacy` vacío. |
| `isFallback()`, `getFallbackReason()` | sync | Estado del fallback en memoria por cuota/almacenamiento bloqueado. |

Se re-exportan además `newId`, `deltaMovimiento`, `consumeFIFO` y `recalcBalances` para que el resto de la app no tenga que importar `ledger.js` directamente.

## Operaciones de Fase 3 (`js/inventory/operations.js`)

Módulo sin acceso a `localStorage`: trabaja sobre el draft que recibe del adapter.

| Export | Comportamiento |
| --- | --- |
| `formatearCantidad(n)` | Formato `es-BO` con hasta 3 decimales. |
| `requerimientos(state, producto)` | Ítems de la receta activa con stock actual y suficiencia. |
| `estadoProducto(state, producto)` | Devuelve `{ disponible, etiqueta, motivo }`. `Agotado` gana sobre `Sin stock` cuando el control manual está desactivado. |
| `productoDisponible(state, producto)` | Atajo booleano sobre `estadoProducto`. |
| `validarDisponibilidad(state, items)` | Agrega la demanda por insumo de carrito/pedido (solo recetas activas) y devuelve `{ ok, faltantes, demanda }`. |
| `descontarPedido(draft, pedido)` | Valida y consume FIFO; marca el pedido y devuelve los movimientos creados. |
| `registrarMovimientoEnDraft(draft, datos)` / `registrarMovimiento(datos)` | `entrada` crea lote; `ajuste` corrige con signo; `merma` consume FIFO generando movimientos `tipo: 'merma'` con `loteId` y un metadato por movimiento. |
| `guardarInsumoEnDraft` / `guardarInsumo` | Alta/edición con baja lógica (`activo`). Nunca edita `stockActual`. |
| `guardarRecetaEnDraft` / `guardarReceta` | Alta/edición de receta, asigna `producto.recetaId` y respeta decimales por unidad. |

## Migración y respaldos

- Si la clave no existe: se escribe la semilla v2.
- Si el JSON es inválido: se guarda el texto crudo en `flor-del-nilo-demo-v1.corrupt-<fecha>` y se escribe la semilla v2.
- Si el JSON es válido pero no es v2: se guarda el texto crudo en `flor-del-nilo-demo-v1.backup-<fecha>`, se normaliza, se marca `migradoEn` y se escribe el resultado v2 **una sola vez**. Las llamadas posteriores a `getAll()` no generan nuevos respaldos.
- Toda clave de primer nivel no reconocida se copia a `legacy` sin interpretarla. Se añade `legacy.__migracion` con la versión de origen y la fecha; si la raíz no era un objeto, se conserva como `legacy.__raizNoObjeto`.
- Colecciones ausentes o inválidas se reponen desde la semilla; colecciones presentes se conservan y se normalizan campo por campo.
- Un producto sin receta reconocible recibe una receta generada con `activo: false` para que **todo producto tenga `recetaId`** y no desconte stock hasta que se defina su receta.

## Decisiones registradas

- Se mantiene `flor-del-nilo-demo-v1` como clave de almacenamiento para no perder datos de la demo; el cambio de formato se expresa con `schemaVersion: 2` dentro del JSON.
- `reset()` **limpia `legacy`** porque la semilla es un estado nuevo y reproducible; los respaldos `.backup-`/`.corrupt-` **se conservan** como auditoría y no se eliminan. Otras claves del navegador nunca se tocan.
- Las correcciones nunca reescriben el ledger: se usa `ajuste` con signo.
- Las mermas se modelan como movimiento + metadato, no como saldo independiente.
- No se agregó dependencia ni build: módulos ES nativos y `console.assert`.
- Se expone `window.__debug = { getAll, migrateV1, reset }` para inspección manual desde la consola.
- El fallback por `QuotaExceededError` sigue avisando con prioridad alta para que no sea tapado por toasts de la interfaz.

## Pruebas

Abre `tests.html` sirviendo el proyecto (por ejemplo `python -m http.server 5500`) y revisa el resumen en pantalla o `window.__testResults`. Cubre semilla, saldos derivados, signos del ledger, FIFO, normalización tolerante, decimales por unidad, migración con fixture supuesta, JSON corrupto, pedidos v2, demanda agregada, descuento FIFO atómico, entradas/ajustes/mermas, baja suave, guardado de recetas, `createOrder` desde la app, reset y `__debug`. La página guarda el valor original de la clave y lo restaura al terminar, eliminando solo los respaldos que ella misma creó.

## Fase 3: UI operativa y descuento al confirmar

- **Panel de administración**: nueva sección `Inventario` (inyectada por JS, sin tocar `index.html` ni `css/styles.css`) con vistas `resumen`, `insumos`, `recetas`, `lotes`, `movimientos` y `mermas`. Reutiliza clases existentes (`.admin-table`, `.metric-card`, `.checkout-form`, `.button`, `.status-pill`) y un `<dialog id="modal-generico">` creado en runtime con `ui.tpl`/`textContent`.
- **Altas y ediciones**: formularios de insumo (nombre, unidad, mínimo, costo, decimales, activo), receta (producto, items por insumo, activo) y movimientos (entrada, ajuste, merma). El stock nunca se escribe a mano.
- **Visualización**: resumen con insumos, lotes activos, bajo mínimo y vencidos; tablas de stock derivado, lotes con estado y ledger cronológico.
- **Mermas**: se consumen FIFO, generan un movimiento `tipo: 'merma'` por lote y un metadato en `mermas`; pueden eliminarse desde la tabla, revirtiendo movimiento y recalculando saldos.
- **Catálogo y carrito**: usan `estadoProducto`/`productoDisponible`. El bloqueo manual muestra `Agotado`; la falta de stock muestra `Sin stock`. El carrito valida demanda agregada antes de agregar y deshabilita el checkout si falta stock.
- **Checkout**: el paso de confirmación vuelve a validar y deshabilita «Confirmar pedido» avisando con `faltantes`. `createOrder` valida dentro de `update`, descuenta FIFO y marca `inventarioDescontado`. Si falla, `update` no escribe nada y se muestra el error.
- Los productos sin receta activa conservan el control manual de disponibilidad y no descuentan stock; las recetas generadas por la migración quedan `activo: false`.
