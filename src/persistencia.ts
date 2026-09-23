import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { EstadoAtlasV08 } from './orquestador-v08.ts';

export interface EstadoPersistido {
  estado: EstadoAtlasV08;
  ejecucion_activa: boolean;
  ciclos_ejecutados: number;
  ultima_actualizacion: string;
}

const RUTA_DEFAULT = 'datos/atlas-state.json';

export function guardarEstado(
  estado: EstadoAtlasV08,
  ejecucion_activa: boolean,
  ciclos_ejecutados: number,
  ruta: string = RUTA_DEFAULT
): void {
  const persistido: EstadoPersistido = {
    estado,
    ejecucion_activa,
    ciclos_ejecutados,
    ultima_actualizacion: new Date().toISOString(),
  };

  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, JSON.stringify(persistido, null, 2), 'utf8');
}

export function cargarEstado(ruta: string = RUTA_DEFAULT): EstadoPersistido | null {
  if (!existsSync(ruta)) return null;

  try {
    return JSON.parse(readFileSync(ruta, 'utf8')) as EstadoPersistido;
  } catch {
    return null;
  }
}
