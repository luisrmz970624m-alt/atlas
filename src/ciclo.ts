// Ciclo central de Atlas (V0.2)
//
//   recibir → comprender → planear → revisar seguridad → actuar → observar →
//   verificar → aprender → terminar
//
// Reglas del documento maestro que este archivo hace cumplir:
//   - una acción a la vez
//   - el plan tiene versión, y no se reescribe en silencio
//   - los pasos amarillos y rojos NO se ejecutan sin aprobación
//   - se detiene al alcanzar el límite de acciones o tras 3 errores seguidos
//   - en V0.1/V0.2 los pasos son SIMULADOS: se registran, no se ejecutan

import { extraerJSON, type Generador } from './modelo.ts';
import { evaluar, registrar, LIMITES } from './supervisor.ts';
import type { Nivel } from './tipos.ts';

export interface Paso {
  n: number;
  descripcion: string;
  verificacion: string;   // cómo sabremos que salió bien
  nivel: Nivel;
  motivo: string;
}

export interface Plan {
  objetivo: string;
  version: number;
  criterio_final: string;
  pasos: Paso[];
}

export type RazonDeParada =
  | 'objetivo cumplido'
  | 'requiere aprobación'
  | 'límite de acciones'
  | 'tres errores consecutivos';

export interface Resultado {
  plan: Plan;
  ejecutados: number;
  parada: RazonDeParada;
  detalle: string;
}

const SISTEMA = `Eres el planificador de Atlas, un asistente local supervisado.
Divides un objetivo en pasos pequeños y verificables.
Respondes SOLO con JSON, sin explicaciones alrededor, con esta forma exacta:
{"criterio_final":"<cómo sabremos que el objetivo está cumplido>",
 "pasos":[{"descripcion":"<una sola acción>","verificacion":"<cómo comprobarla>"}]}
Entre 3 y 8 pasos. Cada paso es UNA acción, no varias.
Nunca propongas instalar programas, usar sudo, acceder a Internet ni manejar dinero.`;

/** Pide un plan al modelo y le asigna nivel de seguridad a cada paso. */
export async function planear(objetivo: string, generar: Generador, version = 1): Promise<Plan> {
  const bruto = await generar(SISTEMA, `Objetivo: ${objetivo}`);
  const datos = extraerJSON(bruto) as { criterio_final?: string; pasos?: { descripcion?: string; verificacion?: string }[] };

  if (!Array.isArray(datos.pasos) || datos.pasos.length === 0) {
    throw new Error('El modelo no devolvió pasos utilizables.');
  }

  const pasos: Paso[] = datos.pasos.map((p, i) => {
    const descripcion = String(p.descripcion ?? '').trim();
    const decision = evaluar(descripcion);
    return {
      n: i + 1,
      descripcion,
      verificacion: String(p.verificacion ?? 'sin criterio declarado').trim(),
      nivel: decision.nivel,
      motivo: decision.motivo,
    };
  });

  return {
    objetivo,
    version,
    criterio_final: String(datos.criterio_final ?? 'sin criterio declarado').trim(),
    pasos,
  };
}

/**
 * Recorre el plan paso a paso. En V0.2 la ejecución es simulada:
 * cada paso verde se anota como hecho en el laboratorio.
 * Los amarillos y rojos detienen el ciclo y esperan a Luis.
 */
export function ejecutar(ruta: string, plan: Plan): Resultado {
  registrar(ruta, {
    tipo: 'decision',
    descripcion: `Plan v${plan.version} para: ${plan.objetivo}`,
    tarea: plan.objetivo,
    plan: plan.version,
    entrada: { objetivo: plan.objetivo },
    salida: { pasos: plan.pasos.length, criterio_final: plan.criterio_final },
  });

  let ejecutados = 0;
  let erroresSeguidos = 0;

  for (const paso of plan.pasos) {
    if (ejecutados >= LIMITES.acciones_por_objetivo) {
      return parar(ruta, plan, ejecutados, 'límite de acciones',
        `Se alcanzaron ${LIMITES.acciones_por_objetivo} acciones. Hay que revisar el plan contigo antes de seguir.`);
    }

    if (paso.nivel !== 'verde') {
      return parar(ruta, plan, ejecutados, 'requiere aprobación',
        `Paso ${paso.n} (${paso.nivel}): ${paso.descripcion} — ${paso.motivo}`);
    }

    const inicio = Date.now();
    const ok = simular(paso);

    registrar(ruta, {
      tipo: ok ? 'resultado' : 'error',
      nivel: 'verde',
      descripcion: `Paso ${paso.n}: ${paso.descripcion}`,
      tarea: plan.objetivo,
      plan: plan.version,
      entrada: { paso: paso.n },
      salida: { simulado: true, verificacion: paso.verificacion },
      duracion_ms: Date.now() - inicio,
      veredicto: ok ? 'exito' : 'fallo',
      razon: ok ? paso.verificacion : 'El paso no declaró forma de verificarse.',
    });

    if (ok) {
      ejecutados += 1;
      erroresSeguidos = 0;
    } else {
      erroresSeguidos += 1;
      if (erroresSeguidos >= LIMITES.errores_consecutivos) {
        return parar(ruta, plan, ejecutados, 'tres errores consecutivos',
          'Tres fallos seguidos. Atlas se detiene en lugar de insistir.');
      }
    }
  }

  return parar(ruta, plan, ejecutados, 'objetivo cumplido', plan.criterio_final);
}

/**
 * Simulación de un paso. En V0.2 no se ejecuta nada real.
 * Un paso sin criterio de verificación se considera fallido: un paso que no
 * se puede comprobar no sirve, aunque "no dé error".
 */
function simular(paso: Paso): boolean {
  return paso.verificacion.length > 0 && paso.verificacion !== 'sin criterio declarado';
}

function parar(ruta: string, plan: Plan, ejecutados: number, parada: RazonDeParada, detalle: string): Resultado {
  registrar(ruta, {
    tipo: 'detencion',
    descripcion: `Ciclo detenido: ${parada}`,
    tarea: plan.objetivo,
    plan: plan.version,
    salida: { parada, ejecutados, detalle },
    veredicto: parada === 'objetivo cumplido' ? 'exito' : 'indeterminado',
    razon: detalle,
  });
  return { plan, ejecutados, parada, detalle };
}
