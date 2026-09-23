// Evaluación de ejercicios (V0.6)
//
// El problema: si el modelo es el único juez, volvemos a que alguien se pone su
// propia nota. Para código hay algo mejor que una opinión — ejecutarlo.
//
// Por eso la evaluación tiene DOS capas, y no valen lo mismo:
//
//   1. EJECUCIÓN: hecho comprobable. El código corre o no corre. Si revienta,
//      no hay discusión posible y el ejercicio no cuenta.
//   2. REVISIÓN DEL MODELO: opinión. Dice si la respuesta hace lo que pedía el
//      enunciado. Se guarda como deducción, nunca como hecho, y Luis puede
//      contradecirla.
//
// Un código que corre pero no resuelve el ejercicio no aprueba. Un código que
// resuelve el ejercicio pero no compila, tampoco. Hacen falta las dos.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extraerJSON, type Generador } from './modelo.ts';
import { rutaSegura, LABORATORIO } from './herramientas.ts';

/** Tiempo máximo que puede correr una respuesta. Un bucle infinito no cuelga a Atlas. */
export const LIMITE_MS = 10_000;

export interface Ejecucion {
  corrio: boolean;
  salida: string;
  error: string;
  ms: number;
}

/**
 * Saca el enunciado del ejercicio de una lección: todo lo que hay entre
 * "## Ejercicio" y el siguiente encabezado de nivel dos (o el final).
 *
 * A mano y no con una expresión regular: buscar "hasta el siguiente ## o el
 * final del texto" en una sola regex es justo el tipo de cosa que parece
 * funcionar y falla en silencio.
 */
export function enunciado(textoLeccion: string): string | null {
  const lineas = textoLeccion.split('\n');
  const inicio = lineas.findIndex((l) => /^##\s+Ejercicio/i.test(l));
  if (inicio === -1) return null;

  const resto = lineas.slice(inicio + 1);
  const fin = resto.findIndex((l) => /^##\s/.test(l));
  const cuerpo = (fin === -1 ? resto : resto.slice(0, fin)).join('\n').trim();
  return cuerpo.length > 0 ? cuerpo : null;
}

/**
 * Ejecuta la respuesta de Luis.
 *
 * Es SU código, en SU máquina, corriendo porque él lo pidió — no algo que Atlas
 * decidiera ejecutar por su cuenta. Aun así va con tope de tiempo y dentro del
 * laboratorio: un bucle infinito en un ejercicio no debe colgar nada.
 *
 * LÍMITES PRESENTES:
 * - Tope de tiempo: 10 segundos. Un bucle infinito no cuelga a Atlas.
 * - Cwd: laboratorio/. Eso sí lo bloquea.
 * - Variables de entorno: NO_COLOR y FORCE_COLOR activadas para salida predecible.
 *
 * LÍMITES NO GARANTIZADOS:
 * - Red: en un sandbox completo no la tendrías. Aquí, el código puede usarla.
 * - Filesystem: el código puede hacer require('node:fs') y escribir afuera del
 *   laboratorio. Las herramientas de Atlas usan rutaSegura(), pero código
 *   arbitrario no tiene por qué.
 * - Memoria, CPU, procesos: en Linux sin cgroups del sistema no se pueden
 *   limitar desde user-space.
 *
 * Por eso es importante:
 * 1. Un tema no desbloquea sin que lo practiques (no lo ejecutes a la ligera).
 * 2. Lees la lección ANTES de escribir código.
 * 3. El código es SU responsabilidad, no la mía.
 */
export function ejecutar(rutaRelativa: string): Ejecucion {
  const destino = rutaSegura(rutaRelativa);
  if (!existsSync(destino)) {
    return { corrio: false, salida: '', error: `No existe ${rutaRelativa}`, ms: 0 };
  }

  const inicio = Date.now();
  const r = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', destino],
    {
      cwd: LABORATORIO,
      timeout: LIMITE_MS,
      encoding: 'utf8',
      maxBuffer: 1024 * 256,
      // Sin color: si la terminal de Luis exporta FORCE_COLOR, console.log
      // envuelve los números en códigos de escape y la salida deja de ser
      // comparable. Lo que aquí importa es el texto, no cómo se ve.
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    },
  );
  const ms = Date.now() - inicio;

  if (r.error && (r.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
    return { corrio: false, salida: r.stdout ?? '', error: `Se pasó de ${LIMITE_MS / 1000} segundos. ¿Un bucle sin fin?`, ms };
  }

  return {
    corrio: r.status === 0,
    salida: limpiar(r.stdout).slice(0, 2000),
    error: limpiar(r.stderr).slice(0, 2000),
    ms,
  };
}

/** Quita códigos de color por si algo los cuela igualmente. */
function limpiar(texto: string | null | undefined): string {
  // eslint-disable-next-line no-control-regex
  return (texto ?? '').replace(/\u001B\[[0-9;]*m/g, '').trim();
}

export interface Revision {
  cumple: boolean;
  aciertos: string[];
  faltantes: string[];
  pista: string;
}

const SISTEMA = `Eres el profesor de Atlas revisando el ejercicio de un estudiante.

Respondes SOLO con JSON:
{"cumple": true|false,
 "aciertos": ["<qué resolvió bien>"],
 "faltantes": ["<qué pedía el enunciado y no está>"],
 "pista": "<una pista para el siguiente intento, sin dar la solución>"}

Reglas:
1. "cumple" es true solo si la respuesta hace TODO lo que pide el enunciado.
2. No inventes faltantes: si el enunciado no lo pedía, no es un fallo.
3. El estilo no es un faltante. Solo importa si resuelve lo pedido.
4. La pista ORIENTA, no resuelve. Nunca escribas la respuesta correcta.
5. Si la respuesta está bien, "faltantes" va vacío y la pista puede ser un
   comentario breve sobre cómo mejorarla.`;

export async function revisar(
  textoEnunciado: string,
  respuesta: string,
  ejecucion: Ejecucion,
  generar: Generador,
): Promise<Revision> {
  const estado = ejecucion.corrio
    ? `El código se ejecutó sin errores. Salida:\n${ejecucion.salida || '(sin salida)'}`
    : `El código NO se ejecutó correctamente. Error:\n${ejecucion.error}`;

  const bruto = await generar(SISTEMA, `Enunciado:\n${textoEnunciado}\n\nRespuesta del estudiante:\n${respuesta}\n\n${estado}`);
  const d = extraerJSON(bruto) as Partial<Revision>;

  return {
    cumple: d.cumple === true,
    aciertos: Array.isArray(d.aciertos) ? d.aciertos.map(String) : [],
    faltantes: Array.isArray(d.faltantes) ? d.faltantes.map(String) : [],
    pista: String(d.pista ?? '').trim(),
  };
}

export interface Resultado {
  aprobado: boolean;
  motivo: 'sin respuesta' | 'sin enunciado' | 'no ejecuta' | 'incompleto' | 'aprobado';
  ejecucion: Ejecucion | null;
  revision: Revision | null;
  detalle: string;
}

/**
 * Evalúa la respuesta a un ejercicio.
 * El veredicto es de Atlas, pero el hecho duro (¿corre?) manda sobre la opinión.
 */
export async function evaluar(
  rutaLeccion: string,
  rutaRespuesta: string,
  generar: Generador,
): Promise<Resultado> {
  const leccion = rutaSegura(rutaLeccion);
  const respuesta = rutaSegura(rutaRespuesta);

  if (!existsSync(respuesta)) {
    return { aprobado: false, motivo: 'sin respuesta', ejecucion: null, revision: null,
      detalle: `No existe ${rutaRespuesta}. Escribe ahí tu solución.` };
  }

  const textoEnunciado = existsSync(leccion) ? enunciado(readFileSync(leccion, 'utf8')) : null;
  if (!textoEnunciado) {
    return { aprobado: false, motivo: 'sin enunciado', ejecucion: null, revision: null,
      detalle: `No encontré una sección "## Ejercicio" en ${rutaLeccion}.` };
  }

  const texto = readFileSync(respuesta, 'utf8');
  const esCodigo = /\.(ts|js|mjs)$/i.test(rutaRespuesta);
  const ejecucion = esCodigo ? ejecutar(rutaRespuesta) : null;

  // Hecho duro: si el código no corre, no hay nada que opinar.
  if (ejecucion && !ejecucion.corrio) {
    const revision = await revisar(textoEnunciado, texto, ejecucion, generar);
    return { aprobado: false, motivo: 'no ejecuta', ejecucion, revision,
      detalle: ejecucion.error.split('\n').slice(0, 3).join('\n') };
  }

  const revision = await revisar(
    textoEnunciado, texto,
    ejecucion ?? { corrio: true, salida: '', error: '', ms: 0 },
    generar,
  );

  return revision.cumple
    ? { aprobado: true, motivo: 'aprobado', ejecucion, revision, detalle: revision.aciertos.join('; ') }
    : { aprobado: false, motivo: 'incompleto', ejecucion, revision, detalle: revision.faltantes.join('; ') };
}

/** Plantilla para que Luis empiece a responder. */
export function plantilla(id: string, textoEnunciado: string): string {
  const comentado = textoEnunciado.split('\n').map((l) => `// ${l}`).join('\n');
  return `// Respuesta al ejercicio de "${id}"
//
${comentado}
//
// Escribe tu solución abajo. Usa console.log para mostrar resultados:
// Atlas ejecuta este archivo y mira que no dé errores.

`;
}
