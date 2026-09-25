// Atlas es el cerebro: decide qué proveedor atiende cada petición y qué hacer
// cuando uno falla. Los proveedores solo generan texto; no deciden nada.

import { ModeloNoDisponible, type Generador, type NombreProveedor, type Proveedor } from './tipos.ts';
import { ollama } from './ollama.ts';
import { claude } from './claude.ts';
import { chatgpt } from './chatgpt.ts';
import { crearVortice, POLITICA_VORTICE_DEFECTO } from '../vortice/router.ts';

export const PROVEEDORES: Record<NombreProveedor, Proveedor> = { ollama, claude, chatgpt };

/**
 * Orden de preferencia por defecto: primero lo local y gratis. Solo se recurre
 * a la nube si Atlas no puede resolverlo en casa o si se le pide expresamente.
 */
const ORDEN_DEFECTO: NombreProveedor[] = ['ollama', 'claude', 'chatgpt'];

function esNombreValido(valor: string): valor is NombreProveedor {
  return valor === 'ollama' || valor === 'claude' || valor === 'chatgpt';
}

/**
 * Lee ATLAS_PROVEEDOR, que admite un nombre ("claude") o una cadena de
 * respaldo ("claude,ollama"). Los nombres desconocidos se ignoran en vez de
 * tumbar a Atlas: un dedazo en una variable de entorno no debe dejarlo mudo.
 */
export function ordenConfigurado(valor = process.env.ATLAS_PROVEEDOR): NombreProveedor[] {
  if (!valor) return ORDEN_DEFECTO;

  const pedidos = valor.split(',').map((n) => n.trim().toLowerCase()).filter(esNombreValido);
  if (pedidos.length === 0) return ORDEN_DEFECTO;

  // Lo pedido primero; el resto queda detrás como respaldo.
  return [...new Set([...pedidos, ...ORDEN_DEFECTO])];
}

/** Proveedores configurados y listos, en orden de preferencia. */
export function proveedoresDisponibles(orden = ordenConfigurado()): Proveedor[] {
  // Una clave presente solo configura el proveedor: no autoriza gastar API.
  // Esto protege la ruta histórica mientras El Vórtice se adopta encima del
  // contrato Generador.
  const apiPagadaPermitida = process.env.ATLAS_PERMITIR_API_PAGADA === 'true';
  return orden.map((n) => PROVEEDORES[n])
    .filter((p) => p.local || apiPagadaPermitida)
    .filter((p) => p.disponible());
}

function politicaVorticeDesdeEntorno() {
  return {
    ...POLITICA_VORTICE_DEFECTO,
    apiPagadaPermitida: process.env.ATLAS_PERMITIR_API_PAGADA === 'true',
  };
}

/**
 * El generador que usa Atlas: intenta con el primer proveedor disponible y,
 * si ese no está operativo, pasa al siguiente.
 *
 * Solo se cambia de proveedor ante ModeloNoDisponible (no hay clave, no
 * responde, sin crédito). Una RespuestaIncompleta NO cambia de proveedor:
 * es un problema del contenido pedido, y reintentarlo en otro sitio costaría
 * dinero para volver a fallar igual.
 */
export async function generarCon(
  candidatos: Proveedor[],
  sistema: string,
  usuario: string,
): Promise<string> {
  if (candidatos.length === 0) {
    throw new ModeloNoDisponible(
      'Ningún proveedor de IA disponible. Enciende Ollama, o define ANTHROPIC_API_KEY u OPENAI_API_KEY.',
    );
  }

  const fallos: string[] = [];

  for (const proveedor of candidatos) {
    try {
      return await proveedor.generar(sistema, usuario);
    } catch (e) {
      if (!(e instanceof ModeloNoDisponible)) throw e;

      fallos.push(`${proveedor.nombre}: ${e.message}`);
      const quedan = candidatos.indexOf(proveedor) < candidatos.length - 1;
      if (quedan) console.error(`⚠️  ${proveedor.nombre} no disponible, probando el siguiente…`);
    }
  }

  throw new ModeloNoDisponible(`Ningún proveedor pudo responder.\n   ${fallos.join('\n   ')}`);
}

/** El generador que usa Atlas: la cascada sobre los proveedores configurados. */
export const generar: Generador = (sistema, usuario) =>
  crearVortice(PROVEEDORES, politicaVorticeDesdeEntorno()).generador()(sistema, usuario);

/** Proveedor que Atlas usaría ahora mismo. Para mostrarlo, no para decidir. */
export function proveedorActivo(): Proveedor | null {
  return proveedoresDisponibles()[0] ?? null;
}
