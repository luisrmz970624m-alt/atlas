// Atlas es el cerebro: decide qué proveedor atiende cada petición y qué hacer
// cuando uno falla. Los proveedores solo generan texto; no deciden nada.

import { ModeloNoDisponible, RespuestaIncompleta, type Generador, type NombreProveedor, type Proveedor } from './tipos.ts';
import { ollama } from './ollama.ts';
import { claude } from './claude.ts';
import { chatgpt } from './chatgpt.ts';
import { crearVortice, POLITICA_VORTICE_DEFECTO } from '../vortice/router.ts';
import type { RegistroRuta } from '../vortice/tipos.ts';
import { registrar } from '../supervisor.ts';

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

/** La puerta única de coste: una clave configura, pero nunca autoriza gastar. */
export function apiPagadaPermitida(valor = process.env.ATLAS_PERMITIR_API_PAGADA): boolean {
  return valor === 'true';
}

/** Clasificación estable para salida y registro; nunca propaga texto remoto. */
export function clasificarErrorProveedor(error: unknown): string {
  if (error instanceof RespuestaIncompleta) return 'respuesta_incompleta';
  if (error instanceof ModeloNoDisponible) return 'no_disponible';
  return 'error_no_recuperable';
}

/** Proveedores configurados y listos, en orden de preferencia. */
export function proveedoresDisponibles(orden = ordenConfigurado()): Proveedor[] {
  // Una clave presente solo configura el proveedor: no autoriza gastar API.
  // Esto protege la ruta histórica mientras El Vórtice se adopta encima del
  // contrato Generador.
  const permiso = apiPagadaPermitida();
  return orden.map((n) => PROVEEDORES[n])
    .filter((p) => p.local || permiso)
    .filter((p) => p.disponible());
}

export function politicaVorticeDesdeEntorno() {
  const orden = ordenConfigurado();
  return {
    ...POLITICA_VORTICE_DEFECTO,
    apiPagadaPermitida: apiPagadaPermitida(),
    ordenSencilla: orden,
    ordenCompleja: orden,
  };
}

function registrarDecisionVortice(evento: RegistroRuta): void {
  registrar(process.env.ATLAS_REGISTRO ?? 'datos/registro.jsonl', {
    tipo: evento.resultado === 'exito' ? 'resultado' : 'error',
    nivel: evento.resultado === 'exito' ? 'verde' : 'amarillo',
    descripcion: `Vórtice: ${evento.proveedor} ${evento.resultado}`,
    entrada: { proveedor: evento.proveedor, razon: evento.razon, coste: evento.coste, api_pagada: evento.api_pagada },
    salida: { resultado: evento.resultado, tipo_error: evento.tipo_error ?? null, fallback_utilizado: evento.fallback_utilizado },
    duracion_ms: evento.duracion_ms,
    veredicto: evento.resultado === 'exito' ? 'exito' : 'fallo',
    razon: evento.tipo_error ?? evento.razon,
  });
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

  for (const proveedor of candidatos) {
    try {
      return await proveedor.generar(sistema, usuario);
    } catch (e) {
      if (!(e instanceof ModeloNoDisponible)) throw e;

      const quedan = candidatos.indexOf(proveedor) < candidatos.length - 1;
      if (quedan) console.error(`⚠️  ${proveedor.nombre} no disponible, probando el siguiente…`);
    }
  }

  throw new ModeloNoDisponible('Ningún proveedor pudo responder. Revisa la configuración o disponibilidad del proveedor.');
}

/** El generador que usa Atlas: la cascada sobre los proveedores configurados. */
export const generar: Generador = (sistema, usuario) =>
  crearVortice(PROVEEDORES, politicaVorticeDesdeEntorno(), registrarDecisionVortice).generador()(sistema, usuario);

/** Proveedor que Atlas usaría ahora mismo. Para mostrarlo, no para decidir. */
export function proveedorActivo(): Proveedor | null {
  return proveedoresDisponibles()[0] ?? null;
}
