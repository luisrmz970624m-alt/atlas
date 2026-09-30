// Herramientas de Atlas (Módulo D del documento maestro)
//
// Regla principal: Atlas NO tiene acceso general a la computadora.
// Recibe una capacidad concreta, dentro de un alcance autorizado.
//
// El laboratorio se recorre con descriptores de directorio y O_NOFOLLOW.
// Las operaciones no vuelven a resolver por nombre un path ya validado.

import {
  constants,
  closeSync,
  fstatSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export const LABORATORIO = resolve(process.env.ATLAS_LABORATORIO ?? 'laboratorio');

export class FueraDelLaboratorio extends Error {}

interface DirectorioSeguro {
  fd: number;
  dispositivo: number;
}

function errorDeRuta(error: unknown, propuesta: string): never {
  if (error instanceof Error && 'code' in error && ['ELOOP', 'ENOTDIR'].includes(String(error.code))) {
    throw new FueraDelLaboratorio(`La ruta "${propuesta}" contiene un enlace simbólico o no es un directorio. Rechazada.`);
  }
  throw error;
}

function rutaDescriptor(fd: number, nombre?: string): string {
  return nombre === undefined ? `/proc/self/fd/${fd}` : `/proc/self/fd/${fd}/${nombre}`;
}

function abrirDirectorioAbsoluto(ruta: string, crear: boolean): DirectorioSeguro {
  if (process.platform !== 'linux') {
    throw new Error('El acceso seguro al laboratorio requiere Linux y /proc/self/fd.');
  }

  let fd = openSync('/', constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    const partes = ruta.split(sep).filter(Boolean);
    for (const parte of partes) {
      const hijo = rutaDescriptor(fd, parte);
      let siguiente: number;
      try {
        siguiente = openSync(hijo, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      } catch (error) {
        if (!crear || !(error instanceof Error) || !('code' in error) || String(error.code) !== 'ENOENT') {
          errorDeRuta(error, ruta);
        }
        try {
          mkdirSync(hijo, { mode: 0o700 });
        } catch (crearError) {
          if (!(crearError instanceof Error) || !('code' in crearError) || String(crearError.code) !== 'EEXIST') {
            errorDeRuta(crearError, ruta);
          }
        }
        siguiente = openSync(hijo, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      }
      closeSync(fd);
      fd = siguiente;
    }
    return { fd, dispositivo: fstatSync(fd).dev };
  } catch (error) {
    closeSync(fd);
    errorDeRuta(error, ruta);
  }
}

function segmentosRelativos(propuesta: string): string[] {
  if (isAbsolute(propuesta)) {
    throw new FueraDelLaboratorio(`La ruta "${propuesta}" debe ser relativa al laboratorio.`);
  }
  const destino = resolve(LABORATORIO, propuesta);
  const relativo = relative(LABORATORIO, destino);
  if (relativo === '..' || relativo.startsWith(`..${sep}`) || isAbsolute(relativo)) {
    throw new FueraDelLaboratorio(`La ruta "${propuesta}" sale del laboratorio. Rechazada.`);
  }
  return relativo === '' ? [] : relativo.split(sep);
}

function abrirDirectorioLaboratorio(crear: boolean): DirectorioSeguro {
  return abrirDirectorioAbsoluto(LABORATORIO, crear);
}

function abrirPadre(propuesta: string, crear: boolean): { padre: DirectorioSeguro; nombre: string } {
  const partes = segmentosRelativos(propuesta);
  if (partes.length === 0) {
    throw new FueraDelLaboratorio('La ruta debe identificar un archivo dentro del laboratorio.');
  }

  let directorio = abrirDirectorioLaboratorio(crear);
  try {
    for (const parte of partes.slice(0, -1)) {
      const hijo = rutaDescriptor(directorio.fd, parte);
      let siguiente: number;
      try {
        siguiente = openSync(hijo, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      } catch (error) {
        if (!crear || !(error instanceof Error) || !('code' in error) || String(error.code) !== 'ENOENT') {
          errorDeRuta(error, propuesta);
        }
        try {
          mkdirSync(hijo, { mode: 0o700 });
        } catch (crearError) {
          if (!(crearError instanceof Error) || !('code' in crearError) || String(crearError.code) !== 'EEXIST') {
            errorDeRuta(crearError, propuesta);
          }
        }
        siguiente = openSync(hijo, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      }
      closeSync(directorio.fd);
      directorio = { fd: siguiente, dispositivo: directorio.dispositivo };
      if (fstatSync(siguiente).dev !== directorio.dispositivo) {
        throw new FueraDelLaboratorio(`La ruta "${propuesta}" cruza un volumen distinto. Rechazada.`);
      }
    }
    return { padre: directorio, nombre: partes.at(-1)! };
  } catch (error) {
    closeSync(directorio.fd);
    errorDeRuta(error, propuesta);
  }
}

function validarArchivo(fd: number, propuesta: string): void {
  const info = fstatSync(fd);
  if (!info.isFile() || info.nlink !== 1) {
    throw new FueraDelLaboratorio(`La ruta "${propuesta}" no es un archivo regular independiente. Rechazada.`);
  }
}

function abrirArchivo(propuesta: string, flags: number, crearPadres: boolean): { fd: number; dispositivo: number } {
  const { padre, nombre } = abrirPadre(propuesta, crearPadres);
  try {
    const fd = openSync(rutaDescriptor(padre.fd, nombre), flags | constants.O_NONBLOCK | constants.O_NOFOLLOW, 0o600);
    try {
      validarArchivo(fd, propuesta);
      if (fstatSync(fd).dev !== padre.dispositivo) {
        throw new FueraDelLaboratorio(`La ruta "${propuesta}" cruza un volumen distinto. Rechazada.`);
      }
      return { fd, dispositivo: padre.dispositivo };
    } catch (error) {
      closeSync(fd);
      throw error;
    }
  } catch (error) {
    errorDeRuta(error, propuesta);
  } finally {
    closeSync(padre.fd);
  }
}

function comprobarArchivo(propuesta: string): boolean {
  const { padre, nombre } = abrirPadre(propuesta, false);
  try {
    let fd: number;
    try {
      fd = openSync(rutaDescriptor(padre.fd, nombre), constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
    } catch (error) {
      if (error instanceof Error && 'code' in error && String(error.code) === 'ENOENT') return false;
      errorDeRuta(error, propuesta);
    }
    try {
      validarArchivo(fd!, propuesta);
      return true;
    } finally {
      closeSync(fd!);
    }
  } finally {
    closeSync(padre.fd);
  }
}

function abrirDirectorioRelativo(propuesta: string, crear: boolean): DirectorioSeguro {
  const partes = segmentosRelativos(propuesta);
  let directorio = abrirDirectorioLaboratorio(crear);
  try {
    for (const parte of partes) {
      const hijo = rutaDescriptor(directorio.fd, parte);
      let siguiente: number;
      try {
        siguiente = openSync(hijo, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      } catch (error) {
        if (!crear || !(error instanceof Error) || !('code' in error) || String(error.code) !== 'ENOENT') {
          errorDeRuta(error, propuesta);
        }
        try {
          mkdirSync(hijo, { mode: 0o700 });
        } catch (crearError) {
          if (!(crearError instanceof Error) || !('code' in crearError) || String(crearError.code) !== 'EEXIST') {
            errorDeRuta(crearError, propuesta);
          }
        }
        siguiente = openSync(hijo, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      }
      closeSync(directorio.fd);
      directorio = { fd: siguiente, dispositivo: directorio.dispositivo };
      if (fstatSync(siguiente).dev !== directorio.dispositivo) {
        throw new FueraDelLaboratorio(`La ruta "${propuesta}" cruza un volumen distinto. Rechazada.`);
      }
    }
    return directorio;
  } catch (error) {
    closeSync(directorio.fd);
    errorDeRuta(error, propuesta);
  }
}

/**
 * Devuelve la ruta léxica para mostrarla o pasarla a procesos aislados.
 * Las operaciones de disco deben usar leerArchivoSeguro/escribirArchivoSeguro,
 * que anclan el recorrido a descriptores y no siguen symlinks.
 */
export function rutaSegura(propuesta: string): string {
  segmentosRelativos(propuesta);
  return resolve(LABORATORIO, propuesta);
}

export function existeArchivoSeguro(propuesta: string): boolean {
  if (segmentosRelativos(propuesta).length === 0) {
    const directorio = abrirDirectorioLaboratorio(false);
    closeSync(directorio.fd);
    return true;
  }
  try {
    return comprobarArchivo(propuesta);
  } catch (error) {
    if (error instanceof Error && 'code' in error && String(error.code) === 'ENOENT') return false;
    throw error;
  }
}

export function leerArchivoSeguro(propuesta: string, codificacion: BufferEncoding = 'utf8'): string {
  const { fd } = abrirArchivo(propuesta, constants.O_RDONLY, false);
  try {
    return readFileSync(fd, { encoding: codificacion });
  } finally {
    closeSync(fd);
  }
}

export function escribirArchivoSeguro(propuesta: string, contenido: string): void {
  const { fd } = abrirArchivo(propuesta, constants.O_WRONLY | constants.O_CREAT, true);
  try {
    ftruncateSync(fd, 0);
    writeFileSync(fd, contenido, 'utf8');
  } finally {
    closeSync(fd);
  }
}

export function agregarArchivoSeguro(propuesta: string, contenido: string): number {
  const { fd } = abrirArchivo(propuesta, constants.O_RDWR | constants.O_CREAT | constants.O_APPEND, true);
  try {
    const info = fstatSync(fd);
    let separador = '';
    if (info.size > 0) {
      const ultimo = Buffer.alloc(1);
      readSync(fd, ultimo, 0, 1, info.size - 1);
      if (ultimo[0] !== 0x0a) separador = '\n';
    }
    writeFileSync(fd, separador + contenido, 'utf8');
    return Buffer.byteLength(contenido, 'utf8');
  } finally {
    closeSync(fd);
  }
}

export function tamanoArchivoSeguro(propuesta: string): number {
  const { fd } = abrirArchivo(propuesta, constants.O_RDONLY, false);
  try {
    return fstatSync(fd).size;
  } finally {
    closeSync(fd);
  }
}

function tamanoEntradaSegura(propuesta: string, dispositivoRaiz: number): number {
  const { padre, nombre } = abrirPadre(propuesta, false);
  try {
    const fd = openSync(rutaDescriptor(padre.fd, nombre), constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
    try {
      const info = fstatSync(fd);
      if (info.dev !== dispositivoRaiz || (info.isFile() && info.nlink !== 1)) {
        throw new FueraDelLaboratorio(`La ruta "${propuesta}" no pertenece de forma segura al laboratorio.`);
      }
      if (!info.isFile() && !info.isDirectory()) {
        throw new FueraDelLaboratorio(`La ruta "${propuesta}" no es un archivo o directorio normal.`);
      }
      return info.size;
    } finally {
      closeSync(fd);
    }
  } catch (error) {
    errorDeRuta(error, propuesta);
  } finally {
    closeSync(padre.fd);
  }
}

export function tamanoRutaSegura(propuesta: string): number {
  const raiz = abrirDirectorioLaboratorio(false);
  try {
    return tamanoEntradaSegura(propuesta, raiz.dispositivo);
  } finally {
    closeSync(raiz.fd);
  }
}

export function listarCarpetaSegura(propuesta = '.'): string[] {
  const directorio = abrirDirectorioRelativo(propuesta, false);
  try {
    const nombres = readdirSync(rutaDescriptor(directorio.fd));
    for (const nombre of nombres) {
      tamanoEntradaSegura(propuesta === '.' ? nombre : `${propuesta}${sep}${nombre}`, directorio.dispositivo);
    }
    return nombres;
  } finally {
    closeSync(directorio.fd);
  }
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
      const contenido = String(args.contenido ?? '');
      escribirArchivoSeguro(String(args.ruta ?? ''), contenido);
      return { ruta: args.ruta, bytes: Buffer.byteLength(contenido, 'utf8') };
    },
  },

  agregar_archivo: {
    nombre: 'agregar_archivo',
    riesgo: 'verde',
    descripcion: 'Añade texto AL FINAL de un archivo del laboratorio, sin borrar lo anterior. Argumentos: ruta, contenido.',
    ejecutar(args) {
      const añadidos = agregarArchivoSeguro(String(args.ruta ?? ''), String(args.contenido ?? ''));
      return { ruta: args.ruta, añadidos };
    },
  },

  leer_archivo: {
    nombre: 'leer_archivo',
    riesgo: 'verde',
    descripcion: 'Lee un archivo del laboratorio. Argumentos: ruta.',
    ejecutar(args) {
      const texto = leerArchivoSeguro(String(args.ruta ?? ''));
      return { ruta: args.ruta, bytes: Buffer.byteLength(texto, 'utf8'), texto: texto.slice(0, 2000) };
    },
  },

  listar_carpeta: {
    nombre: 'listar_carpeta',
    riesgo: 'verde',
    descripcion: 'Lista los archivos de una carpeta del laboratorio. Argumentos: ruta.',
    ejecutar(args) {
      const ruta = String(args.ruta ?? '.');
      const archivos = listarCarpetaSegura(ruta).map((nombre) => ({
        nombre,
        bytes: tamanoRutaSegura(ruta === '.' ? nombre : `${ruta}${sep}${nombre}`),
      }));
      return { ruta: args.ruta, archivos };
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
