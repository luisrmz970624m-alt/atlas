import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export type EstrategiaBot = 'buy-and-hold' | 'dca' | 'momentum' | 'mean-reversion';

export interface ConfiguracionBot {
  nombre: string;
  estrategia: EstrategiaBot;
  capital_inicial: number;
  simbolos: string[];
  parametros: Record<string, number>;
}

export interface Bot {
  id: string;
  nombre: string;
  estrategia: EstrategiaBot;
  capital_inicial: number;
  capital_actual: number;
  simbolos: string[];
  parametros: Record<string, number>;

  // Performance
  trades_ejecutados: number;
  trades_ganadores: number;
  trades_perdedores: number;
  ganancia_total: number;
  ganancia_porcentaje: number;
  win_rate: number;

  // Estado
  estado: 'activo' | 'parado' | 'evolucionando';
  ultimo_trade: string | null;
  nivel: number;
  experiencia: number;

  created_at: string;
  updated_at: string;
}

export interface OrdenBot {
  id: string;
  bot_id: string;
  tipo: 'compra' | 'venta';
  simbolo: string;
  cantidad: number;
  precio_entrada: number;
  precio_salida: number | null;
  ganancia: number | null;
  ganancia_porcentaje: number | null;
  estado: 'abierta' | 'cerrada';
  timestamp: string;
}

export class MotorBots {
  private db: Database.Database;

  constructor(db_path: string = 'datos/atlas.db') {
    this.db = new Database(db_path);
    this.inicializar_schema();
  }

  private inicializar_schema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bots (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        estrategia TEXT,
        capital_inicial REAL,
        capital_actual REAL,
        simbolos TEXT,
        parametros TEXT,
        trades_ejecutados INTEGER DEFAULT 0,
        trades_ganadores INTEGER DEFAULT 0,
        trades_perdedores INTEGER DEFAULT 0,
        ganancia_total REAL DEFAULT 0,
        ganancia_porcentaje REAL DEFAULT 0,
        win_rate REAL DEFAULT 0,
        estado TEXT DEFAULT 'activo',
        ultimo_trade TEXT,
        nivel INTEGER DEFAULT 1,
        experiencia INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS ordenes_bot (
        id TEXT PRIMARY KEY,
        bot_id TEXT,
        tipo TEXT,
        simbolo TEXT,
        cantidad REAL,
        precio_entrada REAL,
        precio_salida REAL,
        ganancia REAL,
        ganancia_porcentaje REAL,
        estado TEXT,
        timestamp TEXT,
        FOREIGN KEY(bot_id) REFERENCES bots(id)
      );

      CREATE TABLE IF NOT EXISTS evoluciones_bot (
        id TEXT PRIMARY KEY,
        bot_id TEXT,
        version INTEGER,
        estrategia TEXT,
        parametros TEXT,
        win_rate_anterior REAL,
        win_rate_nuevo REAL,
        mejora_porcentaje REAL,
        timestamp TEXT,
        FOREIGN KEY(bot_id) REFERENCES bots(id)
      );
    `);
  }

  crear_bot(config: ConfiguracionBot): Bot {
    const id = randomUUID();
    const ahora = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO bots (
        id, nombre, estrategia, capital_inicial, capital_actual,
        simbolos, parametros, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      config.nombre,
      config.estrategia,
      config.capital_inicial,
      config.capital_inicial,
      JSON.stringify(config.simbolos),
      JSON.stringify(config.parametros),
      ahora,
      ahora
    );

    return this.obtener_bot(id)!;
  }

  obtener_bot(id: string): Bot | null {
    const stmt = this.db.prepare('SELECT * FROM bots WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      nombre: row.nombre,
      estrategia: row.estrategia,
      capital_inicial: row.capital_inicial,
      capital_actual: row.capital_actual,
      simbolos: JSON.parse(row.simbolos),
      parametros: JSON.parse(row.parametros),
      trades_ejecutados: row.trades_ejecutados,
      trades_ganadores: row.trades_ganadores,
      trades_perdedores: row.trades_perdedores,
      ganancia_total: row.ganancia_total,
      ganancia_porcentaje: row.ganancia_porcentaje,
      win_rate: row.win_rate,
      estado: row.estado,
      ultimo_trade: row.ultimo_trade,
      nivel: row.nivel,
      experiencia: row.experiencia,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  listar_bots(): Bot[] {
    const stmt = this.db.prepare('SELECT * FROM bots ORDER BY updated_at DESC');
    return (stmt.all() as any[]).map(row => ({
      id: row.id,
      nombre: row.nombre,
      estrategia: row.estrategia,
      capital_inicial: row.capital_inicial,
      capital_actual: row.capital_actual,
      simbolos: JSON.parse(row.simbolos),
      parametros: JSON.parse(row.parametros),
      trades_ejecutados: row.trades_ejecutados,
      trades_ganadores: row.trades_ganadores,
      trades_perdedores: row.trades_perdedores,
      ganancia_total: row.ganancia_total,
      ganancia_porcentaje: row.ganancia_porcentaje,
      win_rate: row.win_rate,
      estado: row.estado,
      ultimo_trade: row.ultimo_trade,
      nivel: row.nivel,
      experiencia: row.experiencia,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  ejecutar_orden_bot(
    bot_id: string,
    tipo: 'compra' | 'venta',
    simbolo: string,
    cantidad: number,
    precio: number
  ): OrdenBot {
    const bot = this.obtener_bot(bot_id);
    if (!bot) throw new Error('Bot no encontrado');

    const id = randomUUID();
    const ahora = new Date().toISOString();

    if (tipo === 'compra') {
      const costo = cantidad * precio;
      if (bot.capital_actual < costo) {
        throw new Error(`Capital insuficiente. Necesitas $${costo}, tienes $${bot.capital_actual}`);
      }

      // Registrar orden abierta
      this.db.prepare(`
        INSERT INTO ordenes_bot
        (id, bot_id, tipo, simbolo, cantidad, precio_entrada, estado, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        bot_id,
        tipo,
        simbolo,
        cantidad,
        precio,
        'abierta',
        ahora
      );

      // Actualizar capital del bot
      const nuevo_capital = bot.capital_actual - costo;
      this.db.prepare('UPDATE bots SET capital_actual = ?, updated_at = ? WHERE id = ?')
        .run(nuevo_capital, ahora, bot_id);
    } else {
      // Venta: cerrar última orden abierta de ese símbolo
      const orden_abierta = this.db.prepare(`
        SELECT * FROM ordenes_bot WHERE bot_id = ? AND simbolo = ? AND estado = 'abierta'
        ORDER BY timestamp DESC LIMIT 1
      `).get(bot_id, simbolo) as any;

      if (!orden_abierta) {
        throw new Error(`No hay posición abierta de ${simbolo}`);
      }

      const ingreso = cantidad * precio;
      const ganancia = ingreso - (orden_abierta.precio_entrada * cantidad);
      const ganancia_porcentaje = ((ingreso - (orden_abierta.precio_entrada * cantidad)) /
        (orden_abierta.precio_entrada * cantidad)) * 100;

      // Actualizar orden
      this.db.prepare(`
        UPDATE ordenes_bot
        SET precio_salida = ?, ganancia = ?, ganancia_porcentaje = ?, estado = ?
        WHERE id = ?
      `).run(precio, ganancia, ganancia_porcentaje, 'cerrada', orden_abierta.id);

      // Actualizar capital
      const nuevo_capital = bot.capital_actual + ingreso;
      this.db.prepare('UPDATE bots SET capital_actual = ?, updated_at = ? WHERE id = ?')
        .run(nuevo_capital, ahora, bot_id);

      // Actualizar estadísticas del bot
      const es_ganadora = ganancia > 0;
      const nuevos_ganadores = bot.trades_ganadores + (es_ganadora ? 1 : 0);
      const nuevos_perdedores = bot.trades_perdedores + (es_ganadora ? 0 : 1);
      const nuevos_trades = bot.trades_ejecutados + 1;
      const nueva_ganancia_total = bot.ganancia_total + ganancia;
      const nueva_ganancia_pct = ((nueva_ganancia_total / bot.capital_inicial) * 100);
      const nuevo_win_rate = (nuevos_ganadores / nuevos_trades) * 100;
      const nueva_xp = bot.experiencia + (es_ganadora ? 10 : 5);

      this.db.prepare(`
        UPDATE bots
        SET trades_ejecutados = ?, trades_ganadores = ?, trades_perdedores = ?,
            ganancia_total = ?, ganancia_porcentaje = ?, win_rate = ?,
            experiencia = ?, ultimo_trade = ?, updated_at = ?
        WHERE id = ?
      `).run(
        nuevos_trades,
        nuevos_ganadores,
        nuevos_perdedores,
        nueva_ganancia_total,
        nueva_ganancia_pct,
        nuevo_win_rate,
        nueva_xp,
        ahora,
        ahora,
        bot_id
      );
    }

    // Calcular ganancia para retorno
    let ganancia_retorno: number | null = null;
    let ganancia_pct_retorno: number | null = null;

    if (tipo === 'venta') {
      const orden_abierta = this.db.prepare(`
        SELECT * FROM ordenes_bot WHERE bot_id = ? AND simbolo = ? AND estado = 'abierta'
        ORDER BY timestamp DESC LIMIT 1
      `).get(bot_id, simbolo) as any;

      if (orden_abierta) {
        ganancia_retorno = (cantidad * precio) - (orden_abierta.precio_entrada * cantidad);
        ganancia_pct_retorno = (ganancia_retorno / (orden_abierta.precio_entrada * cantidad)) * 100;
      }
    }

    return {
      id,
      bot_id,
      tipo,
      simbolo,
      cantidad,
      precio_entrada: tipo === 'compra' ? precio : 0,
      precio_salida: tipo === 'venta' ? precio : null,
      ganancia: ganancia_retorno,
      ganancia_porcentaje: ganancia_pct_retorno,
      estado: tipo === 'compra' ? 'abierta' : 'cerrada',
      timestamp: ahora,
    };
  }

  obtener_ordenes_bot(bot_id: string, limite: number = 50): OrdenBot[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ordenes_bot WHERE bot_id = ? ORDER BY timestamp DESC LIMIT ?
    `);
    return stmt.all(bot_id, limite) as OrdenBot[];
  }

  calcular_valor_portafolio_bot(bot_id: string, precios_actuales: Record<string, number>): number {
    const bot = this.obtener_bot(bot_id);
    if (!bot) return 0;

    const ordenes_abiertas = this.db.prepare(`
      SELECT * FROM ordenes_bot WHERE bot_id = ? AND estado = 'abierta'
    `).all(bot_id) as any[];

    let valor_posiciones = 0;
    for (const orden of ordenes_abiertas) {
      const precio_actual = precios_actuales[orden.simbolo] || orden.precio_entrada;
      valor_posiciones += orden.cantidad * precio_actual;
    }

    return bot.capital_actual + valor_posiciones;
  }

  subir_nivel_bot(bot_id: string) {
    const bot = this.obtener_bot(bot_id);
    if (!bot) return;

    const ahora = new Date().toISOString();
    const nuevo_nivel = bot.nivel + 1;

    this.db.prepare('UPDATE bots SET nivel = ?, updated_at = ? WHERE id = ?')
      .run(nuevo_nivel, ahora, bot_id);
  }

  desactivar_bot(bot_id: string) {
    const ahora = new Date().toISOString();
    this.db.prepare('UPDATE bots SET estado = ?, updated_at = ? WHERE id = ?')
      .run('parado', ahora, bot_id);
  }

  activar_bot(bot_id: string) {
    const ahora = new Date().toISOString();
    this.db.prepare('UPDATE bots SET estado = ?, updated_at = ? WHERE id = ?')
      .run('activo', ahora, bot_id);
  }

  cerrar() {
    this.db.close();
  }
}
