import type { Generador, NombreProveedor, Proveedor } from '../proveedores/tipos.ts';

/** Datos mínimos para elegir una ruta; no contiene prompts ni secretos. */
export interface SolicitudIA {
  tipo: 'programacion' | 'educacion' | 'evaluacion' | 'general';
  complejidad: 'baja' | 'media' | 'alta';
  riesgo: 'bajo' | 'medio' | 'alto';
}

export type NivelCoste = 'local' | 'api_pagada';
export type RazonRuta = 'local_disponible' | 'proveedor_permitido' | 'sin_proveedor_permitido';
export type ResultadoRuta = 'exito' | 'no_disponible' | 'truncada' | 'error_no_recuperable';
export type TipoErrorRuta = 'no_disponible' | 'respuesta_incompleta' | 'no_recuperable';

/** Política explícita, inyectable y por tanto determinista en pruebas. */
export interface PoliticaVortice {
  apiPagadaPermitida: boolean;
  ordenSencilla: NombreProveedor[];
  ordenCompleja: NombreProveedor[];
}

export interface DecisionRuta {
  proveedor: NombreProveedor | null;
  razon: RazonRuta;
  coste: NivelCoste | null;
  api_pagada: boolean;
}

/** Metadatos seguros: deliberadamente no incluye sistema, usuario, error crudo ni claves. */
export interface RegistroRuta {
  proveedor: NombreProveedor;
  razon: RazonRuta;
  coste: NivelCoste;
  api_pagada: boolean;
  duracion_ms: number;
  resultado: ResultadoRuta;
  tipo_error?: TipoErrorRuta;
  fallback_utilizado: boolean;
}

export interface Vortice {
  decidir(solicitud: SolicitudIA): DecisionRuta;
  ejecutar(solicitud: SolicitudIA, sistema: string, usuario: string): Promise<string>;
  /** Adaptador para los consumidores existentes del contrato Generador. */
  generador(solicitud?: SolicitudIA): Generador;
}

export type { Generador, NombreProveedor, Proveedor };
