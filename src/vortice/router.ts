// El Vórtice decide rutas. Los proveedores siguen cumpliendo Generador y los
// consumidores existentes no necesitan saber que existe este Router.

import {
  ModeloNoDisponible,
  RespuestaIncompleta,
  type Generador,
  type NombreProveedor,
  type Proveedor,
} from '../proveedores/tipos.ts';
import type {
  DecisionRuta,
  NivelCoste,
  PoliticaVortice,
  RazonRuta,
  RegistroRuta,
  SolicitudIA,
  TipoErrorRuta,
  Vortice,
} from './tipos.ts';
import { ContextoNoReducible, prepararContexto, type FuenteContexto, type PresupuestoContexto } from './contexto.ts';

export const POLITICA_VORTICE_DEFECTO: PoliticaVortice = {
  apiPagadaPermitida: false,
  ordenSencilla: ['ollama', 'claude', 'chatgpt'],
  ordenCompleja: ['claude', 'chatgpt', 'ollama'],
};

export const SOLICITUD_GENERICA: SolicitudIA = {
  tipo: 'general', complejidad: 'baja', riesgo: 'bajo',
};

function coste(proveedor: Proveedor): NivelCoste {
  return proveedor.local ? 'local' : 'api_pagada';
}

function ordenPara(solicitud: SolicitudIA, politica: PoliticaVortice): NombreProveedor[] {
  return solicitud.complejidad === 'alta' || solicitud.riesgo === 'alto'
    ? politica.ordenCompleja
    : politica.ordenSencilla;
}

function esPermitido(proveedor: Proveedor, politica: PoliticaVortice): boolean {
  return proveedor.local || politica.apiPagadaPermitida;
}

function tipoError(error: unknown): TipoErrorRuta {
  if (error instanceof RespuestaIncompleta) return 'respuesta_incompleta';
  if (error instanceof ModeloNoDisponible) return 'no_disponible';
  return 'no_recuperable';
}

/** Crea un Router aislado e inyectable. No persiste prompts, respuestas,
 * errores crudos ni secretos; quien necesite auditar recibe solo RegistroRuta. */
export function crearVortice(
  proveedores: Record<NombreProveedor, Proveedor>,
  politica: PoliticaVortice = POLITICA_VORTICE_DEFECTO,
  registrar: (evento: RegistroRuta) => void = () => {},
): Vortice {
  const candidatos = (solicitud: SolicitudIA): Proveedor[] =>
    ordenPara(solicitud, politica)
      .map((nombre) => proveedores[nombre])
      .filter((proveedor): proveedor is Proveedor => Boolean(proveedor))
      .filter((proveedor) => esPermitido(proveedor, politica))
      .filter((proveedor) => proveedor.disponible());

  const decidir = (solicitud: SolicitudIA): DecisionRuta => {
    const proveedor = candidatos(solicitud)[0] ?? null;
    if (!proveedor) return { proveedor: null, razon: 'sin_proveedor_permitido', coste: null, api_pagada: false };
    const esLocal = proveedor.local;
    return { proveedor: proveedor.nombre, razon: esLocal ? 'local_disponible' : 'proveedor_permitido',
      coste: coste(proveedor), api_pagada: !esLocal };
  };

  const ejecutar = async (solicitud: SolicitudIA, sistema: string, usuario: string, contexto?: { caracteres: number; tokens_aproximados: number; reducido: boolean; resumen_utilizado: boolean }): Promise<string> => {
    const lista = candidatos(solicitud);
    if (lista.length === 0) throw new ModeloNoDisponible('El Vórtice no encontró un proveedor permitido y disponible.');

    for (let indice = 0; indice < lista.length; indice += 1) {
      const proveedor = lista[indice];
      const razon: RazonRuta = proveedor.local ? 'local_disponible' : 'proveedor_permitido';
      const inicio = Date.now();
      try {
        const respuesta = await proveedor.generar(sistema, usuario);
        registrar({ proveedor: proveedor.nombre, razon, coste: coste(proveedor), api_pagada: !proveedor.local,
          duracion_ms: Date.now() - inicio, resultado: 'exito', fallback_utilizado: indice > 0,
          ...(contexto ? { contexto_caracteres: contexto.caracteres, contexto_tokens_aproximados: contexto.tokens_aproximados,
            contexto_reducido: contexto.reducido, resumen_utilizado: contexto.resumen_utilizado } : {}) });
        return respuesta;
      } catch (error) {
        const clase = tipoError(error);
        registrar({ proveedor: proveedor.nombre, razon, coste: coste(proveedor), api_pagada: !proveedor.local,
          duracion_ms: Date.now() - inicio,
          resultado: clase === 'no_disponible' ? 'no_disponible' : clase === 'respuesta_incompleta' ? 'truncada' : 'error_no_recuperable',
          tipo_error: clase, fallback_utilizado: indice > 0,
          ...(contexto ? { contexto_caracteres: contexto.caracteres, contexto_tokens_aproximados: contexto.tokens_aproximados,
            contexto_reducido: contexto.reducido, resumen_utilizado: contexto.resumen_utilizado } : {}) });
        // Una salida truncada es tamaño/contexto, no indisponibilidad. Un error
        // inesperado tampoco se oculta con un segundo envío que duplicaría trabajo.
        if (!(error instanceof ModeloNoDisponible) || error instanceof RespuestaIncompleta) throw error;
      }
    }
    throw new ModeloNoDisponible('Ningún proveedor permitido pudo responder.');
  };

  const generador = (solicitud: SolicitudIA = SOLICITUD_GENERICA): Generador =>
    (sistema, usuario) => ejecutar(solicitud, sistema, usuario);

  const ejecutarConContexto = async (solicitud: SolicitudIA, sistema: string, fuentes: FuenteContexto[], presupuesto: PresupuestoContexto) => {
    // La llamada final usa sistema + contexto como usuario; ambos cuentan antes
    // de decidir proveedor, con el margen configurado en el presupuesto.
    const contexto = prepararContexto(fuentes, presupuesto, { sistema });
    if (contexto.rechazo) throw new ContextoNoReducible('El contexto no cabe de forma segura en el presupuesto.');
    // La decisión de coste se toma después de reducir, pero sigue pasando por
    // la misma política del Vórtice: reducir no concede permiso de API.
    return { respuesta: await ejecutar(solicitud, sistema, contexto.texto, contexto), contexto };
  };

  return { decidir, ejecutar, ejecutarConContexto, generador };
}
