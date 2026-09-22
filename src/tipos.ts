// Tipos compartidos de Atlas V0.1
// Aquí solo se describe la FORMA de los datos. No hay lógica.

/** Nivel de seguridad que asigna el Supervisor a cada acción. */
export type Nivel = 'verde' | 'amarillo' | 'rojo';

/** Qué clase de cosa ocurrió. */
export type TipoEvento =
  | 'decision'
  | 'accion'
  | 'resultado'
  | 'error'
  | 'aprobacion'
  | 'detencion'
  | 'sistema';

/** Cómo terminó algo. */
export type Veredicto = 'exito' | 'fallo' | 'indeterminado';

/**
 * Un evento del registro.
 * Una vez escrito NO se modifica nunca. Para corregirlo se escribe otro evento.
 */
export interface Evento {
  id: number;
  fecha: string;          // ISO 8601 con zona horaria
  tarea: string | null;   // a qué tarea pertenece, si aplica
  plan: number | null;    // versión del plan
  tipo: TipoEvento;
  nivel: Nivel;
  descripcion: string;
  entrada: unknown;       // qué recibió
  salida: unknown;        // qué devolvió (o el error)
  duracion_ms: number | null;
  veredicto: Veredicto | null;
  razon: string | null;   // por qué ese veredicto
  hash_anterior: string;  // huella del evento previo ('genesis' en el primero)
  hash: string;           // huella de este evento
}

/** Lo que entrega quien quiere registrar algo. El resto lo pone el registro. */
export type EventoNuevo = Omit<Evento, 'id' | 'fecha' | 'hash_anterior' | 'hash'>;

/** Resultado de auditar la cadena. */
export interface ResultadoAuditoria {
  estado: 'integra' | 'rota' | 'ausente';
  eventos: number;
  desde: string | null;
  hasta: string | null;
  rota_en: number | null;     // id del primer evento inválido
  detalle: string;
}
