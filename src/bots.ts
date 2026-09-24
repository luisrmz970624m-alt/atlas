import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { COMISION } from './trading.ts';

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
  comision: number;
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

    // CREATE TABLE IF NOT EXISTS no agrega columnas a tablas que ya existen,
    // así que una base creada antes de que los bots pagaran comisión se
    // quedaría sin la columna y los INSERT fallarían.
    this.asegurar_columna('ordenes_bot', 'comision', 'REAL DEFAULT 0');
  }

  /** Agrega una columna si falta. Solo se invoca con nombres literales. */
  private asegurar_columna(tabla: string, columna: string, definicion: string) {
    const columnas = this.db.prepare(`PRAGMA table_info(${tabla})`).all() as { name: string }[];
    if (!columnas.some((c) => c.name === columna)) {
      this.db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
    }
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

    // Los bots pagan la misma comisión que el usuario: si no, ganarían por no
    // tener costos en lugar de por operar mejor.
    let comision_orden = 0;
    let ganancia_retorno: number | null = null;
    let ganancia_pct_retorno: number | null = null;

    if (tipo === 'compra') {
      const costo = cantidad * precio;
      comision_orden = costo * COMISION;
      const total = costo + comision_orden;

      if (bot.capital_actual < total) {
        throw new Error(`Capital insuficiente. Necesitas $${total.toFixed(2)}, tienes $${bot.capital_actual.toFixed(2)}`);
      }

      // Registrar orden abierta
      this.db.prepare(`
        INSERT INTO ordenes_bot
        (id, bot_id, tipo, simbolo, cantidad, precio_entrada, comision, estado, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        bot_id,
        tipo,
        simbolo,
        cantidad,
        precio,
        comision_orden,
        'abierta',
        ahora
      );

      // Actualizar capital del bot
      const nuevo_capital = bot.capital_actual - total;
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
      comision_orden = ingreso * COMISION;
      const neto = ingreso - comision_orden;

      // La ganancia descuenta las dos comisiones —la de esta venta y la
      // prorrateada de la compra que se está cerrando—, igual que la del
      // usuario. Si solo se restara el precio de entrada, un bot "ganaría"
      // operaciones que en realidad no cubren sus costos.
      const costo_entrada = orden_abierta.precio_entrada * cantidad;
      const comision_entrada = (orden_abierta.comision ?? 0) *
        (orden_abierta.cantidad > 0 ? cantidad / orden_abierta.cantidad : 1);
      const ganancia = neto - costo_entrada - comision_entrada;
      const base = costo_entrada + comision_entrada;
      const ganancia_porcentaje = base > 0 ? (ganancia / base) * 100 : 0;

      ganancia_retorno = ganancia;
      ganancia_pct_retorno = ganancia_porcentaje;

      // Actualizar orden
      this.db.prepare(`
        UPDATE ordenes_bot
        SET precio_salida = ?, ganancia = ?, ganancia_porcentaje = ?, comision = comision + ?, estado = ?
        WHERE id = ?
      `).run(precio, ganancia, ganancia_porcentaje, comision_orden, 'cerrada', orden_abierta.id);

      // Actualizar capital
      const nuevo_capital = bot.capital_actual + neto;
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

    // La ganancia devuelta es la misma que se guardó arriba. Antes se
    // recalculaba volviendo a consultar una orden abierta, pero la que se
    // acababa de cerrar ya no lo estaba: se comparaba contra otra orden
    // distinta, o contra ninguna.
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
      comision: comision_orden,
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
