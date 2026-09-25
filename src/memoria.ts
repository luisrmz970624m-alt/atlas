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
import { estadoSeguro, type Experiencia, type NuevaExperiencia, type EstadoExperiencia } from './vortice/experiencia.ts';

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
  /** Datos estructurados opcionales, en JSON. El resumen sigue siendo legible. */
  datos: string | null;
}

export interface Nuevo {
  espacio: Espacio;
  clave: string;
  resumen: string;
  origen?: Origen;
  fuente: string;
  confianza?: number;
  objetivo?: string | null;
  datos?: unknown;
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
  fecha     TEXT    NOT NULL,
  datos     TEXT
);
CREATE INDEX IF NOT EXISTS idx_clave   ON recuerdos(espacio, clave);
CREATE INDEX IF NOT EXISTS idx_objetivo ON recuerdos(objetivo);
CREATE TABLE IF NOT EXISTS experiencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL, dominio TEXT NOT NULL,
  hipotesis TEXT NOT NULL, evidencia TEXT NOT NULL, resultado TEXT NOT NULL,
  reglas_cumplidas TEXT NOT NULL, reglas_rotas TEXT NOT NULL, confianza REAL NOT NULL,
  fuente TEXT NOT NULL, estado TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_experiencias_dominio ON experiencias(dominio, estado);
CREATE TABLE IF NOT EXISTS resumenes_contexto (
  id TEXT NOT NULL, version INTEGER NOT NULL, origen TEXT NOT NULL,
  texto TEXT NOT NULL, fuentes TEXT NOT NULL, fecha TEXT NOT NULL
  , PRIMARY KEY (id, version)
);
`;

export class Memoria {
  private db: DatabaseSync;

  constructor(ruta = 'datos/memoria.db') {
    if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });
    this.db = new DatabaseSync(ruta);
    this.db.exec(ESQUEMA);

    // B.1: el esquema anterior tenía id como PK y reemplazaba el historial.
    // La reconstrucción es aditiva: copia cada fila antes de retirar la tabla vieja.
    const resumenes = this.db.prepare('PRAGMA table_info(resumenes_contexto)').all() as unknown as { name: string; pk: number }[];
    if (resumenes.find((c) => c.name === 'id')?.pk === 1) {
      this.db.exec(`BEGIN;
        ALTER TABLE resumenes_contexto RENAME TO resumenes_contexto_pre_b1;
        CREATE TABLE resumenes_contexto (id TEXT NOT NULL, version INTEGER NOT NULL, origen TEXT NOT NULL, texto TEXT NOT NULL, fuentes TEXT NOT NULL, fecha TEXT NOT NULL, PRIMARY KEY (id, version));
        INSERT INTO resumenes_contexto SELECT id, version, origen, texto, fuentes, fecha FROM resumenes_contexto_pre_b1;
        DROP TABLE resumenes_contexto_pre_b1;
        COMMIT;`);
    }
    this.db.exec('PRAGMA user_version = 2');

    // Bases creadas antes de que existiera 'datos' siguen funcionando.
    const columnas = this.db.prepare('PRAGMA table_info(recuerdos)').all() as unknown as { name: string }[];
    if (!columnas.some((c) => c.name === 'datos')) {
      this.db.exec('ALTER TABLE recuerdos ADD COLUMN datos TEXT');
    }
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
      `INSERT INTO recuerdos (espacio, clave, resumen, origen, fuente, confianza, estado, objetivo, fecha, datos)
       VALUES (?, ?, ?, ?, ?, ?, 'vigente', ?, ?, ?)`,
    ).run(
      nuevo.espacio, nuevo.clave, nuevo.resumen,
      nuevo.origen ?? 'hecho', nuevo.fuente,
      nuevo.confianza ?? 1.0, nuevo.objetivo ?? null, fecha,
      nuevo.datos === undefined ? null : JSON.stringify(nuevo.datos),
    );

    return this.porId(Number(r.lastInsertRowid))!;
  }

  /** Lee los datos estructurados de un recuerdo, si los tiene. */
  static datosDe<T>(r: Recuerdo | null): T | null {
    if (!r?.datos) return null;
    try { return JSON.parse(r.datos) as T; } catch { return null; }
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

  guardarExperiencia(nueva: NuevaExperiencia & { estado: EstadoExperiencia }): Experiencia {
    if (!nueva.dominio || !nueva.hipotesis || !nueva.evidencia || !nueva.fuente || nueva.confianza < 0 || nueva.confianza > 1) throw new Error('Experiencia inválida.');
    const fecha = new Date().toISOString();
    const r = this.db.prepare(`INSERT INTO experiencias (fecha, dominio, hipotesis, evidencia, resultado, reglas_cumplidas, reglas_rotas, confianza, fuente, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(fecha, nueva.dominio, nueva.hipotesis, nueva.evidencia, nueva.resultado, JSON.stringify(nueva.reglas_cumplidas), JSON.stringify(nueva.reglas_rotas), nueva.confianza, nueva.fuente, estadoSeguro(nueva));
    return this.experienciaPorId(Number(r.lastInsertRowid))!;
  }

  experienciaPorId(id: number): Experiencia | null {
    const fila = this.db.prepare('SELECT * FROM experiencias WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!fila) return null;
    return { ...fila, reglas_cumplidas: JSON.parse(String(fila.reglas_cumplidas)), reglas_rotas: JSON.parse(String(fila.reglas_rotas)) } as Experiencia;
  }

  buscarExperiencias(filtro: { dominio: string; texto?: string; maximo?: number }): Experiencia[] {
    const texto = filtro.texto ? `%${filtro.texto}%` : '%';
    const filas = this.db.prepare(`SELECT * FROM experiencias WHERE dominio = ? AND estado != 'descartada' AND (hipotesis LIKE ? OR evidencia LIKE ? OR resultado LIKE ?) ORDER BY id DESC LIMIT ?`).all(filtro.dominio, texto, texto, texto, filtro.maximo ?? 3) as Record<string, unknown>[];
    return filas.map((fila) => ({ ...fila, reglas_cumplidas: JSON.parse(String(fila.reglas_cumplidas)), reglas_rotas: JSON.parse(String(fila.reglas_rotas)) } as Experiencia));
  }

  guardarResumenContexto(resumen: { id: string; version: number; origen: string; texto: string; fuentes: string[] }): void {
    const ultimo = this.obtenerResumenContexto(resumen.id);
    if (!Number.isInteger(resumen.version) || resumen.version < 1) throw new Error('Versión de resumen inválida.');
    if (ultimo && resumen.version <= ultimo.version) throw new Error('La versión del resumen no puede retroceder ni sobrescribirse.');
    this.db.prepare(`INSERT INTO resumenes_contexto (id, version, origen, texto, fuentes, fecha) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(resumen.id, resumen.version, resumen.origen, resumen.texto, JSON.stringify(resumen.fuentes), new Date().toISOString());
  }

  obtenerResumenContexto(id: string, version?: number): { id: string; version: number; origen: string; texto: string; fuentes: string[]; fecha: string } | null {
    const fila = version === undefined
      ? this.db.prepare('SELECT * FROM resumenes_contexto WHERE id = ? ORDER BY version DESC LIMIT 1').get(id)
      : this.db.prepare('SELECT * FROM resumenes_contexto WHERE id = ? AND version = ?').get(id, version);
    return fila ? { ...fila, fuentes: JSON.parse(String(fila.fuentes)) } as { id: string; version: number; origen: string; texto: string; fuentes: string[]; fecha: string } : null;
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
