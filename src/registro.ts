// Registro de Atlas: solo agrega, nunca modifica.
//
// Idea central: cada evento guarda la huella del anterior. Si alguien cambia
// un evento viejo, su huella cambia, y entonces el hash_anterior del siguiente
// ya no coincide. La manipulación se vuelve visible.
//
// Este archivo NO decide si una acción es permitida. Eso es del Supervisor.
// Aquí solo se escribe y se verifica.

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Evento, EventoNuevo, ResultadoAuditoria } from './tipos.ts';

export const GENESIS = 'genesis';

/**
 * Calcula la huella de un evento.
 * Se calcula sobre todos los campos MENOS 'hash' (que es el resultado).
 * El orden de las claves es fijo para que la huella sea reproducible.
 */
export function calcularHash(evento: Omit<Evento, 'hash'>): string {
  const material = JSON.stringify([
    evento.id,
    evento.fecha,
    evento.tarea,
    evento.plan,
    evento.tipo,
    evento.nivel,
    evento.descripcion,
    evento.entrada ?? null,
    evento.salida ?? null,
    evento.duracion_ms,
    evento.veredicto,
    evento.razon,
    evento.hash_anterior,
  ]);
  return createHash('sha256').update(material).digest('hex');
}

/** Lee todos los eventos del archivo. Devuelve [] si no existe. */
export function leerEventos(ruta: string): Evento[] {
  if (!existsSync(ruta)) return [];
  return readFileSync(ruta, 'utf8')
    .split('\n')
    .filter((linea) => linea.trim() !== '')
    .map((linea) => JSON.parse(linea) as Evento);
}

/** Devuelve el último evento, o null si el registro está vacío. */
export function ultimoEvento(ruta: string): Evento | null {
  const eventos = leerEventos(ruta);
  return eventos.length === 0 ? null : eventos[eventos.length - 1]!;
}

/**
 * Agrega un evento al registro y devuelve el evento completo.
 *
 * Se abre el archivo en modo 'append'. No existe ninguna función en este
 * módulo que borre o edite: esa ausencia es intencional y es la garantía.
 */
export function agregar(ruta: string, nuevo: EventoNuevo): Evento {
  mkdirSync(dirname(ruta), { recursive: true });

  const anterior = ultimoEvento(ruta);
  const sinHash: Omit<Evento, 'hash'> = {
    id: anterior ? anterior.id + 1 : 1,
    fecha: new Date().toISOString(),
    hash_anterior: anterior ? anterior.hash : GENESIS,
    ...nuevo,
  };

  const evento: Evento = { ...sinHash, hash: calcularHash(sinHash) };
  appendFileSync(ruta, JSON.stringify(evento) + '\n', 'utf8');
  return evento;
}

/**
 * Recorre la cadena completa y verifica tres cosas en cada evento:
 *   1. que su huella corresponda a su contenido,
 *   2. que apunte a la huella del evento anterior,
 *   3. que los identificadores sean consecutivos.
 */
export function auditar(ruta: string): ResultadoAuditoria {
  if (!existsSync(ruta)) {
    return {
      estado: 'ausente',
      eventos: 0,
      desde: null,
      hasta: null,
      rota_en: null,
      detalle: 'No existe archivo de registro.',
    };
  }

  const eventos = leerEventos(ruta);
  if (eventos.length === 0) {
    return {
      estado: 'ausente',
      eventos: 0,
      desde: null,
      hasta: null,
      rota_en: null,
      detalle: 'El registro existe pero está vacío.',
    };
  }

  let esperadoAnterior = GENESIS;
  let esperadoId = 1;

  for (const evento of eventos) {
    const { hash, ...resto } = evento;

    if (evento.id !== esperadoId) {
      return romper(eventos, evento.id, `Se esperaba el evento ${esperadoId} y se encontró el ${evento.id}. Falta o sobra un evento.`);
    }
    if (evento.hash_anterior !== esperadoAnterior) {
      return romper(eventos, evento.id, `El evento ${evento.id} no apunta al anterior. La cadena fue cortada o reordenada.`);
    }
    if (calcularHash(resto) !== hash) {
      return romper(eventos, evento.id, `El contenido del evento ${evento.id} no coincide con su huella. Fue alterado después de escribirse.`);
    }

    esperadoAnterior = hash;
    esperadoId += 1;
  }

  return {
    estado: 'integra',
    eventos: eventos.length,
    desde: eventos[0]!.fecha,
    hasta: eventos[eventos.length - 1]!.fecha,
    rota_en: null,
    detalle: `Cadena íntegra: ${eventos.length} evento(s) verificado(s).`,
  };
}

function romper(eventos: Evento[], id: number, detalle: string): ResultadoAuditoria {
  const validos = eventos.filter((e) => e.id < id);
  return {
    estado: 'rota',
    eventos: eventos.length,
    desde: eventos[0]!.fecha,
    hasta: validos.length ? validos[validos.length - 1]!.fecha : null,
    rota_en: id,
    detalle,
  };
}
