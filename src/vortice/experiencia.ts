import type { Memoria } from '../memoria.ts';

export type EstadoExperiencia = 'provisional' | 'validada' | 'descartada';
export interface NuevaExperiencia {
  dominio: string; hipotesis: string; evidencia: string; resultado: string;
  reglas_cumplidas: string[]; reglas_rotas: string[]; confianza: number; fuente: string;
  estado?: EstadoExperiencia;
}
export interface Experiencia extends NuevaExperiencia { id: number; fecha: string; estado: EstadoExperiencia; }

/** Una ganancia aislada permanece provisional: validar exige evidencia externa. */
/** Invariante compartida: la persistencia también la aplica. */
export function estadoSeguro(e: NuevaExperiencia): EstadoExperiencia {
  if (e.estado === 'descartada') return 'descartada';
  return e.estado === 'validada' && e.evidencia.trim().length > 0 && !/ganancia aislada/i.test(e.evidencia) ? 'validada' : 'provisional';
}

export function guardarExperiencia(memoria: Memoria, experiencia: NuevaExperiencia): Experiencia {
  return memoria.guardarExperiencia({ ...experiencia, estado: estadoSeguro(experiencia) });
}

export function recuperarEvidencia(memoria: Memoria, dominio: string, texto: string, maximo = 3): Experiencia[] {
  return memoria.buscarExperiencias({ dominio, texto, maximo });
}
