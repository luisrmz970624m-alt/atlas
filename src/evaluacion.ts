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
import { existsSync } from 'node:fs';
import { extraerJSON, type Generador } from './modelo.ts';
import {
  conLaboratorioAnclado,
  existeArchivoSeguro,
  leerArchivoSeguro,
  rutaSegura,
  LABORATORIO,
} from './herramientas.ts';

/** Tiempo máximo que puede correr una respuesta. Un bucle infinito no cuelga a Atlas. */
export const LIMITE_MS = 10_000;
const LIMITE_SANDBOX_MS = 3_000;
const RUTAS_RUNTIME = ['/usr', '/lib', '/lib64'];
const PROPIEDADES_CGROUP = [
  '--property=MemoryMax=512M',
  '--property=MemorySwapMax=0',
  '--property=CPUQuota=100%',
  '--property=TasksMax=32',
];

function entornoSystemd(): NodeJS.ProcessEnv {
  const entorno: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '/usr/bin:/bin' };
  for (const nombre of ['XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS'] as const) {
    const valor = process.env[nombre];
    if (valor) entorno[nombre] = valor;
  }
  return entorno;
}

export interface DisponibilidadSandbox {
  disponible: boolean;
  motivo: string;
}

function argumentosSandbox(argumentosNode: string[], raizLaboratorio = rutaSegura('.')): string[] {
  const archivo = argumentosNode.at(-1);
  const args = [
    '--unshare-all',
    '--die-with-parent',
    '--new-session',
    '--ro-bind', '/usr', '/usr',
    '--dir', '/runtime',
    '--ro-bind', process.execPath, '/runtime/node',
    '--dir', '/workspace',
    '--bind', raizLaboratorio, '/workspace',
  ];

  for (const ruta of RUTAS_RUNTIME.slice(1)) {
    if (existsSync(ruta)) args.push('--ro-bind', ruta, ruta);
  }

  args.push(
    '--dev', '/dev',
    '--proc', '/proc',
    '--tmpfs', '/tmp',
    '--chdir', '/workspace',
    '--clearenv',
    '--setenv', 'PATH', '/usr/bin:/bin',
    '--setenv', 'HOME', '/workspace',
    '--setenv', 'TMPDIR', '/tmp',
    '--setenv', 'NO_COLOR', '1',
    '--setenv', 'FORCE_COLOR', '0',
    '--',
    '/runtime/node',
    ...argumentosNode.slice(0, -1),
    archivo ?? '',
  );

  return args;
}

export function comprobarSandbox(): DisponibilidadSandbox {
  if (process.platform !== 'linux') {
    return { disponible: false, motivo: 'La ejecución de ejercicios requiere Linux, Bubblewrap y límites cgroup.' };
  }

  const prueba = spawnSync('systemd-run', [
    '--user',
    '--scope',
    '--quiet',
    ...PROPIEDADES_CGROUP,
    '--',
    'bwrap',
    ...argumentosSandbox(['-e', 'process.exit(0)']),
  ], {
    timeout: LIMITE_SANDBOX_MS,
    encoding: 'utf8',
    maxBuffer: 16 * 1024,
    env: entornoSystemd(),
  });

  if (prueba.error) {
    const detalle = (prueba.error as NodeJS.ErrnoException).code === 'ENOENT'
      ? 'systemd-run o Bubblewrap no está instalado o no está disponible en PATH.'
      : `No se pudo iniciar la ejecución limitada: ${prueba.error.message}`;
    return { disponible: false, motivo: detalle };
  }
  if (prueba.status !== 0) {
    const detalle = (prueba.stderr || prueba.stdout || 'systemd-run o Bubblewrap rechazó la configuración.').trim();
    return { disponible: false, motivo: `El sandbox con límites de recursos no está disponible: ${detalle}` };
  }

  return { disponible: true, motivo: '' };
}

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
 * Ejecuta una respuesta dentro de un sandbox Linux de Bubblewrap.
 *
 * LÍMITES PRESENTES:
 * - Red y espacios de procesos/nombres aislados mediante Bubblewrap.
 * - Solo son visibles el runtime de Node en solo lectura y el laboratorio.
 * - El laboratorio es el único montaje escribible; /tmp es efímero.
 * - Variables de entorno limpiadas; solo el cliente systemd recibe la conexión local al gestor.
 * - Tope de tiempo de 10 segundos para la evaluación.
 * - Cgroup de systemd: 512 MiB de memoria sin swap, 100 % de CPU y 32 tareas.
 *
 * LÍMITES NO GARANTIZADOS:
 * - No es un sustituto de un sandbox administrado para código hostil.
 */
export function ejecutar(rutaRelativa: string): Ejecucion {
  let codigo: string;
  try {
    codigo = leerArchivoSeguro(rutaRelativa);
  } catch (error) {
    if (error instanceof Error && 'code' in error && String(error.code) === 'ENOENT') {
      return { corrio: false, salida: '', error: `No existe ${rutaRelativa}`, ms: 0 };
    }
    throw error;
  }

  const sandbox = comprobarSandbox();
  if (!sandbox.disponible) {
    return { corrio: false, salida: '', error: sandbox.motivo, ms: 0 };
  }

  const inicio = Date.now();
  // Node lee el snapshot por stdin; no vuelve a resolver la ruta de respuesta.
  const r = conLaboratorioAnclado((descriptor) => spawnSync(
    'systemd-run',
    [
      '--user',
      '--scope',
      '--quiet',
      ...PROPIEDADES_CGROUP,
      '--',
      'bwrap',
      ...argumentosSandbox(
        ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', '-'],
        '/proc/self/fd/3',
      ),
    ],
    {
      cwd: '/',
      timeout: LIMITE_MS,
      encoding: 'utf8',
      maxBuffer: 1024 * 256,
      input: codigo,
      stdio: ['pipe', 'pipe', 'pipe', descriptor],
      env: entornoSystemd(),
    }));
  const ms = Date.now() - inicio;

  if (r.error instanceof Error && 'code' in r.error && String(r.error.code) === 'ETIMEDOUT') {
    return { corrio: false, salida: r.stdout ?? '', error: `Se pasó de ${LIMITE_MS / 1000} segundos. ¿Un bucle sin fin?`, ms };
  }
  if (r.error) {
    return { corrio: false, salida: limpiar(r.stdout), error: `No se pudo ejecutar el sandbox: ${r.error.message}`, ms };
  }

  return {
    corrio: r.status === 0,
    salida: limpiar(r.stdout).slice(0, 2000),
    error: limpiar(r.stderr).slice(0, 2000)
      || (r.status === 0
        ? ''
        : `La ejecución terminó sin éxito (código ${r.status ?? 'desconocido'}${r.signal ? `, señal ${r.signal}` : ''}).`),
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
  if (!existeArchivoSeguro(rutaRespuesta)) {
    return { aprobado: false, motivo: 'sin respuesta', ejecucion: null, revision: null,
      detalle: `No existe ${rutaRespuesta}. Escribe ahí tu solución.` };
  }

  const textoEnunciado = existeArchivoSeguro(rutaLeccion) ? enunciado(leerArchivoSeguro(rutaLeccion)) : null;
  if (!textoEnunciado) {
    return { aprobado: false, motivo: 'sin enunciado', ejecucion: null, revision: null,
      detalle: `No encontré una sección "## Ejercicio" en ${rutaLeccion}.` };
  }

  const texto = leerArchivoSeguro(rutaRespuesta);
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
