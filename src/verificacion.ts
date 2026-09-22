// Verificaciones comprobables.
//
// Esta es la respuesta a la regla del documento maestro:
// "un comando sin errores no significa éxito".
//
// Una verificación no es una frase bonita: es una comprobación que se ejecuta
// y devuelve verdadero o falso. Si no se puede ejecutar, el paso no es válido.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { rutaSegura } from './herramientas.ts';

export type TipoVerificacion = 'existe' | 'min_bytes' | 'contiene' | 'min_lineas';

export interface Verificacion {
  tipo: TipoVerificacion;
  archivo: string;
  valor?: string | number;
}

export interface Comprobacion {
  paso: boolean;
  evidencia: string;
}

const TIPOS: TipoVerificacion[] = ['existe', 'min_bytes', 'contiene', 'min_lineas'];

export function esVerificacionValida(v: unknown): v is Verificacion {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (!TIPOS.includes(o.tipo as TipoVerificacion)) return false;
  if (typeof o.archivo !== 'string' || o.archivo.trim() === '') return false;
  if (o.tipo === 'min_bytes' || o.tipo === 'min_lineas') return Number.isFinite(Number(o.valor));
  if (o.tipo === 'contiene') return typeof o.valor === 'string' && o.valor.length > 0;
  return true;
}

/** Ejecuta la comprobación de verdad, contra el disco. */
export function comprobar(v: Verificacion): Comprobacion {
  let destino: string;
  try {
    destino = rutaSegura(v.archivo);
  } catch (e) {
    return { paso: false, evidencia: (e as Error).message };
  }

  if (!existsSync(destino)) {
    return { paso: false, evidencia: `${v.archivo} no existe` };
  }

  switch (v.tipo) {
    case 'existe':
      return { paso: true, evidencia: `${v.archivo} existe` };

    case 'min_bytes': {
      const bytes = statSync(destino).size;
      const minimo = Number(v.valor);
      return { paso: bytes >= minimo, evidencia: `${v.archivo} mide ${bytes} bytes (mínimo ${minimo})` };
    }

    case 'min_lineas': {
      const lineas = readFileSync(destino, 'utf8').split('\n').filter((l) => l.trim() !== '').length;
      const minimo = Number(v.valor);
      return { paso: lineas >= minimo, evidencia: `${v.archivo} tiene ${lineas} línea(s) (mínimo ${minimo})` };
    }

    case 'contiene': {
      const texto = readFileSync(destino, 'utf8');
      const buscado = String(v.valor);
      const hay = texto.includes(buscado);
      return { paso: hay, evidencia: `${v.archivo} ${hay ? 'contiene' : 'NO contiene'} "${buscado}"` };
    }
  }
}

/**
 * Comprueba una exigencia sobre el CONJUNTO de archivos producidos.
 *
 * Una lección puede estar repartida en varios archivos. Medir cada trozo por
 * separado castiga el reparto: tres archivos de 14 líneas suman 42, pero
 * ninguno llega a 20. Lo que importa es el material entero.
 */
export function comprobarConjunto(tipo: TipoVerificacion, valor: string | number | undefined, archivos: string[]): Comprobacion {
  if (archivos.length === 0) {
    return { paso: false, evidencia: 'no se produjo ningún archivo' };
  }

  const nombres = archivos.join(', ');
  const partes = archivos.map((a) => comprobar({ tipo: 'existe', archivo: a }));
  const faltan = archivos.filter((_, i) => !partes[i]!.paso);
  if (faltan.length > 0) {
    return { paso: false, evidencia: `falta(n) ${faltan.join(', ')}` };
  }

  switch (tipo) {
    case 'existe':
      return { paso: true, evidencia: `${nombres} existe(n)` };

    case 'contiene': {
      const buscado = String(valor);
      const donde = archivos.find((a) => comprobar({ tipo: 'contiene', archivo: a, valor: buscado }).paso);
      return donde
        ? { paso: true, evidencia: `${donde} contiene "${buscado}"` }
        : { paso: false, evidencia: `ningún archivo contiene "${buscado}" (${nombres})` };
    }

    case 'min_bytes': {
      const total = archivos.reduce((n, a) => n + statSync(rutaSegura(a)).size, 0);
      const minimo = Number(valor);
      return { paso: total >= minimo, evidencia: `${archivos.length} archivo(s) suman ${total} bytes (mínimo ${minimo})` };
    }

    case 'min_lineas': {
      const total = archivos.reduce(
        (n, a) => n + readFileSync(rutaSegura(a), 'utf8').split('\n').filter((l) => l.trim() !== '').length, 0);
      const minimo = Number(valor);
      return { paso: total >= minimo, evidencia: `${archivos.length} archivo(s) suman ${total} línea(s) (mínimo ${minimo})` };
    }
  }
}

/** Texto legible de una verificación, para mostrar el plan. */
export function describir(v: Verificacion): string {
  switch (v.tipo) {
    case 'existe': return `${v.archivo} existe`;
    case 'min_bytes': return `${v.archivo} mide al menos ${v.valor} bytes`;
    case 'min_lineas': return `${v.archivo} tiene al menos ${v.valor} líneas`;
    case 'contiene': return `${v.archivo} contiene "${v.valor}"`;
  }
}
