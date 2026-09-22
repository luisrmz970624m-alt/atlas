// Herramientas de Atlas (Módulo D del documento maestro)
//
// Regla principal: Atlas NO tiene acceso general a la computadora.
// Recibe una capacidad concreta, dentro de un alcance autorizado.
//
// En V0.3 el alcance es una sola carpeta: laboratorio/.
// Cualquier ruta que intente salir de ahí es rechazada antes de tocar el disco.

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

export const LABORATORIO = resolve(process.env.ATLAS_LABORATORIO ?? 'laboratorio');

export class FueraDelLaboratorio extends Error {}

/**
 * Convierte una ruta propuesta en una ruta absoluta dentro del laboratorio.
 * Rechaza rutas absolutas, '..' y enlaces que se salgan del alcance.
 */
export function rutaSegura(propuesta: string): string {
  const destino = resolve(LABORATORIO, propuesta);
  if (destino !== LABORATORIO && !destino.startsWith(LABORATORIO + sep)) {
    throw new FueraDelLaboratorio(`La ruta "${propuesta}" sale del laboratorio. Rechazada.`);
  }
  return destino;
}

export interface Herramienta {
  nombre: string;
  riesgo: 'verde' | 'amarillo' | 'rojo';
  descripcion: string;
  ejecutar(args: Record<string, unknown>): unknown;
}

export const HERRAMIENTAS: Record<string, Herramienta> = {
  escribir_archivo: {
    nombre: 'escribir_archivo',
    riesgo: 'verde',
    descripcion: 'Crea o REEMPLAZA por completo un archivo del laboratorio. Argumentos: ruta, contenido.',
    ejecutar(args) {
      const destino = rutaSegura(String(args.ruta ?? ''));
      const contenido = String(args.contenido ?? '');
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, contenido, 'utf8');
      return { ruta: args.ruta, bytes: Buffer.byteLength(contenido, 'utf8') };
    },
  },

  agregar_archivo: {
    nombre: 'agregar_archivo',
    riesgo: 'verde',
    descripcion: 'Añade texto AL FINAL de un archivo del laboratorio, sin borrar lo anterior. Argumentos: ruta, contenido.',
    ejecutar(args) {
      const destino = rutaSegura(String(args.ruta ?? ''));
      const contenido = String(args.contenido ?? '');
      mkdirSync(dirname(destino), { recursive: true });
      const separador = existsSync(destino) && readFileSync(destino, 'utf8').endsWith('\n') ? '' : '\n';
      appendFileSync(destino, (existsSync(destino) ? separador : '') + contenido, 'utf8');
      return { ruta: args.ruta, añadidos: Buffer.byteLength(contenido, 'utf8') };
    },
  },

  leer_archivo: {
    nombre: 'leer_archivo',
    riesgo: 'verde',
    descripcion: 'Lee un archivo del laboratorio. Argumentos: ruta.',
    ejecutar(args) {
      const destino = rutaSegura(String(args.ruta ?? ''));
      if (!existsSync(destino)) throw new Error(`No existe ${args.ruta}`);
      const texto = readFileSync(destino, 'utf8');
      return { ruta: args.ruta, bytes: Buffer.byteLength(texto, 'utf8'), texto: texto.slice(0, 2000) };
    },
  },

  listar_carpeta: {
    nombre: 'listar_carpeta',
    riesgo: 'verde',
    descripcion: 'Lista los archivos de una carpeta del laboratorio. Argumentos: ruta.',
    ejecutar(args) {
      const destino = rutaSegura(String(args.ruta ?? '.'));
      if (!existsSync(destino)) return { ruta: args.ruta, archivos: [] };
      return {
        ruta: args.ruta,
        archivos: readdirSync(destino).map((n) => ({
          nombre: n,
          bytes: statSync(resolve(destino, n)).size,
        })),
      };
    },
  },
};

export function existeHerramienta(nombre: string): boolean {
  return Object.hasOwn(HERRAMIENTAS, nombre);
}

/** Catálogo legible para incluir en las instrucciones del modelo. */
export function catalogo(): string {
  return Object.values(HERRAMIENTAS).map((h) => `- ${h.nombre}: ${h.descripcion}`).join('\n');
}
