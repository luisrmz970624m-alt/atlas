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

/**
 * Lo único que se busca DENTRO del contenido de un archivo.
 *
 * Distinción clave: una cosa es la ACCIÓN que Atlas quiere hacer y otra el
 * DATO que va a escribir. Una lección sobre cadenas contiene la palabra
 * "mensaje" en un ejemplo de código; eso no es enviar un mensaje. Aplicar las
 * reglas de acción al contenido producía falsos positivos que paraban trabajo
 * legítimo — y un Supervisor que se dispara solo acaba ignorándose.
 *
 * En el contenido solo importan los secretos: nunca deben escribirse a disco.
 */
const SECRETOS = [
  /\b(contraseña|password|passwd)\b/i,
  /\b(api[-_ ]?key|token|secret|credencial)\b/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
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

/** Argumentos que describen la acción, frente a los que son carga útil. */
const CARGA_UTIL = new Set(['contenido']);

/**
 * Clasifica un paso completo: la acción por un lado, el contenido por otro.
 * Es lo que usa el ciclo; `evaluar` queda para acciones sueltas en texto.
 */
export function evaluarPaso(
  descripcion: string,
  herramienta: string,
  argumentos: Record<string, unknown>,
): Decision {
  const accion = Object.entries(argumentos)
    .filter(([clave]) => !CARGA_UTIL.has(clave))
    .map(([clave, valor]) => `${clave}=${String(valor)}`)
    .join(' ');

  const decision = evaluar(`${descripcion} ${herramienta} ${accion}`);
  if (decision.nivel !== 'verde') return decision;

  for (const [clave, valor] of Object.entries(argumentos)) {
    if (!CARGA_UTIL.has(clave)) continue;
    const texto = String(valor);
    for (const patron of SECRETOS) {
      if (patron.test(texto)) {
        return { nivel: 'rojo', permitido: false, motivo: `El contenido parece incluir un secreto: ${patron}` };
      }
    }
  }

  return decision;
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
