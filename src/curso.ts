// Profesor de programación (V0.6 de la ruta de versiones)
//
// Dos ideas que sostienen este archivo:
//
// 1. GENERAR UNA LECCIÓN NO ES APRENDERLA. Atlas puede escribir material
//    perfecto y Luis no haber leído una línea. Por eso hay dos estados
//    distintos: "material" (Atlas hizo la lección) y "practicado" (Luis hizo
//    el ejercicio y lo dijo). Solo el segundo cuenta como avance.
//
// 2. DOMINAR NO ES HABER PRACTICADO UNA VEZ. El documento maestro pide varias
//    demostraciones, separadas en el tiempo. Aquí son dos prácticas con al
//    menos un día de diferencia: eso distingue "lo entendí en el momento" de
//    "me quedó".

import { Memoria, type Recuerdo } from './memoria.ts';

export interface Tema {
  id: string;
  titulo: string;
  nivel: 1 | 2 | 3;
  requiere: string[];
  /**
   * Cómo pedir la lección de este tema.
   *
   * Importa más de lo que parece: pedir "una lección de TypeScript sobre la
   * terminal" empujaba al modelo a hablar de instalar y compilar, porque es lo
   * que asocia a "TypeScript" más "terminal". Enmarcar cada tema por lo que el
   * estudiante va a HACER evita ese desvío desde el principio.
   */
  objetivo: string;
}

/** Ruta de programación del documento maestro, de archivos y lógica a Atlas. */
export const TEMARIO: Tema[] = [
  { id: 'terminal', titulo: 'la terminal y el sistema de archivos', nivel: 1, requiere: [],
    objetivo: 'crear una lección sobre navegar en la terminal: cd, ls, pwd, mkdir, cat, y entender rutas relativas y absolutas' },
  { id: 'filesystem', titulo: 'archivos desde código TypeScript', nivel: 1, requiere: ['terminal'],
    objetivo: 'crear una lección sobre leer y escribir archivos desde TypeScript usando mkdirSync, writeFileSync, readFileSync y readdirSync del módulo node:fs' },
  { id: 'variables', titulo: 'variables y tipos básicos', nivel: 1, requiere: [],
    objetivo: 'crear una lección sobre declarar variables con const y let y darles tipo: number, string, boolean' },
  { id: 'condiciones', titulo: 'condiciones y comparaciones', nivel: 1, requiere: ['variables'],
    objetivo: 'crear una lección sobre if, else y los operadores de comparación' },
  { id: 'bucles', titulo: 'bucles y repetición', nivel: 1, requiere: ['condiciones'],
    objetivo: 'crear una lección sobre repetir código con for y while' },
  { id: 'funciones', titulo: 'funciones', nivel: 1, requiere: ['variables'],
    objetivo: 'crear una lección sobre escribir funciones con parámetros tipados y valor de retorno' },
  { id: 'arrays', titulo: 'arrays y sus métodos', nivel: 2, requiere: ['bucles', 'funciones'],
    objetivo: 'crear una lección sobre listas: crear un array, recorrerlo y usar map, filter y find' },
  { id: 'objetos', titulo: 'objetos e interfaces', nivel: 2, requiere: ['arrays'],
    objetivo: 'crear una lección sobre agrupar datos en objetos y describir su forma con interface' },
  { id: 'modulos', titulo: 'módulos: importar y exportar', nivel: 2, requiere: ['funciones'],
    objetivo: 'crear una lección sobre repartir código en varios archivos con export e import' },
  { id: 'errores', titulo: 'errores y excepciones', nivel: 2, requiere: ['funciones'],
    objetivo: 'crear una lección sobre lanzar errores con throw y atraparlos con try/catch' },
  { id: 'asincronia', titulo: 'asincronía: promesas y async/await', nivel: 2, requiere: ['funciones', 'errores'],
    objetivo: 'crear una lección sobre esperar resultados que tardan, con async y await' },
  { id: 'archivos-avanzado', titulo: 'leer y escribir archivos avanzado', nivel: 2, requiere: ['modulos', 'asincronia'],
    objetivo: 'crear una lección sobre leer y escribir archivos de forma asincrónica, manejo de errores y flujos con el módulo node:fs/promises' },
  { id: 'pruebas', titulo: 'escribir pruebas automáticas', nivel: 3, requiere: ['modulos', 'errores'],
    objetivo: 'crear una lección sobre escribir pruebas con node:test y node:assert' },
  { id: 'sqlite', titulo: 'guardar datos con SQLite', nivel: 3, requiere: ['archivos-avanzado', 'objetos'],
    objetivo: 'crear una lección sobre guardar y consultar datos con el módulo node:sqlite' },
  { id: 'atlas', titulo: 'leer y modificar el código de Atlas', nivel: 3, requiere: ['pruebas', 'sqlite'],
    objetivo: 'crear una lección sobre leer el código de un proyecto real, entender sus módulos y cambiar algo con seguridad' },
];

export function tema(id: string): Tema | null {
  return TEMARIO.find((t) => t.id === id) ?? null;
}

export type EstadoTema = 'pendiente' | 'material' | 'practicado' | 'dominado';

export interface Avance {
  estado: EstadoTema;
  /** Fechas (YYYY-MM-DD) en que Luis practicó. Solo prácticas, no material. */
  practicas: string[];
  /** Próximo repaso programado, en YYYY-MM-DD. */
  repaso: string | null;
  archivos: string[];
}

const VACIO: Avance = { estado: 'pendiente', practicas: [], repaso: null, archivos: [] };

/** Repasos espaciados del documento maestro: 1, 3, 7, 14 y 30 días. */
export const ESPACIADO = [1, 3, 7, 14, 30];

export function hoy(fecha = new Date()): string {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function avanceDe(m: Memoria, id: string): Avance {
  const r: Recuerdo | undefined = m.consultar({ espacio: 'programacion', clave: `tema:${id}` })[0];
  return Memoria.datosDe<Avance>(r ?? null) ?? { ...VACIO };
}

function guardar(m: Memoria, id: string, avance: Avance, resumen: string): void {
  m.recordar({
    espacio: 'programacion',
    clave: `tema:${id}`,
    resumen,
    fuente: 'curso',
    datos: avance,
  });
}

/** Atlas generó el material. Esto NO es avance de Luis: es material disponible. */
export function registrarMaterial(m: Memoria, id: string, archivos: string[]): Avance {
  const previo = avanceDe(m, id);
  const avance: Avance = {
    ...previo,
    estado: previo.estado === 'pendiente' ? 'material' : previo.estado,
    archivos: [...new Set([...previo.archivos, ...archivos])],
  };
  guardar(m, id, avance, `material creado (${avance.archivos.join(', ')})`);
  return avance;
}

/**
 * Luis practicó. Esto sí es avance.
 * El tema pasa a "dominado" con dos prácticas separadas por al menos un día.
 */
export function registrarPractica(m: Memoria, id: string, dia = hoy()): Avance {
  const previo = avanceDe(m, id);
  const practicas = [...new Set([...previo.practicas, dia])].sort();

  const separadas = practicas.length >= 2 && practicas[practicas.length - 1] !== practicas[0];
  const estado: EstadoTema = separadas ? 'dominado' : 'practicado';

  const vuelta = Math.min(practicas.length - 1, ESPACIADO.length - 1);
  const avance: Avance = { ...previo, estado, practicas, repaso: sumarDias(dia, ESPACIADO[vuelta]!) };

  guardar(m, id, avance,
    `${estado}; ${practicas.length} práctica(s); repaso el ${avance.repaso}`);
  return avance;
}

/** Temas cuyo repaso ya venció. Son lo primero que toca, antes que material nuevo. */
export function repasosPendientes(m: Memoria, dia = hoy()): { tema: Tema; avance: Avance }[] {
  return TEMARIO
    .map((t) => ({ tema: t, avance: avanceDe(m, t.id) }))
    .filter(({ avance }) => avance.repaso !== null && avance.repaso <= dia)
    .sort((a, b) => (a.avance.repaso! < b.avance.repaso! ? -1 : 1));
}

/** Un tema está disponible si todos sus requisitos están practicados o dominados. */
export function disponible(m: Memoria, t: Tema): boolean {
  return t.requiere.every((r) => ['practicado', 'dominado'].includes(avanceDe(m, r).estado));
}

export interface Siguiente {
  tema: Tema;
  motivo: 'repaso' | 'continuar' | 'nuevo';
  avance: Avance;
}

/**
 * Qué toca ahora. El orden importa:
 *   1. un repaso vencido — lo ya aprendido se pierde si no se refresca
 *   2. un tema con material pero sin practicar — terminar lo empezado
 *   3. el siguiente tema nuevo cuyos requisitos estén cubiertos
 */
export function siguiente(m: Memoria, dia = hoy()): Siguiente | null {
  const vencidos = repasosPendientes(m, dia);
  if (vencidos.length > 0) {
    return { tema: vencidos[0]!.tema, motivo: 'repaso', avance: vencidos[0]!.avance };
  }

  for (const t of TEMARIO) {
    const a = avanceDe(m, t.id);
    if (a.estado === 'material') return { tema: t, motivo: 'continuar', avance: a };
  }

  for (const t of TEMARIO) {
    const a = avanceDe(m, t.id);
    if (a.estado === 'pendiente' && disponible(m, t)) {
      return { tema: t, motivo: 'nuevo', avance: a };
    }
  }

  return null;
}

export interface Progreso {
  temas: { tema: Tema; avance: Avance }[];
  dominados: number;
  practicados: number;
  conMaterial: number;
  pendientes: number;
  repasosHoy: number;
}

export function progreso(m: Memoria, dia = hoy()): Progreso {
  const temas = TEMARIO.map((t) => ({ tema: t, avance: avanceDe(m, t.id) }));
  const cuenta = (e: EstadoTema) => temas.filter((x) => x.avance.estado === e).length;

  return {
    temas,
    dominados: cuenta('dominado'),
    practicados: cuenta('practicado'),
    conMaterial: cuenta('material'),
    pendientes: cuenta('pendiente'),
    repasosHoy: repasosPendientes(m, dia).length,
  };
}
