/** Contrato deliberadamente de solo lectura entre Atlas y el bridge privado. */
export interface EstadoMT5 { conectado: boolean; terminal: 'disponible' | 'desconectado'; servidor: string | null; }
export interface CuentaMT5 { tipo: 'DEMO' | 'REAL' | 'DEMO_CENTS' | 'DEMO_FIXED'; idSeguro: string; moneda: string; apalancamiento: number; }
export interface SimboloMT5 { nombre: string; digitos: number; }
export interface TickMT5 { simbolo: string; fecha: string; bid: number; ask: number; }
export interface VelaMT5 { fecha: string; apertura: number; maximo: number; minimo: number; cierre: number; volumen: number; }
export interface PosicionMT5 { ticketSeguro: string; simbolo: string; lado: 'compra' | 'venta'; volumen: number; precioApertura: number; }
export interface HistorialMT5 { idSeguro: string; simbolo: string; fecha: string; resultado: number; }
export type OperacionLectura = 'estado' | 'cuenta' | 'simbolos' | 'tick' | 'velas' | 'posiciones' | 'historial';
export interface PeticionBridge { operacion: OperacionLectura; simbolo?: string; desde?: string; hasta?: string; limite?: number; }
export interface TransporteBridge { solicitar(peticion: PeticionBridge): Promise<unknown>; }
/** No existe método de escritura en esta interfaz. */
export interface MT5ReadOnlyBridge { estado(): Promise<EstadoMT5>; cuenta(): Promise<CuentaMT5>; simbolos(): Promise<SimboloMT5[]>; tick(simbolo: string): Promise<TickMT5>; velas(simbolo: string, desde: string, hasta: string, limite: number): Promise<VelaMT5[]>; posiciones(): Promise<PosicionMT5[]>; historial(desde: string, hasta: string, limite: number): Promise<HistorialMT5[]>; }
