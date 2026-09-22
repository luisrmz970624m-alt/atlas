// Ciclo central de Atlas (V0.3)
//
//   recibir → planear → revisar → actuar → COMPROBAR → aprender → terminar
//
// Cambio importante respecto a V0.2: los pasos ya no son texto simulado.
// Cada paso nombra una herramienta real, con argumentos, y una verificación
// que se ejecuta contra el disco. Un paso "sin errores" que no pasa su
// verificación cuenta como fallo.

import { extraerJSON, RespuestaIncompleta, type Generador } from './modelo.ts';
import { evaluarPaso, registrar, LIMITES } from './supervisor.ts';
import { HERRAMIENTAS, existeHerramienta, catalogo, FueraDelLaboratorio } from './herramientas.ts';
import { comprobar, comprobarConjunto, describir, esVerificacionValida, type Verificacion } from './verificacion.ts';
import { estandarPara, archivosDeTexto } from './estandares.ts';
import type { Nivel } from './tipos.ts';

export interface Paso {
  n: number;
  descripcion: string;
  herramienta: string;
  argumentos: Record<string, unknown>;
  verificacion: Verificacion | null;
  nivel: Nivel;
  motivo: string;
}

export interface Plan {
  objetivo: string;
  version: number;
  criterio_final: string;
  pasos: Paso[];
}

export interface Problema {
  paso: number;
  queja: string;
}

export type RazonDeParada =
  | 'objetivo cumplido'
  | 'requiere aprobación'
  | 'plan inválido'
  | 'límite de acciones'
  | 'tres errores consecutivos'
  | 'estándar no cumplido';

export interface Resultado {
  plan: Plan;
  ejecutados: number;
  parada: RazonDeParada;
  detalle: string;
}

const SISTEMA = `Eres el planificador de Atlas, un asistente local supervisado.
Divides un objetivo en pasos que Atlas ejecuta con sus herramientas.

Herramientas disponibles (no existe ninguna otra):
${catalogo()}

Todas las rutas son relativas al laboratorio. Nunca uses rutas absolutas ni "..".

Verificaciones posibles (no existe ninguna otra):
- {"tipo":"existe","archivo":"x.md"}
- {"tipo":"min_bytes","archivo":"x.md","valor":200}
- {"tipo":"min_lineas","archivo":"x.md","valor":10}
- {"tipo":"contiene","archivo":"x.md","valor":"## Ejercicio"}

IMPORTANTE sobre min_lineas: solo se cuentan las líneas CON TEXTO. Las líneas
en blanco no cuentan, y en Markdown casi la mitad del archivo son líneas en
blanco. Si escribes un título, un párrafo y dos apartados, eso son unas 6
líneas contadas, no 12. Sé prudente con ese número: pon un valor que estés
seguro de superar, no el que te gustaría alcanzar.

Respondes SOLO con JSON, sin explicaciones alrededor:
{"criterio_final":"<señal observable de que el objetivo está cumplido>",
 "pasos":[{"descripcion":"<qué hace este paso>",
           "herramienta":"escribir_archivo",
           "argumentos":{"ruta":"leccion-01.md","contenido":"<texto completo>"},
           "verificacion":{"tipo":"min_bytes","archivo":"leccion-01.md","valor":200}}]}

Reglas que no puedes romper:
1. Entre 2 y 8 pasos. Cada paso usa UNA herramienta.
2. Los pasos los ejecuta ATLAS, no la persona. Nada de "abrir un editor",
   "iniciar un temporizador" o "tomar un descanso".
3. Cuando escribas un archivo, el contenido va COMPLETO en argumentos.contenido.
   No escribas marcadores como "<aquí el texto>".
4. La verificación de un paso se refiere al archivo que ese paso produce.
5. Nunca propongas instalar programas, usar sudo, acceder a Internet ni manejar dinero.
6. Cada archivo debe ser BREVE: como mucho unos 1200 caracteres de contenido.
   Si el material no cabe, repártelo en varios pasos.
7. La verificación de cada paso debe medir lo que ESE paso deja hecho, no la
   meta final. Un paso que añade un apartado corto no puede exigir 25 líneas.
8. escribir_archivo REEMPLAZA el archivo entero. Para ir añadiendo secciones a
   un mismo archivo usa escribir_archivo en el primer paso y agregar_archivo en
   los siguientes. Si usas escribir_archivo dos veces sobre la misma ruta, el
   segundo paso borra el trabajo del primero.`;

type DatosPaso = { descripcion?: string; herramienta?: string; argumentos?: Record<string, unknown>; verificacion?: unknown };
type DatosPlan = { criterio_final?: string; pasos?: DatosPaso[] };

function construir(objetivo: string, datos: DatosPlan, version: number): Plan {
  const pasos: Paso[] = (datos.pasos ?? []).map((p, i) => {
    const descripcion = String(p.descripcion ?? '').trim();
    const herramienta = String(p.herramienta ?? '').trim();
    const argumentos = (p.argumentos ?? {}) as Record<string, unknown>;

    // El Supervisor separa la acción del dato: las reglas de acción se aplican
    // a la descripción, la herramienta y la ruta; al contenido solo se le
    // buscan secretos. Ver supervisor.ts para por qué.
    const decision = evaluarPaso(descripcion, herramienta, argumentos);

    return {
      n: i + 1,
      descripcion,
      herramienta,
      argumentos,
      verificacion: esVerificacionValida(p.verificacion) ? p.verificacion : null,
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

/** Le dice al modelo, de antemano, con qué vara lo van a medir. */
export function instrucciones(objetivo: string): string {
  const estandar = estandarPara(objetivo);
  if (!estandar) return SISTEMA;
  const lista = estandar.exigir().map((e) => `- ${e.texto}`).join('\n');
  return `${SISTEMA}

Este objetivo se medirá además con el estándar "${estandar.tipo}": ${estandar.descripcion}
Al terminar se comprobará, sobre EL CONJUNTO de los archivos que produzcas:
${lista}
No puedes cambiar este estándar. Puedes repartir el material en varios archivos:
lo que se mide es el total, no cada archivo por separado.`;
}

export async function planear(objetivo: string, generar: Generador, version = 1): Promise<Plan> {
  const datos = await pedirPlan(objetivo, generar, `Objetivo: ${objetivo}`);
  return construir(objetivo, datos, version);
}

/**
 * Pide un plan y aguanta una respuesta cortada.
 * Un modelo local tiene un tope de salida; una lección larga lo alcanza.
 * En vez de reventar, se le pide lo mismo repartido en más pasos cortos.
 */
async function pedirPlan(objetivo: string, generar: Generador, peticion: string): Promise<DatosPlan> {
  try {
    const datos = extraerJSON(await generar(instrucciones(objetivo), peticion)) as DatosPlan;
    if (!Array.isArray(datos.pasos) || datos.pasos.length === 0) {
      throw new Error('El modelo no devolvió pasos utilizables.');
    }
    return datos;
  } catch (e) {
    if (!(e instanceof RespuestaIncompleta)) throw e;

    const datos = extraerJSON(await generar(
      instrucciones(objetivo),
      `${peticion}\n\nTu respuesta anterior se cortó por ser demasiado larga. Divide el trabajo en más pasos, cada uno con un archivo más corto, de modo que el JSON completo quepa.`,
    )) as DatosPlan;
    if (!Array.isArray(datos.pasos) || datos.pasos.length === 0) {
      throw new Error('El modelo no devolvió pasos utilizables ni al segundo intento.');
    }
    return datos;
  }
}

/** Revisa el plan ANTES de ejecutarlo. Ahora la revisión es objetiva. */
export function revisar(plan: Plan): Problema[] {
  const problemas: Problema[] = [];

  for (const paso of plan.pasos) {
    if (!paso.herramienta) {
      problemas.push({ paso: paso.n, queja: 'no nombra ninguna herramienta' });
    } else if (!existeHerramienta(paso.herramienta)) {
      problemas.push({ paso: paso.n, queja: `la herramienta "${paso.herramienta}" no existe` });
    }

    if (paso.verificacion === null) {
      problemas.push({ paso: paso.n, queja: 'no declara una verificación comprobable' });
    }

    if (paso.herramienta === 'escribir_archivo' || paso.herramienta === 'agregar_archivo') {
      const contenido = String(paso.argumentos.contenido ?? '');
      if (contenido.trim() === '') {
        problemas.push({ paso: paso.n, queja: 'escribe un archivo vacío' });
      } else if (/<[^>]*(aquí|aqui|texto|contenido|completar|todo)[^>]*>/i.test(contenido)) {
        problemas.push({ paso: paso.n, queja: 'el contenido es un marcador, no texto real' });
      } else if (contenido.length > 4000) {
        problemas.push({ paso: paso.n, queja: `el archivo es demasiado largo (${contenido.length} caracteres); repártelo en varios pasos` });
      }
    }
  }

  // Un paso que reemplaza lo que escribió otro destruye trabajo en silencio.
  const escritas = new Map<string, number>();
  for (const paso of plan.pasos) {
    if (paso.herramienta !== 'escribir_archivo') continue;
    const ruta = String(paso.argumentos.ruta ?? '');
    const antes = escritas.get(ruta);
    if (antes !== undefined) {
      problemas.push({
        paso: paso.n,
        queja: `reemplaza "${ruta}", que ya escribió el paso ${antes}; usa agregar_archivo para añadir`,
      });
    } else {
      escritas.set(ruta, paso.n);
    }
  }

  return problemas;
}

/** Planea, revisa, y si el plan es inválido pide una versión corregida. */
export async function planearConRevision(
  objetivo: string,
  generar: Generador,
  intentos = 2,
): Promise<{ plan: Plan; historial: Plan[]; problemas: Problema[] }> {
  const historial: Plan[] = [];
  let plan = await planear(objetivo, generar, 1);
  let problemas = revisar(plan);

  for (let v = 2; v <= intentos && problemas.length > 0; v++) {
    historial.push(plan);
    const queja = problemas.map((p) => `- paso ${p.paso}: ${p.queja}`).join('\n');
    let datos: DatosPlan;
    try {
      datos = await pedirPlan(objetivo, generar,
        `Objetivo: ${objetivo}\n\nTu plan anterior tuvo estos problemas:\n${queja}\n\nReescribe el plan completo corrigiéndolos.`);
    } catch { break; }
    plan = construir(objetivo, datos, v);
    problemas = revisar(plan);
  }

  return { plan, historial, problemas };
}

/**
 * El ciclo completo, con aprendizaje.
 *
 * Planea, ejecuta y comprueba. Si el trabajo no pasa el estándar, NO se rinde
 * ni finge: le devuelve al modelo exactamente qué faltó y lo intenta de nuevo
 * con un plan nuevo. Esto es el paso "aprender" del ciclo del documento
 * maestro, y es la diferencia entre un agente y un generador de texto.
 */
export async function perseguir(
  ruta: string,
  objetivo: string,
  generar: Generador,
  intentos = 2,
): Promise<{ resultado: Resultado; intentos: number }> {
  let quejas = '';

  for (let intento = 1; intento <= intentos; intento++) {
    const peticion = quejas
      ? `Objetivo: ${objetivo}\n\nTu intento anterior NO pasó el estándar de calidad:\n${quejas}\n\nRehaz el plan corrigiendo exactamente eso.`
      : `Objetivo: ${objetivo}`;

    const datos = await pedirPlan(objetivo, generar, peticion);
    let plan = construir(objetivo, datos, intento);

    // Si el plan en sí es inválido, primero se corrige el plan.
    const problemas = revisar(plan);
    if (problemas.length > 0 && intento < intentos) {
      const queja = problemas.map((p) => `- paso ${p.paso}: ${p.queja}`).join('\n');
      const corregido = await pedirPlan(objetivo, generar,
        `${peticion}\n\nAdemás, tu plan tuvo estos problemas:\n${queja}\n\nReescríbelo corrigiéndolos.`);
      plan = construir(objetivo, corregido, intento);
    }

    const resultado = ejecutar(ruta, plan);
    if (resultado.parada !== 'estándar no cumplido') {
      return { resultado, intentos: intento };
    }

    quejas = resultado.detalle.split('; ').map((q) => `- ${q}`).join('\n');

    // El último intento ya quedó registrado por ejecutar(); solo se anota el
    // reintento cuando de verdad va a haber uno.
    if (intento === intentos) return { resultado, intentos: intento };

    registrar(ruta, {
      tipo: 'decision',
      descripcion: `Intento ${intento} rechazado por el estándar. Reintentando.`,
      tarea: objetivo,
      plan: intento,
      salida: { quejas },
      veredicto: 'fallo',
      razon: resultado.detalle,
    });
  }

  throw new Error('inalcanzable');
}

/** Ejecuta el plan de verdad: herramienta → resultado → comprobación. */
export function ejecutar(ruta: string, plan: Plan): Resultado {
  registrar(ruta, {
    tipo: 'decision',
    descripcion: `Plan v${plan.version} para: ${plan.objetivo}`,
    tarea: plan.objetivo,
    plan: plan.version,
    entrada: { objetivo: plan.objetivo },
    salida: { pasos: plan.pasos.length, criterio_final: plan.criterio_final },
  });

  const problemas = revisar(plan);
  if (problemas.length > 0) {
    return parar(ruta, plan, 0, 'plan inválido',
      problemas.map((p) => `paso ${p.paso}: ${p.queja}`).join('; '));
  }

  let ejecutados = 0;
  let erroresSeguidos = 0;
  const producidos: string[] = [];

  for (const paso of plan.pasos) {
    if (ejecutados >= LIMITES.acciones_por_objetivo) {
      return parar(ruta, plan, ejecutados, 'límite de acciones',
        `Se alcanzaron ${LIMITES.acciones_por_objetivo} acciones. Hay que revisar el plan contigo.`);
    }

    if (paso.nivel !== 'verde') {
      return parar(ruta, plan, ejecutados, 'requiere aprobación',
        `Paso ${paso.n} (${paso.nivel}): ${paso.descripcion} — ${paso.motivo}`);
    }

    const inicio = Date.now();
    let salida: unknown;
    let error: string | null = null;

    try {
      salida = HERRAMIENTAS[paso.herramienta]!.ejecutar(paso.argumentos);
    } catch (e) {
      error = e instanceof FueraDelLaboratorio ? `RECHAZADO: ${e.message}` : (e as Error).message;
    }

    // Aquí está la regla: no basta con que no haya error.
    const prueba = error === null ? comprobar(paso.verificacion!) : { paso: false, evidencia: error };
    const ok = error === null && prueba.paso;

    registrar(ruta, {
      tipo: ok ? 'resultado' : 'error',
      nivel: 'verde',
      descripcion: `Paso ${paso.n}: ${paso.descripcion}`,
      tarea: plan.objetivo,
      plan: plan.version,
      entrada: { herramienta: paso.herramienta, argumentos: resumir(paso.argumentos) },
      salida: { resultado: salida ?? null, comprobacion: prueba },
      duracion_ms: Date.now() - inicio,
      veredicto: ok ? 'exito' : 'fallo',
      razon: prueba.evidencia,
    });

    if (ok) {
      ejecutados += 1;
      erroresSeguidos = 0;
      if (paso.herramienta === 'escribir_archivo') producidos.push(String(paso.argumentos.ruta ?? ''));
    } else {
      erroresSeguidos += 1;
      if (erroresSeguidos >= LIMITES.errores_consecutivos) {
        return parar(ruta, plan, ejecutados, 'tres errores consecutivos',
          'Tres fallos seguidos. Atlas se detiene en lugar de insistir.');
      }
    }
  }

  // El examen final: el estándar lo pone Atlas, no el plan.
  const fallos = aplicarEstandar(ruta, plan, producidos);
  if (fallos.length > 0) {
    return parar(ruta, plan, ejecutados, 'estándar no cumplido', fallos.join('; '));
  }

  return parar(ruta, plan, ejecutados, 'objetivo cumplido', plan.criterio_final);
}

/** Comprueba los estándares obligatorios sobre los archivos producidos. */
function aplicarEstandar(ruta: string, plan: Plan, producidos: string[]): string[] {
  const estandar = estandarPara(plan.objetivo);
  if (!estandar) return [];

  const archivos = archivosDeTexto(producidos);
  if (archivos.length === 0) return [];

  const fallos: string[] = [];
  for (const exigencia of estandar.exigir()) {
    const prueba = comprobarConjunto(exigencia.tipo, exigencia.valor, archivos);
    registrar(ruta, {
      tipo: prueba.paso ? 'resultado' : 'error',
      descripcion: `Estándar "${estandar.tipo}": ${exigencia.texto}`,
      tarea: plan.objetivo,
      plan: plan.version,
      entrada: { estandar: estandar.tipo, exigencia, archivos },
      salida: prueba,
      veredicto: prueba.paso ? 'exito' : 'fallo',
      razon: prueba.evidencia,
    });
    if (!prueba.paso) fallos.push(prueba.evidencia);
  }
  return fallos;
}

/** El registro guarda qué se hizo, no volcados enormes de contenido. */
function resumir(args: Record<string, unknown>): Record<string, unknown> {
  const copia: Record<string, unknown> = { ...args };
  if (typeof copia.contenido === 'string' && copia.contenido.length > 120) {
    copia.contenido = `${copia.contenido.slice(0, 120)}… (${copia.contenido.length} caracteres)`;
  }
  return copia;
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

export { describir };
