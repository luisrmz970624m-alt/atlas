// Conexión con el modelo local vía Ollama.
//
// Atlas no depende de ningún servicio de pago ni de Internet.
// Si Ollama no está corriendo, se dice con claridad y se detiene.

const HOST = process.env.ATLAS_OLLAMA ?? 'http://localhost:11434';
export const MODELO = process.env.ATLAS_MODELO ?? 'qwen2.5-coder:14b';

export class ModeloNoDisponible extends Error {}

/** La respuesta se cortó a la mitad: el modelo se quedó sin espacio. */
export class RespuestaIncompleta extends Error {}

// Ventana de contexto y tope de salida.
//
// Cuidado al subir CONTEXTO: la caché de atención crece con él y se suma al
// tamaño del modelo en RAM. Un 14B con 16384 de contexto puede tumbar a Ollama
// en un equipo de 30 GiB. 8192 es el punto cómodo para este equipo.
//
// La solución de fondo a una respuesta cortada NO es subir el tope, sino pedir
// archivos más cortos repartidos en más pasos. Eso lo hace la regla 6 del
// planificador.
export const CONTEXTO = Number(process.env.ATLAS_CONTEXTO ?? 8192);
export const MAX_SALIDA = Number(process.env.ATLAS_MAX_SALIDA ?? 3072);

/** Firma de un generador de texto. Se inyecta para poder probar sin Ollama. */
export type Generador = (sistema: string, usuario: string) => Promise<string>;

/** Se llama con cada trozo generado, para poder mostrar avance. */
export type Avance = (tokens: number) => void;

let avisar: Avance | null = null;
export function alGenerar(f: Avance | null): void { avisar = f; }

/**
 * Generador real: habla con Ollama, LEYENDO EN STREAMING.
 *
 * Por qué streaming y no una sola respuesta: un 14B en CPU genera a unos
 * 4 tokens por segundo, así que una lección tarda más de cinco minutos. Node
 * corta la petición si no llega ninguna cabecera en 300 segundos, y el error
 * parecía "Ollama no responde" cuando en realidad Ollama estaba trabajando
 * perfectamente. En streaming la primera cabecera llega al instante y la
 * espera deja de tener límite.
 */
export const generar: Generador = async (sistema, usuario) => {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${HOST}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        stream: true,
        // Ollama restringe la generación a JSON válido. Es mucho mejor que
        // intentar reparar después lo que el modelo escribió mal.
        format: 'json',
        options: { temperature: 0.2, num_ctx: CONTEXTO, num_predict: MAX_SALIDA },
        messages: [
          { role: 'system', content: sistema },
          { role: 'user', content: usuario },
        ],
      }),
    });
  } catch {
    throw new ModeloNoDisponible(
      `No se pudo hablar con Ollama en ${HOST}. ¿Está corriendo? Prueba: systemctl status ollama`,
    );
  }

  if (!respuesta.ok) {
    throw new ModeloNoDisponible(`Ollama respondió ${respuesta.status}. ¿Está descargado el modelo ${MODELO}?`);
  }
  if (!respuesta.body) throw new ModeloNoDisponible('Ollama respondió sin cuerpo.');

  let texto = '';
  let razonFinal: string | undefined;
  let trozos = 0;
  let resto = '';

  const decodificador = new TextDecoder();
  for await (const bloque of respuesta.body as unknown as AsyncIterable<Uint8Array>) {
    resto += decodificador.decode(bloque, { stream: true });
    const lineas = resto.split('\n');
    resto = lineas.pop() ?? '';

    for (const linea of lineas) {
      if (linea.trim() === '') continue;
      const parte = JSON.parse(linea) as {
        message?: { content?: string };
        done?: boolean;
        done_reason?: string;
        error?: string;
      };
      if (parte.error) throw new ModeloNoDisponible(`Ollama: ${parte.error}`);
      if (parte.message?.content) {
        texto += parte.message.content;
        trozos++;
        avisar?.(trozos);
      }
      if (parte.done) razonFinal = parte.done_reason;
    }
  }

  if (texto === '') throw new ModeloNoDisponible('Ollama respondió sin contenido.');

  // Ollama avisa cuando cortó por tope de tokens. Mejor saberlo aquí que
  // descubrirlo con un JSON partido por la mitad.
  if (razonFinal === 'length') {
    throw new RespuestaIncompleta(
      `La respuesta se cortó en ${MAX_SALIDA} tokens. Pide menos contenido o sube ATLAS_MAX_SALIDA.`,
    );
  }
  return texto;
};

/**
 * Extrae el primer bloque JSON de una respuesta.
 * Los modelos suelen envolver el JSON en explicaciones o en ```json.
 */
export function extraerJSON(texto: string): unknown {
  // 1. Lo normal ahora que pedimos format:'json': toda la respuesta es JSON.
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
