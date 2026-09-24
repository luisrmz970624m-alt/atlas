// Proveedor local vía Ollama. No cuesta dinero, no necesita Internet y no
// manda tus datos a ningún lado. Es el que Atlas usa por defecto.

import {
  ModeloNoDisponible,
  RespuestaIncompleta,
  reportarAvance,
  type Generador,
  type Proveedor,
} from './tipos.ts';

const HOST = process.env.ATLAS_OLLAMA ?? 'http://localhost:11434';
export const MODELO_OLLAMA = process.env.ATLAS_MODELO ?? 'qwen2.5-coder:14b';

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

/**
 * Habla con Ollama LEYENDO EN STREAMING.
 *
 * Por qué streaming y no una sola respuesta: un 14B en CPU genera a unos
 * 4 tokens por segundo, así que una lección tarda más de cinco minutos. Node
 * corta la petición si no llega ninguna cabecera en 300 segundos, y el error
 * parecía "Ollama no responde" cuando en realidad Ollama estaba trabajando
 * perfectamente. En streaming la primera cabecera llega al instante y la
 * espera deja de tener límite.
 */
const generarOllama: Generador = async (sistema, usuario) => {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${HOST}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODELO_OLLAMA,
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
    throw new ModeloNoDisponible(`Ollama respondió ${respuesta.status}. ¿Está descargado el modelo ${MODELO_OLLAMA}?`);
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
        reportarAvance(trozos);
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

export const ollama: Proveedor = {
  nombre: 'ollama',
  modelo: MODELO_OLLAMA,
  local: true,
  // Ollama no necesita clave. Si no está corriendo, se sabrá al primer intento
  // con un mensaje claro; no vale la pena hacer un sondeo extra en cada arranque.
  disponible: () => true,
  generar: generarOllama,
};
