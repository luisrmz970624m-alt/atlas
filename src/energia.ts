import Database from 'better-sqlite3';

export interface EstadoEnergia {
  fecha: string;           // YYYY-MM-DD
  energia_total: number;   // 100 por día
  energia_usada: number;
  energia_disponible: number;

  asignacion: {
    estudiar: number;      // %
    minar: number;         // %
    tradear: number;       // %
  };

  actividades: {
    estudios_completados: number;
    bloques_minados: number;
    trades_ejecutados: number;
  };
}

export interface RegistroEnergia {
  timestamp: string;
  actividad: 'estudiar' | 'minar' | 'tradear';
  energia_consumida: number;
  resultado: Record<string, unknown>;
}

export class GestorEnergia {
  private db: Database.Database;
  private energia_diaria = 100;

  constructor(db_path: string = 'datos/atlas.db') {
    this.db = new Database(db_path);
    this.inicializar_schema();
  }

  private inicializar_schema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS energia_estado (
        id TEXT PRIMARY KEY,
        fecha TEXT UNIQUE,
        energia_total REAL,
        energia_usada REAL,
        asignacion_estudiar REAL,
        asignacion_minar REAL,
        asignacion_tradear REAL,
        estudios_completados INTEGER DEFAULT 0,
        bloques_minados INTEGER DEFAULT 0,
        trades_ejecutados INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS energia_registro (
        id TEXT PRIMARY KEY,
        fecha TEXT,
        actividad TEXT,
        energia_consumida REAL,
        resultado TEXT,
        timestamp TEXT
      );
    `);

    // Crear estado para hoy si no existe
    const hoy = new Date().toISOString().split('T')[0];
    const existe = this.db.prepare(
      'SELECT * FROM energia_estado WHERE fecha = ?'
    ).get(hoy);

    if (!existe) {
      const ahora = new Date().toISOString();
      const id = `energia-${hoy}`;
      this.db.prepare(`
        INSERT INTO energia_estado (
          id, fecha, energia_total, energia_usada,
          asignacion_estudiar, asignacion_minar, asignacion_tradear,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, hoy, this.energia_diaria, 0, 40, 30, 30, ahora, ahora);
    }
  }

  obtener_estado_hoy(): EstadoEnergia {
    const hoy = new Date().toISOString().split('T')[0];
    const stmt = this.db.prepare(
      'SELECT * FROM energia_estado WHERE fecha = ?'
    );
    const row = stmt.get(hoy) as any;

    if (!row) throw new Error('No hay estado de energía para hoy');

    return {
      fecha: row.fecha,
      energia_total: row.energia_total,
      energia_usada: row.energia_usada,
      energia_disponible: row.energia_total - row.energia_usada,
      asignacion: {
        estudiar: row.asignacion_estudiar,
        minar: row.asignacion_minar,
        tradear: row.asignacion_tradear,
      },
      actividades: {
        estudios_completados: row.estudios_completados,
        bloques_minados: row.bloques_minados,
        trades_ejecutados: row.trades_ejecutados,
      },
    };
  }

  establecer_asignacion(estudiar: number, minar: number, tradear: number) {
    if (estudiar + minar + tradear !== 100) {
      throw new Error('La asignación debe sumar 100%');
    }

    const hoy = new Date().toISOString().split('T')[0];
    const ahora = new Date().toISOString();

    this.db.prepare(`
      UPDATE energia_estado
      SET asignacion_estudiar = ?, asignacion_minar = ?, asignacion_tradear = ?,
          updated_at = ?
      WHERE fecha = ?
    `).run(estudiar, minar, tradear, ahora, hoy);
  }

  consumir_energia(
    actividad: 'estudiar' | 'minar' | 'tradear',
    cantidad: number,
    resultado: Record<string, unknown>
  ): boolean {
    const hoy = new Date().toISOString().split('T')[0];
    const estado = this.obtener_estado_hoy();

    if (estado.energia_disponible < cantidad) {
      return false; // Sin energía suficiente
    }

    const ahora = new Date().toISOString();
    const id_registro = `energia-${hoy}-${Date.now()}`;

    // Registrar consumo
    this.db.prepare(`
      INSERT INTO energia_registro (id, fecha, actividad, energia_consumida, resultado, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id_registro,
      hoy,
      actividad,
      cantidad,
      JSON.stringify(resultado),
      ahora
    );

    // Actualizar energía usada
    const nueva_usada = estado.energia_usada + cantidad;
    const campo_actividad =
      actividad === 'estudiar' ? 'estudios_completados' :
      actividad === 'minar' ? 'bloques_minados' : 'trades_ejecutados';

    this.db.prepare(`
      UPDATE energia_estado
      SET energia_usada = ?, ${campo_actividad} = ${campo_actividad} + 1, updated_at = ?
      WHERE fecha = ?
    `).run(nueva_usada, ahora, hoy);

    return true;
  }

  obtener_energia_asignada(actividad: 'estudiar' | 'minar' | 'tradear'): number {
    const estado = this.obtener_estado_hoy();
    const pct = estado.asignacion[actividad];
    return (pct / 100) * (estado.energia_total - estado.energia_usada);
  }

  obtener_registro_hoy(): RegistroEnergia[] {
    const hoy = new Date().toISOString().split('T')[0];
    const stmt = this.db.prepare(
      'SELECT * FROM energia_registro WHERE fecha = ? ORDER BY timestamp DESC'
    );
    const rows = stmt.all(hoy) as any[];

    return rows.map(row => ({
      timestamp: row.timestamp,
      actividad: row.actividad,
      energia_consumida: row.energia_consumida,
      resultado: JSON.parse(row.resultado),
    }));
  }

  resetear_energia_manana() {
    const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const ahora = new Date().toISOString();
    const id = `energia-${manana}`;

    const existe = this.db.prepare(
      'SELECT * FROM energia_estado WHERE fecha = ?'
    ).get(manana);

    if (!existe) {
      this.db.prepare(`
        INSERT INTO energia_estado (
          id, fecha, energia_total, energia_usada,
          asignacion_estudiar, asignacion_minar, asignacion_tradear,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, manana, this.energia_diaria, 0, 40, 30, 30, ahora, ahora);
    }
  }

  cerrar() {
    this.db.close();
  }
}
