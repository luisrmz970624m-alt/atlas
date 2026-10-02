import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface Sesion {
  telefono: string;
  nombre: string;
  contexto: string;
  ultimo_mensaje: number;
  created_at: number;
}

export type Contexto = 'menu' | 'curso' | 'trading' | 'empresa' | 'ayuda';

export interface EstadoSesion {
  contexto: Contexto;
  datos: Record<string, unknown>;
}

const ESTADO_INICIAL: EstadoSesion = { contexto: 'menu', datos: {} };

export class SesionesWhatsApp {
  private db: DatabaseSync;

  constructor(dbPath: string = 'datos/whatsapp-sesiones.db') {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sesiones (
        telefono TEXT PRIMARY KEY,
        nombre TEXT NOT NULL DEFAULT 'Desconocido',
        contexto TEXT NOT NULL DEFAULT '${JSON.stringify(ESTADO_INICIAL)}',
        ultimo_mensaje INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0
      )
    `);
  }

  obtener(telefono: string): EstadoSesion {
    const row = this.db.prepare('SELECT contexto FROM sesiones WHERE telefono = ?').get(telefono) as { contexto: string } | undefined;
    if (!row) return { ...ESTADO_INICIAL };
    try {
      return JSON.parse(row.contexto) as EstadoSesion;
    } catch {
      return { ...ESTADO_INICIAL };
    }
  }

  guardar(telefono: string, nombre: string, estado: EstadoSesion): void {
    const ahora = Math.floor(Date.now() / 1000);
    this.db.prepare(`
      INSERT INTO sesiones (telefono, nombre, contexto, ultimo_mensaje, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(telefono) DO UPDATE SET
        nombre = excluded.nombre,
        contexto = excluded.contexto,
        ultimo_mensaje = excluded.ultimo_mensaje
    `).run(telefono, nombre, JSON.stringify(estado), ahora, ahora);
  }

  resetear(telefono: string): void {
    this.db.prepare('UPDATE sesiones SET contexto = ? WHERE telefono = ?')
      .run(JSON.stringify(ESTADO_INICIAL), telefono);
  }

  listar(): Sesion[] {
    return this.db.prepare('SELECT * FROM sesiones ORDER BY ultimo_mensaje DESC').all() as Sesion[];
  }

  close(): void {
    this.db.close();
  }
}
