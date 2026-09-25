// Proveedor ChatGPT (OpenAI). Igual que Claude: se cobra por uso y necesita
// Internet, así que Atlas solo lo elige si hay clave configurada.

import OpenAI from 'openai';
import {
  ModeloNoDisponible,
  RespuestaIncompleta,
  reportarAvance,
  type Generador,
  type Proveedor,
} from './tipos.ts';

export const MODELO_CHATGPT = process.env.ATLAS_MODELO_CHATGPT ?? 'gpt-4o';

const MAX_SALIDA = Number(process.env.ATLAS_CHATGPT_MAX_SALIDA ?? 16000);

let cliente: OpenAI | null = null;
function obtenerCliente(): OpenAI {
  // El SDK lee OPENAI_API_KEY del entorno por sí solo.
  cliente ??= new OpenAI();
  return cliente;
}

const generarChatGPT: Generador = async (sistema, usuario) => {
  const openai = obtenerCliente();

  try {
    const flujo = await openai.chat.completions.create({
      model: MODELO_CHATGPT,
      // max_tokens está deprecado en la API de Chat Completions desde 2024;
      // OpenAI puede retirarlo del todo más adelante.
      max_completion_tokens: MAX_SALIDA,
      stream: true,
      // A diferencia de Claude, OpenAI sí tiene un modo JSON sin esquema.
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario },
      ],
    });

    let texto = '';
    let trozos = 0;
    let razonFinal: string | null = null;

    for await (const parte of flujo) {
      const contenido = parte.choices[0]?.delta?.content;
      if (contenido) {
        texto += contenido;
        reportarAvance(++trozos);
      }
      if (parte.choices[0]?.finish_reason) razonFinal = parte.choices[0].finish_reason;
    }

    if (razonFinal === 'length') {
      throw new RespuestaIncompleta(
        `La respuesta se cortó en ${MAX_SALIDA} tokens. Pide menos contenido o sube ATLAS_CHATGPT_MAX_SALIDA.`,
      );
    }

    if (texto === '') throw new ModeloNoDisponible('ChatGPT respondió sin contenido.');

    return texto;
  } catch (e) {
    // RespuestaIncompleta es nuestra y debe subir tal cual, no convertirse en
    // "modelo no disponible".
    if (e instanceof RespuestaIncompleta) throw e;

    if (e instanceof OpenAI.AuthenticationError) {
      throw new ModeloNoDisponible('Clave de ChatGPT inválida o ausente. Define OPENAI_API_KEY.');
    }
    if (e instanceof OpenAI.RateLimitError) {
      throw new ModeloNoDisponible('ChatGPT está limitando las peticiones (rate limit). Intenta más tarde.');
    }
    if (e instanceof OpenAI.APIError) {
      throw new ModeloNoDisponible(`ChatGPT respondió ${e.status}: ${e.message}`);
    }
    throw new ModeloNoDisponible(`No se pudo hablar con ChatGPT: ${(e as Error).message}`);
  }
};

export const chatgpt: Proveedor = {
  nombre: 'chatgpt',
  modelo: MODELO_CHATGPT,
  local: false,
  disponible: () => Boolean(process.env.OPENAI_API_KEY),
  generar: generarChatGPT,
};
