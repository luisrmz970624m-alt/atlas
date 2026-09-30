// Verificaciones comprobables.
//
// Esta es la respuesta a la regla del documento maestro:
// "un comando sin errores no significa éxito".
//
// Una verificación no es una frase bonita: es una comprobación que se ejecuta
// y devuelve verdadero o falso. Si no se puede ejecutar, el paso no es válido.

import {
  existeArchivoSeguro,
  leerArchivoSeguro,
  tamanoArchivoSeguro,
} from './herramientas.ts';

export type TipoVerificacion = 'existe' | 'min_bytes' | 'contiene' | 'no_contiene' | 'min_lineas' | 'sin_solucion';

export interface Verificacion {
  tipo: TipoVerificacion;
  archivo: string;
  valor?: string | number;
}

export interface Comprobacion {
  paso: boolean;
  evidencia: string;
}

const TIPOS: TipoVerificacion[] = ['existe', 'min_bytes', 'contiene', 'min_lineas'];  // 'sin_solucion' es solo de estándar

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
  try {
    if (!existeArchivoSeguro(v.archivo)) {
      return { paso: false, evidencia: `${v.archivo} no existe` };
    }

    switch (v.tipo) {
      case 'existe':
        return { paso: true, evidencia: `${v.archivo} existe` };

      case 'min_bytes': {
        const bytes = tamanoArchivoSeguro(v.archivo);
        const minimo = Number(v.valor);
        return { paso: bytes >= minimo, evidencia: `${v.archivo} mide ${bytes} bytes (mínimo ${minimo})` };
      }

      case 'min_lineas': {
        const lineas = leerArchivoSeguro(v.archivo).split('\n').filter((l) => l.trim() !== '').length;
        const minimo = Number(v.valor);
        return { paso: lineas >= minimo, evidencia: `${v.archivo} tiene ${lineas} línea(s) (mínimo ${minimo})` };
      }

      case 'contiene': {
        const texto = leerArchivoSeguro(v.archivo);
        const buscado = String(v.valor);
        const hay = texto.includes(buscado);
        return { paso: hay, evidencia: `${v.archivo} ${hay ? 'contiene' : 'NO contiene'} "${buscado}"` };
      }

      case 'no_contiene': {
        const buscado = String(v.valor);
        const hay = leerArchivoSeguro(v.archivo).toLowerCase().includes(buscado.toLowerCase());
        return { paso: !hay, evidencia: `${v.archivo} ${hay ? 'MENCIONA' : 'no menciona'} "${buscado}"` };
      }

      case 'sin_solucion':
        return sinSolucion(leerArchivoSeguro(v.archivo), v.archivo);
    }
  } catch (e) {
    return { paso: false, evidencia: (e as Error).message };
  }
}

/**
 * Un ejercicio con la solución al lado no es un ejercicio.
 *
 * Pasó de verdad: el modelo cerró la lección con "Aquí tienes una solución
 * posible" y el código resuelto debajo. El material parecía completo y el
 * ejercicio valía cero.
 *
 * Se mira SOLO lo que hay después de "## Ejercicio": un texto que explique la
 * solución de un problema de ejemplo, antes del ejercicio, es legítimo.
 */
export function sinSolucion(texto: string, archivo = 'el material'): Comprobacion {
  const lineas = texto.split('\n');
  const i = lineas.findIndex((l) => /^##\s+Ejercicio/i.test(l));
  if (i === -1) return { paso: true, evidencia: `${archivo} no tiene sección de ejercicio` };

  const despues = lineas.slice(i + 1).join('\n');
  const delata = [
    /soluci[oó]n/i,
    /respuesta correcta/i,
    /aqu[ií] tienes (el|la|un|una)/i,
    /c[oó]digo resuelto/i,
  ];

  for (const patron of delata) {
    if (patron.test(despues)) {
      return { paso: false, evidencia: `${archivo} REGALA la solución en el ejercicio (${patron})` };
    }
  }
  return { paso: true, evidencia: `${archivo} plantea el ejercicio sin resolverlo` };
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

    case 'sin_solucion': {
      for (const a of archivos) {
        const r = sinSolucion(leerArchivoSeguro(a), a);
        if (!r.paso) return r;
      }
      return { paso: true, evidencia: 'ningún archivo regala la solución' };
    }

    case 'no_contiene': {
      const buscado = String(valor).toLowerCase();
      const donde = archivos.find((a) => leerArchivoSeguro(a).toLowerCase().includes(buscado));
      return donde
        ? { paso: false, evidencia: `${donde} MENCIONA "${valor}", que no aplica a este entorno` }
        : { paso: true, evidencia: `ningún archivo menciona "${valor}"` };
    }

    case 'contiene': {
      const buscado = String(valor);
      const donde = archivos.find((a) => comprobar({ tipo: 'contiene', archivo: a, valor: buscado }).paso);
      return donde
        ? { paso: true, evidencia: `${donde} contiene "${buscado}"` }
        : { paso: false, evidencia: `ningún archivo contiene "${buscado}" (${nombres})` };
    }

    case 'min_bytes': {
      const total = archivos.reduce((n, a) => n + tamanoArchivoSeguro(a), 0);
      const minimo = Number(valor);
      return { paso: total >= minimo, evidencia: `${archivos.length} archivo(s) suman ${total} bytes (mínimo ${minimo})` };
    }

    case 'min_lineas': {
      const total = archivos.reduce(
        (n, a) => n + leerArchivoSeguro(a).split('\n').filter((l) => l.trim() !== '').length, 0);
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
    case 'no_contiene': return `${v.archivo} no menciona "${v.valor}"`;
    case 'sin_solucion': return `${v.archivo} no trae la solución del ejercicio`;
  }
}
