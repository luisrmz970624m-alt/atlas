// Supervisor de Atlas V0.1
//
// Es la ÚNICA puerta hacia el registro. El agente nunca escribe directo.
// Decide el nivel de cada acción y aplica los límites.

import { agregar } from './registro.ts';
import type { Evento, Nivel, TipoEvento, Veredicto } from './tipos.ts';

/** Límites iniciales de V0.1 (documento maestro, Módulo A). */
export const LIMITES = {
  tareas_activas: 1,
  acciones_por_objetivo: 20,
  minutos_por_tarea: 30,
  presupuesto_real: 0,
  errores_consecutivos: 3,
  internet_en_laboratorio: false,
} as const;

/** Acciones prohibidas sin excepción. */
const ROJO = [
  /\bsudo\b/,
  /\brm\s+-rf\b/,
  /\bmkfs\b/,
  /clave|contraseña|password|token|secret/i,
  /transferir|wallet|criptomoneda/i,
];

/** Acciones que requieren aprobación de Luis. */
const AMARILLO = [
  /\binstalar\b|\bapt\b|\bnpm install\b|\bpip install\b/,
  /\bcurl\b|\bwget\b|internet|http/i,
  /\benviar\b|\bpublicar\b|\bcorreo\b|\bmensaje\b/i,
  /\bescribir fuera\b|\/etc\/|\/usr\/|\$HOME(?!\/atlas)/,
];

export interface Decision {
  nivel: Nivel;
  permitido: boolean;
  motivo: string;
}

/** Clasifica una acción descrita en texto. En V0.1 basta con reglas simples. */
export function evaluar(accion: string): Decision {
  for (const patron of ROJO) {
    if (patron.test(accion)) {
      return { nivel: 'rojo', permitido: false, motivo: `Coincide con una regla prohibida: ${patron}` };
    }
  }
  for (const patron of AMARILLO) {
    if (patron.test(accion)) {
      return { nivel: 'amarillo', permitido: false, motivo: `Requiere aprobación humana: ${patron}` };
    }
  }
  return { nivel: 'verde', permitido: true, motivo: 'Dentro del laboratorio.' };
}

export interface DatosEvento {
  tipo: TipoEvento;
  descripcion: string;
  nivel?: Nivel;
  tarea?: string | null;
  plan?: number | null;
  entrada?: unknown;
  salida?: unknown;
  duracion_ms?: number | null;
  veredicto?: Veredicto | null;
  razon?: string | null;
}

/**
 * Registra un evento. Todo lo que Atlas hace pasa por aquí.
 * El Supervisor es quien pone la huella, no el agente.
 */
export function registrar(ruta: string, datos: DatosEvento): Evento {
  return agregar(ruta, {
    tipo: datos.tipo,
    nivel: datos.nivel ?? 'verde',
    descripcion: datos.descripcion,
    tarea: datos.tarea ?? null,
    plan: datos.plan ?? null,
    entrada: datos.entrada ?? null,
    salida: datos.salida ?? null,
    duracion_ms: datos.duracion_ms ?? null,
    veredicto: datos.veredicto ?? null,
    razon: datos.razon ?? null,
  });
}

/**
 * Pide permiso para una acción y deja constancia tanto si se concede
 * como si se niega. Un "no" también es parte del historial.
 */
export function pedirPermiso(ruta: string, accion: string, tarea: string | null = null): Decision {
  const decision = evaluar(accion);
  registrar(ruta, {
    tipo: 'aprobacion',
    nivel: decision.nivel,
    descripcion: `Permiso solicitado: ${accion}`,
    tarea,
    entrada: { accion },
    salida: decision,
    veredicto: decision.permitido ? 'exito' : 'fallo',
    razon: decision.motivo,
  });
  return decision;
}
