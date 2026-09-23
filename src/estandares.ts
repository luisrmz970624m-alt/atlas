// Estándares de calidad (Módulo E del documento maestro)
//
// El problema que resuelve este archivo:
// si el planificador elige sus propias verificaciones, siempre aprueba.
// Pide "mínimo 200 bytes", escribe 210 bytes de índice sin ejemplos, y declara
// el objetivo cumplido.
//
// Por eso los estándares NO los negocia el modelo. Los pone Atlas, según el
// tipo de trabajo, y se comprueban al final, encima de lo que el plan pidió.

import type { TipoVerificacion } from './verificacion.ts';

/** Exigencia del estándar: se mide sobre el conjunto de archivos, no sobre uno. */
export interface Exigencia {
  tipo: TipoVerificacion;
  valor?: string | number;
  texto: string;
}

export interface Estandar {
  tipo: string;
  descripcion: string;
  /** Palabras que identifican este tipo de objetivo. */
  senales: RegExp;
  /** Exigencias obligatorias, medidas sobre TODO el material producido. */
  exigir(): Exigencia[];
}

export const ESTANDARES: Estandar[] = [
  {
    tipo: 'leccion-terminal',
    descripcion: [
      'Una lección sobre la terminal debe explicar comandos, mostrar ejemplos y pedir práctica.',
      'El estudiante responde ejecutando comandos en su terminal real.',
      'El ejercicio va al final y NO lleva la solución: plantear y resolver a la vez lo anula.',
    ].join(' '),
    senales: /\bterminal\b|\b(?:cd|ls|pwd|mkdir|cat|shell|bash)\b/i,
    exigir: () => [
      { tipo: 'min_lineas', valor: 20, texto: 'el material suma al menos 20 líneas' },
      { tipo: 'contiene', valor: '```', texto: 'hay ejemplos mostrando comandos' },
      { tipo: 'contiene', valor: '## Ejercicio', texto: 'hay una sección "## Ejercicio"' },
      { tipo: 'sin_solucion', texto: 'el ejercicio no viene resuelto' },
    ],
  },
  {
    tipo: 'leccion',
    descripcion: [
      'Una lección debe explicar, mostrar código y pedir práctica.',
      'El estudiante ejecuta TypeScript directamente con `node --experimental-strip-types archivo.ts`:',
      'NO uses tsc, no le digas que compile, no le digas que instale nada.',
      'El ejercicio va al final y NO lleva la solución: plantear y resolver a la vez lo anula.',
    ].join(' '),
    senales: /\blecci[oó]n|\bense[ñn]|\btutorial|\bexplica|\bcurso\b/i,
    exigir: () => [
      { tipo: 'min_lineas', valor: 20, texto: 'el material suma al menos 20 líneas' },
      { tipo: 'contiene', valor: '```', texto: 'hay al menos un ejemplo de código' },
      { tipo: 'contiene', valor: '## Ejercicio', texto: 'hay una sección "## Ejercicio"' },
      { tipo: 'sin_solucion', texto: 'el ejercicio no viene resuelto' },
      // El estudiante corre TypeScript directo con node. Enseñarle a compilar
      // con tsc o a instalar paquetes globales lo manda por un camino que su
      // entorno no usa — y decírselo al modelo no bastó tres veces seguidas.
      { tipo: 'no_contiene', valor: 'tsc', texto: 'no le manda a compilar con tsc' },
      { tipo: 'no_contiene', valor: 'npm install -g', texto: 'no le manda a instalar paquetes globales' },
    ],
  },
  {
    tipo: 'ejercicio',
    descripcion: 'Un ejercicio debe tener enunciado y criterio de solución.',
    senales: /\bejercicio|\bpr[aá]ctica|\breto\b|\bproblema\b/i,
    exigir: () => [
      { tipo: 'contiene', valor: '```', texto: 'hay al menos un ejemplo de código' },
      { tipo: 'min_lineas', valor: 8, texto: 'el material suma al menos 8 líneas' },
    ],
  },
  {
    tipo: 'resumen',
    descripcion: 'Un resumen debe tener cuerpo suficiente para servir de repaso.',
    senales: /\bresumen|\bres[uú]me|\bs[ií]ntesis|\bapuntes?\b|\bnotas?\b/i,
    exigir: () => [{ tipo: 'min_lineas', valor: 10, texto: 'el material suma al menos 10 líneas' }],
  },
];

/** Devuelve el estándar que aplica a un objetivo, o null si ninguno. */
export function estandarPara(objetivo: string): Estandar | null {
  return ESTANDARES.find((e) => e.senales.test(objetivo)) ?? null;
}

/** Archivos de texto producidos, sobre los que se aplican los estándares. */
export function archivosDeTexto(rutas: string[]): string[] {
  return rutas.filter((r) => /\.(md|txt|ts|js|py)$/i.test(r));
}
