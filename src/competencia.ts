import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface ResultadoDiario {
  fecha: string;
  usuario_ganancia: number;
  usuario_porcentaje: number;
  atlas_ganancia: number;
  atlas_porcentaje: number;
  ganador: 'usuario' | 'atlas' | 'empate';
  diferencia: number;
}

export interface EstadisticasCompetencia {
  dias_jugados: number;
  usuario_ganancias: number;
  atlas_ganancias: number;
  usuario_win_days: number;
  atlas_win_days: number;
  empates: number;

  promedio_ganancia_usuario: number;
  promedio_ganancia_atlas: number;

  mejor_dia_usuario: ResultadoDiario | null;
  mejor_dia_atlas: ResultadoDiario | null;
  peor_dia_usuario: ResultadoDiario | null;
  peor_dia_atlas: ResultadoDiario | null;
}

export interface SnapshotCompetencia {
  timestamp: string;
  usuario: {
    capital: number;
    ganancia: number;
    ganancia_porcentaje: number;
    trades: number;
    win_rate: number;
  };
  atlas: {
    capital: number;
    ganancia: number;
    ganancia_porcentaje: number;
    trades_total: number;
    bots_activos: number;
    win_rate_promedio: number;
  };
  diferencia: number;          // En USD a favor de Atlas (negativo = usuario gana)
  lider: 'usuario' | 'atlas' | 'empate';
}

export class GestorCompetencia {
  private db: Database.Database;

  constructor(db_path: string = 'datos/atlas.db') {
    this.db = new Database(db_path);
    this.inicializar_schema();
  }

  private inicializar_schema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS competencia_resultados (
        id TEXT PRIMARY KEY,
        fecha TEXT UNIQUE,
        usuario_ganancia REAL,
        usuario_porcentaje REAL,
        atlas_ganancia REAL,
        atlas_porcentaje REAL,
        ganador TEXT,
        diferencia REAL,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS competencia_snapshots (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        usuario_capital REAL,
        usuario_ganancia REAL,
        usuario_porcentaje REAL,
        usuario_trades INTEGER,
        usuario_win_rate REAL,
        atlas_capital REAL,
        atlas_ganancia REAL,
        atlas_porcentaje REAL,
        atlas_trades INTEGER,
        atlas_bots_activos INTEGER,
        atlas_win_rate REAL,
        lider TEXT
      );
    `);
  }

  /**
   * Registrar resultado diario de competencia
   */
  registrar_resultado_diario(
    usuario_ganancia: number,
    usuario_capital_inicial: number,
    atlas_ganancia: number,
    atlas_capital_inicial: number
  ) {
    const hoy = new Date().toISOString().split('T')[0];
    const ahora = new Date().toISOString();

    const usuario_pct = (usuario_ganancia / usuario_capital_inicial) * 100;
    const atlas_pct = (atlas_ganancia / atlas_capital_inicial) * 100;

    let ganador: 'usuario' | 'atlas' | 'empate';
    if (usuario_ganancia > atlas_ganancia) ganador = 'usuario';
    else if (atlas_ganancia > usuario_ganancia) ganador = 'atlas';
    else ganador = 'empate';

    const diferencia = usuario_ganancia - atlas_ganancia;

    const id = randomUUID();
    this.db.prepare(`
      INSERT OR REPLACE INTO competencia_resultados
      (id, fecha, usuario_ganancia, usuario_porcentaje, atlas_ganancia, atlas_porcentaje, ganador, diferencia, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      hoy,
      usuario_ganancia,
      usuario_pct,
      atlas_ganancia,
      atlas_pct,
      ganador,
      diferencia,
      ahora
    );
  }

  /**
   * Tomar snapshot actual de competencia
   */
  crear_snapshot(
    usuario_capital: number,
    usuario_ganancia: number,
    usuario_trades: number,
    usuario_win_rate: number,
    atlas_capital: number,
    atlas_ganancia: number,
    atlas_trades: number,
    atlas_bots_activos: number,
    atlas_win_rate: number
  ): SnapshotCompetencia {
    const ahora = new Date().toISOString();
    const id = randomUUID();

    const usuario_pct = (usuario_ganancia / usuario_capital) * 100;
    const atlas_pct = (atlas_ganancia / atlas_capital) * 100;

    let lider: 'usuario' | 'atlas' | 'empate';
    if (usuario_ganancia > atlas_ganancia) lider = 'usuario';
    else if (atlas_ganancia > usuario_ganancia) lider = 'atlas';
    else lider = 'empate';

    const diferencia = usuario_ganancia - atlas_ganancia;

    this.db.prepare(`
      INSERT INTO competencia_snapshots
      (id, timestamp, usuario_capital, usuario_ganancia, usuario_porcentaje, usuario_trades, usuario_win_rate,
       atlas_capital, atlas_ganancia, atlas_porcentaje, atlas_trades, atlas_bots_activos, atlas_win_rate, lider)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      ahora,
      usuario_capital,
      usuario_ganancia,
      usuario_pct,
      usuario_trades,
      usuario_win_rate,
      atlas_capital,
      atlas_ganancia,
      atlas_pct,
      atlas_trades,
      atlas_bots_activos,
      atlas_win_rate,
      lider
    );

    return {
      timestamp: ahora,
      usuario: {
        capital: usuario_capital,
        ganancia: usuario_ganancia,
        ganancia_porcentaje: usuario_pct,
        trades: usuario_trades,
        win_rate: usuario_win_rate,
      },
      atlas: {
        capital: atlas_capital,
        ganancia: atlas_ganancia,
        ganancia_porcentaje: atlas_pct,
        trades_total: atlas_trades,
        bots_activos: atlas_bots_activos,
        win_rate_promedio: atlas_win_rate,
      },
      diferencia,
      lider,
    };
  }

  /**
   * Obtener estadísticas generales de competencia
   */
  obtener_estadisticas(dias_atras: number = 30): EstadisticasCompetencia {
    const fecha_limite = new Date(Date.now() - dias_atras * 86400000).toISOString().split('T')[0];

    const resultados = this.db.prepare(`
      SELECT * FROM competencia_resultados WHERE fecha >= ?
      ORDER BY fecha ASC
    `).all(fecha_limite) as any[];

    if (resultados.length === 0) {
      return {
        dias_jugados: 0,
        usuario_ganancias: 0,
        atlas_ganancias: 0,
        usuario_win_days: 0,
        atlas_win_days: 0,
        empates: 0,
        promedio_ganancia_usuario: 0,
        promedio_ganancia_atlas: 0,
        mejor_dia_usuario: null,
        mejor_dia_atlas: null,
        peor_dia_usuario: null,
        peor_dia_atlas: null,
      };
    }

    let usuario_ganancias = 0;
    let atlas_ganancias = 0;
    let usuario_win_days = 0;
    let atlas_win_days = 0;
    let empates = 0;

    let mejor_usuario: ResultadoDiario | null = null;
    let mejor_atlas: ResultadoDiario | null = null;
    let peor_usuario: ResultadoDiario | null = null;
    let peor_atlas: ResultadoDiario | null = null;

    for (const r of resultados) {
      usuario_ganancias += r.usuario_ganancia;
      atlas_ganancias += r.atlas_ganancia;

      if (r.ganador === 'usuario') usuario_win_days++;
      else if (r.ganador === 'atlas') atlas_win_days++;
      else empates++;

      // Mejor día para usuario
      if (!mejor_usuario || r.usuario_ganancia > mejor_usuario.usuario_ganancia) {
        mejor_usuario = {
          fecha: r.fecha,
          usuario_ganancia: r.usuario_ganancia,
          usuario_porcentaje: r.usuario_porcentaje,
          atlas_ganancia: r.atlas_ganancia,
          atlas_porcentaje: r.atlas_porcentaje,
          ganador: r.ganador,
          diferencia: r.diferencia,
        };
      }

      // Peor día para usuario
      if (!peor_usuario || r.usuario_ganancia < peor_usuario.usuario_ganancia) {
        peor_usuario = {
          fecha: r.fecha,
          usuario_ganancia: r.usuario_ganancia,
          usuario_porcentaje: r.usuario_porcentaje,
          atlas_ganancia: r.atlas_ganancia,
          atlas_porcentaje: r.atlas_porcentaje,
          ganador: r.ganador,
          diferencia: r.diferencia,
        };
      }

      // Mejor día para atlas
      if (!mejor_atlas || r.atlas_ganancia > mejor_atlas.atlas_ganancia) {
        mejor_atlas = {
          fecha: r.fecha,
          usuario_ganancia: r.usuario_ganancia,
          usuario_porcentaje: r.usuario_porcentaje,
          atlas_ganancia: r.atlas_ganancia,
          atlas_porcentaje: r.atlas_porcentaje,
          ganador: r.ganador,
          diferencia: r.diferencia,
        };
      }

      // Peor día para atlas
      if (!peor_atlas || r.atlas_ganancia < peor_atlas.atlas_ganancia) {
        peor_atlas = {
          fecha: r.fecha,
          usuario_ganancia: r.usuario_ganancia,
          usuario_porcentaje: r.usuario_porcentaje,
          atlas_ganancia: r.atlas_ganancia,
          atlas_porcentaje: r.atlas_porcentaje,
          ganador: r.ganador,
          diferencia: r.diferencia,
        };
      }
    }

    return {
      dias_jugados: resultados.length,
      usuario_ganancias,
      atlas_ganancias,
      usuario_win_days,
      atlas_win_days,
      empates,
      promedio_ganancia_usuario: usuario_ganancias / resultados.length,
      promedio_ganancia_atlas: atlas_ganancias / resultados.length,
      mejor_dia_usuario: mejor_usuario,
      mejor_dia_atlas: mejor_atlas,
      peor_dia_usuario: peor_usuario,
      peor_dia_atlas: peor_atlas,
    };
  }

  /**
   * Obtener últimos N snapshots
   */
  obtener_snapshots_recientes(limite: number = 100): SnapshotCompetencia[] {
    const stmt = this.db.prepare(`
      SELECT * FROM competencia_snapshots ORDER BY timestamp DESC LIMIT ?
    `);
    return (stmt.all(limite) as any[]).map(row => ({
      timestamp: row.timestamp,
      usuario: {
        capital: row.usuario_capital,
        ganancia: row.usuario_ganancia,
        ganancia_porcentaje: row.usuario_porcentaje,
        trades: row.usuario_trades,
        win_rate: row.usuario_win_rate,
      },
      atlas: {
        capital: row.atlas_capital,
        ganancia: row.atlas_ganancia,
        ganancia_porcentaje: row.atlas_porcentaje,
        trades_total: row.atlas_trades,
        bots_activos: row.atlas_bots_activos,
        win_rate_promedio: row.atlas_win_rate,
      },
      diferencia: row.usuario_ganancia - row.atlas_ganancia,
      lider: row.lider,
    }));
  }

  cerrar() {
    this.db.close();
  }
}
