// Memoria persistente de Atlas (V0.3 de la ruta de versiones)
//
// Usa el SQLite que trae Node 22 de serie: sin dependencias, como el resto.
//
// Reglas del documento maestro que este archivo hace cumplir:
//   - la memoria está dividida en cinco espacios que no se mezclan
//   - cada recuerdo lleva origen, fecha, confianza y estado
//   - una deducción se marca como deducción, nunca como hecho
//   - las contradicciones se muestran, no se ocultan
//   - jamás se guardan contraseñas, claves ni tokens
//   - olvidar es una orden de Luis, y deja rastro

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Los cinco espacios. Un resultado ficticio de trading no puede acabar en personal. */
export const ESPACIOS = ['personal', 'programacion', 'trading', 'simulaciones', 'sistema'] as const;
export type Espacio = (typeof ESPACIOS)[number];

export type Origen = 'hecho' | 'deduccion';
export type Estado = 'vigente' | 'olvidado' | 'superado';

export interface Recuerdo {
  id: number;
  espacio: Espacio;
  clave: string;
  resumen: string;
  origen: Origen;
  fuente: string;
  confianza: number;      // 0 a 1
  estado: Estado;
  objetivo: string | null;
  fecha: string;
}

export interface Nuevo {
  espacio: Espacio;
  clave: string;
  resumen: string;
  origen?: Origen;
  fuente: string;
  confianza?: number;
  objetivo?: string | null;
}

/** Nunca entran a la memoria, igual que nunca entran al registro. */
const SECRETOS = [
  /\b(contraseña|password|passwd)\b/i,
  /\b(api[-_ ]?key|token|secret|credencial)\b/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

export class SecretoRechazado extends Error {}
export class EspacioInvalido extends Error {}

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS recuerdos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  espacio   TEXT    NOT NULL,
  clave     TEXT    NOT NULL,
  resumen   TEXT    NOT NULL,
  origen    TEXT    NOT NULL DEFAULT 'hecho',
  fuente    TEXT    NOT NULL,
  confianza REAL    NOT NULL DEFAULT 1.0,
  estado    TEXT    NOT NULL DEFAULT 'vigente',
  objetivo  TEXT,
  fecha     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clave   ON recuerdos(espacio, clave);
CREATE INDEX IF NOT EXISTS idx_objetivo ON recuerdos(objetivo);
`;

export class Memoria {
  private db: DatabaseSync;

  constructor(ruta = 'datos/memoria.db') {
    if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });
    this.db = new DatabaseSync(ruta);
    this.db.exec(ESQUEMA);
  }

  cerrar(): void { this.db.close(); }

  /**
   * Guarda un recuerdo.
   * Si ya existe uno vigente con la misma clave y distinto resumen, el anterior
   * NO se borra: se marca 'superado'. La historia se conserva.
   */
  recordar(nuevo: Nuevo): Recuerdo {
    if (!(ESPACIOS as readonly string[]).includes(nuevo.espacio)) {
      throw new EspacioInvalido(`Espacio desconocido: ${nuevo.espacio}`);
    }
    for (const patron of SECRETOS) {
      if (patron.test(nuevo.resumen)) {
        throw new SecretoRechazado('La memoria no guarda contraseñas, claves ni tokens.');
      }
    }

    const previos = this.consultar({ espacio: nuevo.espacio, clave: nuevo.clave });
    for (const viejo of previos) {
      if (viejo.resumen !== nuevo.resumen) {
        this.db.prepare('UPDATE recuerdos SET estado = ? WHERE id = ?').run('superado', viejo.id);
      }
    }

    const fecha = new Date().toISOString();
    const r = this.db.prepare(
      `INSERT INTO recuerdos (espacio, clave, resumen, origen, fuente, confianza, estado, objetivo, fecha)
       VALUES (?, ?, ?, ?, ?, ?, 'vigente', ?, ?)`,
    ).run(
      nuevo.espacio, nuevo.clave, nuevo.resumen,
      nuevo.origen ?? 'hecho', nuevo.fuente,
      nuevo.confianza ?? 1.0, nuevo.objetivo ?? null, fecha,
    );

    return this.porId(Number(r.lastInsertRowid))!;
  }

  porId(id: number): Recuerdo | null {
    const fila = this.db.prepare('SELECT * FROM recuerdos WHERE id = ?').get(id);
    return (fila as Recuerdo | undefined) ?? null;
  }

  /** Consulta recuerdos vigentes, salvo que se pida otro estado. */
  consultar(filtro: { espacio?: Espacio; clave?: string; objetivo?: string; texto?: string; estado?: Estado } = {}): Recuerdo[] {
    const donde: string[] = [];
    const valores: unknown[] = [];

    donde.push('estado = ?');
    valores.push(filtro.estado ?? 'vigente');

    if (filtro.espacio)  { donde.push('espacio = ?');  valores.push(filtro.espacio); }
    if (filtro.clave)    { donde.push('clave = ?');    valores.push(filtro.clave); }
    if (filtro.objetivo) { donde.push('objetivo = ?'); valores.push(filtro.objetivo); }
    if (filtro.texto)    { donde.push('(resumen LIKE ? OR clave LIKE ?)'); valores.push(`%${filtro.texto}%`, `%${filtro.texto}%`); }

    return this.db.prepare(
      `SELECT * FROM recuerdos WHERE ${donde.join(' AND ')} ORDER BY id DESC`,
    ).all(...valores as never[]) as unknown as Recuerdo[];
  }

  /**
   * Recuerdos que se contradicen: misma clave, resúmenes distintos, todos
   * vigentes. No se resuelve automáticamente — se muestra para que decidas.
   */
  contradicciones(): { espacio: string; clave: string; versiones: Recuerdo[] }[] {
    const claves = this.db.prepare(
      `SELECT espacio, clave FROM recuerdos WHERE estado = 'vigente'
       GROUP BY espacio, clave HAVING COUNT(DISTINCT resumen) > 1`,
    ).all() as unknown as { espacio: Espacio; clave: string }[];

    return claves.map((c) => ({
      espacio: c.espacio,
      clave: c.clave,
      versiones: this.consultar({ espacio: c.espacio, clave: c.clave }),
    }));
  }

  /** Olvidar es una orden explícita. El recuerdo se marca, no se borra a escondidas. */
  olvidar(id: number): boolean {
    const r = this.db.prepare(`UPDATE recuerdos SET estado = 'olvidado' WHERE id = ? AND estado != 'olvidado'`).run(id);
    return Number(r.changes) > 0;
  }

  /** Borrado definitivo. Solo para cuando Luis pide que no quede rastro. */
  borrarDeVerdad(id: number): boolean {
    const r = this.db.prepare('DELETE FROM recuerdos WHERE id = ?').run(id);
    return Number(r.changes) > 0;
  }

  /** Todo lo que sabe, para exportar. El usuario siempre puede llevarse su memoria. */
  exportar(): Recuerdo[] {
    return this.db.prepare('SELECT * FROM recuerdos ORDER BY id').all() as unknown as Recuerdo[];
  }

  resumen(): Record<string, number> {
    const filas = this.db.prepare(
      `SELECT espacio, COUNT(*) AS n FROM recuerdos WHERE estado = 'vigente' GROUP BY espacio`,
    ).all() as unknown as { espacio: string; n: number }[];
    return Object.fromEntries(filas.map((f) => [f.espacio, Number(f.n)]));
  }
}

// ── Atajos para lo que Atlas usa a diario ──────────────────────────────────

/** Guarda cómo terminó un objetivo, para no repetir errores. */
export function recordarResultado(
  m: Memoria,
  objetivo: string,
  parada: string,
  detalle: string,
  archivos: string[],
): Recuerdo {
  return m.recordar({
    espacio: 'sistema',
    clave: `objetivo:${objetivo}`,
    resumen: `${parada}. ${detalle}${archivos.length ? ` Archivos: ${archivos.join(', ')}.` : ''}`,
    origen: 'hecho',
    fuente: 'ciclo',
    confianza: 1,
    objetivo,
  });
}

/**
 * Qué sabe Atlas de intentos anteriores de este mismo objetivo.
 * Se le pasa al modelo antes de planear: es lo que evita empezar de cero.
 */
export function contexto(m: Memoria, objetivo: string, maximo = 3): string {
  const previos = m.consultar({ objetivo }).slice(0, maximo);
  if (previos.length === 0) return '';

  const lineas = previos.map((r) => `- ${r.fecha.slice(0, 10)}: ${r.resumen}`).join('\n');
  return `Intentos anteriores de este mismo objetivo:\n${lineas}\n\nTenlos en cuenta: no repitas lo que ya falló.`;
}
