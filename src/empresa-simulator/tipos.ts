/** Dominio empresarial completamente sintético: no representa una empresa legal. */
export interface ProductoSintetico { id: string; nombre: string; precio: number; costo: number; stockInicial: number; stockMinimo: number; }
export interface ConfigEmpresa { seed: number; nombre: string; moneda: string; capitalInicial: number; empleados: number; productos: ProductoSintetico[]; }
export interface Cliente { id: string; nombre: string; recurrente: boolean; }
export interface Proveedor { id: string; nombre: string; leadTimeDias: number; fiabilidad: number; minimo: number; }
export interface Empleado { id: string; nombre: string; salarioPeriodo: number; }
export interface FacturaSimulada { id: string; clienteId: string; total: number; estado: 'pendiente' | 'pagada'; }
export interface MovimientoContable { id: string; timestampSimulado: string; concepto: string; cuentaDebe: string; cuentaHaber: string; importe: number; referencia: string; origen: 'simulacion'; metadata: Record<string, string | number>; }
export interface VentaSintetica { id: string; productoId: string; cantidad: number; total: number; costo: number; factura: FacturaSimulada; }
export interface EstadoEmpresa { caja: number; cuentasPorCobrar: number; cuentasPorPagar: number; inventarioValorizado: number; ventas: number; costos: number; gastosNomina: number; utilidad: number; }
