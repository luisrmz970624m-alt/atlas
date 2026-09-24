// Rescatar el JSON de una respuesta de modelo. No depende de ningún proveedor:
// todos devuelven texto que a veces viene envuelto en explicaciones.

import { RespuestaIncompleta } from './proveedores/tipos.ts';

/**
 * Extrae el primer bloque JSON de una respuesta.
 * Los modelos suelen envolver el JSON en explicaciones o en ```json.
 */
export function extraerJSON(texto: string): unknown {
  // 1. Lo normal cuando se pide JSON: toda la respuesta es JSON.
  const directo = texto.trim();
  if (directo.startsWith('{') || directo.startsWith('[')) {
    try { return JSON.parse(directo); } catch { /* seguimos */ }
  }

  // 2. Si viene envuelto en explicaciones o en ```json, recortamos el objeto
  //    contando llaves. Contar mal fue el error anterior: buscar el último '}'
  //    se rompe en cuanto el contenido de una lección trae llaves dentro.
  const recorte = recortarJSON(texto);
  if (recorte === null) {
    throw new Error('La respuesta del modelo no contiene JSON.');
  }
  if (!recorte.cerrado) {
    throw new RespuestaIncompleta('El JSON llegó cortado: el modelo se quedó sin espacio a mitad de la respuesta.');
  }

  try {
    return JSON.parse(recorte.texto);
  } catch {
    // 3. Último recurso: los modelos meten saltos de línea crudos dentro de
    //    las cadenas, que JSON no permite. Los escapamos y reintentamos.
    return JSON.parse(escaparSaltos(recorte.texto));
  }
}

/**
 * Recorta el primer valor JSON completo del texto, contando llaves y
 * corchetes, e ignorando los que estén dentro de una cadena.
 */
function recortarJSON(texto: string): { texto: string; cerrado: boolean } | null {
  const inicio = texto.search(/[[{]/);
  if (inicio === -1) return null;

  let profundidad = 0;
  let enCadena = false;
  let escapado = false;

  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i]!;

    if (escapado) { escapado = false; continue; }
    if (c === '\\' && enCadena) { escapado = true; continue; }
    if (c === '"') { enCadena = !enCadena; continue; }
    if (enCadena) continue;

    if (c === '{' || c === '[') profundidad++;
    else if (c === '}' || c === ']') {
      profundidad--;
      if (profundidad === 0) return { texto: texto.slice(inicio, i + 1), cerrado: true };
    }
  }

  return { texto: texto.slice(inicio), cerrado: false };
}

/** Escapa saltos de línea y tabuladores crudos que aparezcan dentro de cadenas. */
function escaparSaltos(json: string): string {
  let salida = '';
  let enCadena = false;
  let escapado = false;

  for (const c of json) {
    if (escapado) { salida += c; escapado = false; continue; }
    if (c === '\\' && enCadena) { salida += c; escapado = true; continue; }
    if (c === '"') { enCadena = !enCadena; salida += c; continue; }

    if (enCadena && c === '\n') salida += '\\n';
    else if (enCadena && c === '\r') salida += '\\r';
    else if (enCadena && c === '\t') salida += '\\t';
    else salida += c;
  }
  return salida;
}
