import { CONFIG, FX_CONFIG } from '../config.js';
import { createBaseSeed } from '../seed-base.js';
import { newId, recalcBalances } from './ledger.js';

export { newId };

const ahoraISO = () => new Date().toISOString();
const diasAtras = (dias) => new Date(Date.now() - dias * 86400000).toISOString();

/*
 * Semilla v2. Todos los datos son ficticios.
 * Los IDs se generan con prefijo + crypto.randomUUID() (ver ledger.js).
 * Las cantidades son decimales solo donde la unidad lo permite (rollos).
 */
export function createSeedState() {
  const base = createBaseSeed();
  const fechaApertura = diasAtras(20);
  const fechaAperturaTardia = diasAtras(6);

  const proveedores = [
    { id: newId('prov'), nombre: 'Vivero El Nilo', telefono: '4000001', direccion: 'Cochabamba', activo: true },
    { id: newId('prov'), nombre: 'Flores Andinas', telefono: '4000002', direccion: 'Sacaba', activo: true },
    { id: newId('prov'), nombre: 'Papelería Central', telefono: '4000003', direccion: 'Cochabamba', activo: true }
  ];

  const insumos = [
    { id: newId('ins'), nombre: 'Rosas nacionales', unidad: 'tallos', permiteDecimales: false, costoUnitarioCentavos: 350, proveedorId: proveedores[0].id, activo: true },
    { id: newId('ins'), nombre: 'Claveles', unidad: 'tallos', permiteDecimales: false, costoUnitarioCentavos: 220, proveedorId: proveedores[0].id, activo: true },
    { id: newId('ins'), nombre: 'Girasoles', unidad: 'tallos', permiteDecimales: false, costoUnitarioCentavos: 480, proveedorId: proveedores[1].id, activo: true },
    { id: newId('ins'), nombre: 'Follaje verde', unidad: 'tallos', permiteDecimales: false, costoUnitarioCentavos: 150, proveedorId: proveedores[1].id, activo: true },
    { id: newId('ins'), nombre: 'Papel kraft', unidad: 'pliegos', permiteDecimales: false, costoUnitarioCentavos: 650, proveedorId: proveedores[2].id, activo: true },
    { id: newId('ins'), nombre: 'Cinta de yute', unidad: 'rollos', permiteDecimales: true, costoUnitarioCentavos: 1800, proveedorId: proveedores[2].id, activo: true }
  ];

  const porNombre = new Map(insumos.map((insumo) => [insumo.nombre, insumo]));
  const rosa = porNombre.get('Rosas nacionales');
  const clavel = porNombre.get('Claveles');
  const girasol = porNombre.get('Girasoles');
  const follaje = porNombre.get('Follaje verde');
  const papel = porNombre.get('Papel kraft');
  const cinta = porNombre.get('Cinta de yute');

  const lotes = [
    { id: newId('lote'), insumoId: rosa.id, cantidadInicial: 70, fechaIngreso: fechaApertura, costoUnitarioCentavos: 350, proveedorId: rosa.proveedorId, activo: true },
    { id: newId('lote'), insumoId: rosa.id, cantidadInicial: 50, fechaIngreso: fechaAperturaTardia, costoUnitarioCentavos: 380, proveedorId: rosa.proveedorId, activo: true },
    { id: newId('lote'), insumoId: clavel.id, cantidadInicial: 90, fechaIngreso: fechaApertura, costoUnitarioCentavos: 220, proveedorId: clavel.proveedorId, activo: true },
    { id: newId('lote'), insumoId: girasol.id, cantidadInicial: 60, fechaIngreso: fechaApertura, costoUnitarioCentavos: 480, proveedorId: girasol.proveedorId, activo: true },
    { id: newId('lote'), insumoId: follaje.id, cantidadInicial: 150, fechaIngreso: fechaApertura, costoUnitarioCentavos: 150, proveedorId: follaje.proveedorId, activo: true },
    { id: newId('lote'), insumoId: papel.id, cantidadInicial: 40, fechaIngreso: fechaApertura, costoUnitarioCentavos: 650, proveedorId: papel.proveedorId, activo: true },
    { id: newId('lote'), insumoId: cinta.id, cantidadInicial: 12.5, fechaIngreso: fechaApertura, costoUnitarioCentavos: 1800, proveedorId: cinta.proveedorId, activo: true }
  ];

  const movimientos = lotes.map((lote) => ({
    id: newId('mov'),
    tipo: 'apertura',
    insumoId: lote.insumoId,
    cantidad: lote.cantidadInicial,
    fecha: lote.fechaIngreso,
    motivo: 'apertura',
    referencia: { tipo: 'apertura', id: lote.id },
    loteId: lote.id,
    costoUnitarioCentavos: lote.costoUnitarioCentavos,
    saldo: 0
  }));

  const recetasDefinicion = [
    { productoId: 'prod-ramo-rosas-clasicas', nombre: 'Ramo de rosas clásicas', items: [[rosa, 12], [follaje, 4], [papel, 2], [cinta, 0.5]] },
    { productoId: 'prod-ramo-claveles', nombre: 'Ramo de claveles', items: [[clavel, 12], [follaje, 3], [papel, 2], [cinta, 0.5]] },
    { productoId: 'prod-arreglo-girasoles', nombre: 'Arreglo de girasoles', items: [[girasol, 8], [follaje, 5], [papel, 1]] },
    { productoId: 'prod-arreglo-follaje', nombre: 'Arreglo de follaje', items: [[follaje, 15], [papel, 1]] },
    { productoId: 'prod-rosas-preservadas', nombre: 'Rosas preservadas', items: [[rosa, 6], [papel, 2], [cinta, 1]] },
    { productoId: 'prod-macetero-floral', nombre: 'Macetero floral', items: [[rosa, 5], [clavel, 4], [follaje, 6]] },
    { productoId: 'prod-ramo-papel-kraft', nombre: 'Ramo en papel kraft', items: [[rosa, 8], [papel, 3], [cinta, 0.5]] },
    { productoId: 'prod-arreglo-globos', nombre: 'Arreglo con globos', items: [[girasol, 5], [follaje, 4], [papel, 1]] },
    { productoId: 'prod-tarjeta-personalizada', nombre: 'Tarjeta personalizada', items: [[papel, 1]] }
  ];

  const recetas = recetasDefinicion.map((receta) => ({
    id: newId('rec'),
    productoId: receta.productoId,
    nombre: receta.nombre,
    activo: true,
    items: receta.items.map(([insumo, cantidad]) => ({ insumoId: insumo.id, cantidad }))
  }));

  const recetaPorProducto = new Map(recetas.map((receta) => [receta.productoId, receta.id]));
  const productos = base.productos.map((producto) => ({
    ...producto,
    activo: true,
    recetaId: recetaPorProducto.get(producto.id) || null
  }));

  const inventario = {
    insumos,
    proveedores,
    movimientos,
    recetas,
    lotes,
    mermas: [],
    configuracion: { metodoSalida: 'FIFO', permiteDecimalesPorUnidad: true }
  };

  const state = {
    schemaVersion: 2,
    creadoEn: ahoraISO(),
    productos,
    carrito: [],
    pedidos: [],
    clientes: [],
    disponibilidad: {},
    inventario,
    preferencias: { reducirAnimaciones: FX_CONFIG.preferenciasPorDefecto.reducirAnimaciones },
    notaDemo: 'Datos ficticios de inventario. Contactos y costos pendientes de confirmación comercial.',
    legacy: {}
  };
  return recalcBalances(state);
}
