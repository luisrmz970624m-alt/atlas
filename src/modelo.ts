// Conexión con el modelo local vía Ollama.
//
// Atlas no depende de ningún servicio de pago ni de Internet.
// Si Ollama no está corriendo, se dice con claridad y se detiene.

const HOST = process.env.ATLAS_OLLAMA ?? 'http://localhost:11434';
export const MODELO = process.env.ATLAS_MODELO ?? 'qwen2.5-coder:14b';

export class ModeloNoDisponible extends Error {}

/** Firma de un generador de texto. Se inyecta para poder probar sin Ollama. */
export type Generador = (sistema: string, usuario: string) => Promise<string>;

/** Generador real: habla con Ollama. */
export const generar: Generador = async (sistema, usuario) => {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${HOST}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        stream: false,
        options: { temperature: 0.2 },
        messages: [
          { role: 'system', content: sistema },
          { role: 'user', content: usuario },
        ],
      }),
    });
  } catch {
    throw new ModeloNoDisponible(
      `No se pudo hablar con Ollama en ${HOST}. ¿Está corriendo? Prueba: ollama serve`,
    );
  }

  if (!respuesta.ok) {
    throw new ModeloNoDisponible(`Ollama respondió ${respuesta.status}. ¿Está descargado el modelo ${MODELO}?`);
  }

  const datos = (await respuesta.json()) as { message?: { content?: string } };
  const texto = datos.message?.content;
  if (!texto) throw new ModeloNoDisponible('Ollama respondió sin contenido.');
  return texto;
};

/**
 * Extrae el primer bloque JSON de una respuesta.
 * Los modelos suelen envolver el JSON en explicaciones o en ```json.
 */
export function extraerJSON(texto: string): unknown {
  const limpio = texto.replace(/```json/gi, '```').trim();
  const bloque = limpio.match(/```\s*([\s\S]*?)```/);
  const candidato = bloque ? bloque[1]! : limpio;

  const inicio = candidato.search(/[[{]/);
  if (inicio === -1) throw new Error('La respuesta del modelo no contiene JSON.');

  const abre = candidato[inicio];
  const cierra = abre === '[' ? ']' : '}';
  const fin = candidato.lastIndexOf(cierra);
  if (fin === -1) throw new Error('El JSON de la respuesta está incompleto.');

  return JSON.parse(candidato.slice(inicio, fin + 1));
}
