import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
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

  // Escritura atómica: se escribe a un temporal y se renombra. Escribir
  // directo sobre el archivo lo trunca primero, así que un corte de luz o un
  // SIGKILL a mitad dejaría un JSON incompleto — y cargarEstado lo
  // descartaría en silencio, perdiendo el contador de ciclos. El daemon
  // guarda cada 60s, así que esa ventana se abre 1.440 veces al día.
  const temporal = `${ruta}.tmp`;
  writeFileSync(temporal, JSON.stringify(persistido, null, 2), 'utf8');
  renameSync(temporal, ruta);
}

export function cargarEstado(ruta: string = RUTA_DEFAULT): EstadoPersistido | null {
  if (!existsSync(ruta)) return null;

  try {
    return JSON.parse(readFileSync(ruta, 'utf8')) as EstadoPersistido;
  } catch {
    return null;
  }
}
