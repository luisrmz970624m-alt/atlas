import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';

export interface ResultadoRespaldo {
  origen: string;
  destino: string;
  timestamp: string;
  tamano_bytes: number;
}

const CARPETA_DEFAULT = 'respaldos';
const RETENCION_DEFAULT = 7; // conservar últimos N respaldos por archivo origen

/**
 * Crea un respaldo seguro de una base SQLite usando el backup nativo
 * de better-sqlite3 (no corrompe si la DB está en uso/escribiendo).
 */
export async function respaldarDB(
  ruta_db: string,
  carpeta_destino: string = CARPETA_DEFAULT
): Promise<ResultadoRespaldo> {
  if (!existsSync(ruta_db)) {
    throw new Error(`No existe la base de datos: ${ruta_db}`);
  }

  mkdirSync(carpeta_destino, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const nombreBase = basename(ruta_db, '.db');
  const destino = join(carpeta_destino, `${nombreBase}-${timestamp}.db`);

  const db = new Database(ruta_db, { readonly: true });
  await db.backup(destino);
  db.close();

  const tamano_bytes = statSync(destino).size;

  return { origen: ruta_db, destino, timestamp, tamano_bytes };
}

/**
 * Elimina respaldos viejos de un archivo origen, conservando solo los últimos N.
 */
export function limpiarRespaldosViejos(
  ruta_db: string,
  carpeta_destino: string = CARPETA_DEFAULT,
  retener: number = RETENCION_DEFAULT
): string[] {
  if (!existsSync(carpeta_destino)) return [];

  const nombreBase = basename(ruta_db, '.db');
  const prefijo = `${nombreBase}-`;

  const candidatos = readdirSync(carpeta_destino)
    .filter((f) => f.startsWith(prefijo) && f.endsWith('.db'))
    .map((f) => ({ archivo: f, ruta: join(carpeta_destino, f), mtime: statSync(join(carpeta_destino, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const eliminados: string[] = [];
  for (const viejo of candidatos.slice(retener)) {
    unlinkSync(viejo.ruta);
    eliminados.push(viejo.archivo);
  }

  return eliminados;
}

/**
 * Respalda todas las bases de datos conocidas del proyecto y limpia respaldos viejos.
 */
export async function respaldarTodo(
  rutas_db: string[],
  carpeta_destino: string = CARPETA_DEFAULT,
  retener: number = RETENCION_DEFAULT
): Promise<{ respaldos: ResultadoRespaldo[]; eliminados: string[] }> {
  const respaldos: ResultadoRespaldo[] = [];
  const eliminados: string[] = [];

  for (const ruta of rutas_db) {
    if (!existsSync(ruta)) continue;
    respaldos.push(await respaldarDB(ruta, carpeta_destino));
    eliminados.push(...limpiarRespaldosViejos(ruta, carpeta_destino, retener));
  }

  return { respaldos, eliminados };
}

export function listarRespaldos(carpeta_destino: string = CARPETA_DEFAULT): { archivo: string; tamano_bytes: number; fecha: string }[] {
  if (!existsSync(carpeta_destino)) return [];

  return readdirSync(carpeta_destino)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const ruta = join(carpeta_destino, f);
      const info = statSync(ruta);
      return { archivo: f, tamano_bytes: info.size, fecha: info.mtime.toISOString() };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}
