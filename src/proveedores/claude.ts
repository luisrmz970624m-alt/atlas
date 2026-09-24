// Proveedor Claude (Anthropic). A diferencia de Ollama, esto se cobra por uso
// y necesita Internet, así que Atlas solo lo elige si hay clave configurada.

import Anthropic from '@anthropic-ai/sdk';
import {
  ModeloNoDisponible,
  RespuestaIncompleta,
  reportarAvance,
  type Generador,
  type Proveedor,
} from './tipos.ts';

export const MODELO_CLAUDE = process.env.ATLAS_MODELO_CLAUDE ?? 'claude-opus-5';

const MAX_SALIDA = Number(process.env.ATLAS_CLAUDE_MAX_SALIDA ?? 16000);

/**
 * El contrato Generador devuelve texto que después pasa por extraerJSON, así
 * que hay que pedir JSON explícitamente. Claude no tiene un interruptor como
 * el format:'json' de Ollama sin declarar un esquema, y el contrato no lleva
 * esquema, así que se pide por instrucción y extraerJSON se encarga del resto
 * (ya tolera texto alrededor).
 */
const EXIGIR_JSON = 'Responde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código.';

// Se crea una sola vez y se reutiliza: abrir un cliente por llamada tiraría
// el pool de conexiones en cada petición.
let cliente: Anthropic | null = null;
function obtenerCliente(): Anthropic {
  // El SDK lee ANTHROPIC_API_KEY del entorno por sí solo. La clave nunca se
  // escribe en el código ni pasa por el registro (el supervisor bloquea secretos).
  cliente ??= new Anthropic();
  return cliente;
}

const generarClaude: Generador = async (sistema, usuario) => {
  const anthropic = obtenerCliente();

  let respuesta;
  try {
    // Streaming: una respuesta larga puede tardar más que el tope de HTTP, y
    // además permite reportar avance como hace Ollama.
    const flujo = anthropic.messages.stream({
      model: MODELO_CLAUDE,
      max_tokens: MAX_SALIDA,
      system: `${sistema}\n\n${EXIGIR_JSON}`,
      messages: [{ role: 'user', content: usuario }],
    });

    let trozos = 0;
    flujo.on('text', () => reportarAvance(++trozos));

    respuesta = await flujo.finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      throw new ModeloNoDisponible('Clave de Claude inválida o ausente. Define ANTHROPIC_API_KEY.');
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new ModeloNoDisponible('Claude está limitando las peticiones (rate limit). Intenta más tarde.');
    }
    if (e instanceof Anthropic.APIError) {
      throw new ModeloNoDisponible(`Claude respondió ${e.status}: ${e.message}`);
    }
    throw new ModeloNoDisponible(`No se pudo hablar con Claude: ${(e as Error).message}`);
  }

  // Una negativa por seguridad llega como respuesta correcta (HTTP 200), no
  // como error: hay que mirar stop_reason antes de leer el contenido.
  if (respuesta.stop_reason === 'refusal') {
    throw new ModeloNoDisponible(
      `Claude declinó la petición (${respuesta.stop_details?.category ?? 'sin categoría'}).`,
    );
  }

  if (respuesta.stop_reason === 'max_tokens') {
    throw new RespuestaIncompleta(
      `La respuesta se cortó en ${MAX_SALIDA} tokens. Pide menos contenido o sube ATLAS_CLAUDE_MAX_SALIDA.`,
    );
  }

  // content es una unión: hay que filtrar los bloques de texto.
  const texto = respuesta.content
    .filter((bloque) => bloque.type === 'text')
    .map((bloque) => bloque.text)
    .join('');

  if (texto === '') throw new ModeloNoDisponible('Claude respondió sin contenido de texto.');

  return texto;
};

export const claude: Proveedor = {
  nombre: 'claude',
  modelo: MODELO_CLAUDE,
  local: false,
  disponible: () => Boolean(process.env.ANTHROPIC_API_KEY),
  generar: generarClaude,
};
