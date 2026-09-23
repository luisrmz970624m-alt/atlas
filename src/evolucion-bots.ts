// Sistema de evolución automática de bots basado en errores y aprendizaje

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { Bot, EstrategiaBot } from './bots.ts';

export interface ErrorBot {
  bot_id: string;
  tipo_error: 'capital_insuficiente' | 'posicion_no_existe' | 'precio_invalido' | 'timeout' | 'otro';
  descripcion: string;
  timestamp: string;
  contexto: Record<string, unknown>;
}

export interface BotMejorado {
  id: string;
  nombre: string;
  estrategia: EstrategiaBot;
  parametros_originales: Record<string, number>;
  parametros_mejorados: Record<string, number>;
  mejoras: string[];
  razon_mejora: string;
  win_rate_esperado: number;
  created_at: string;
}

export class SistemaEvolucionBots {
  private db: Database.Database;

  constructor(db_path: string = 'datos/atlas.db') {
    this.db = new Database(db_path);
    this.inicializar_schema();
  }

  private inicializar_schema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS errores_bots (
        id TEXT PRIMARY KEY,
        bot_id TEXT,
        tipo_error TEXT,
        descripcion TEXT,
        timestamp TEXT,
        contexto TEXT
      );

      CREATE TABLE IF NOT EXISTS bots_mejorados (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        estrategia TEXT,
        parametros_originales TEXT,
        parametros_mejorados TEXT,
        mejoras TEXT,
        razon_mejora TEXT,
        win_rate_esperado REAL,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS lecciones_aprendidas (
        id TEXT PRIMARY KEY,
        bot_id TEXT,
        error_tipo TEXT,
        leccion TEXT,
        solucion TEXT,
        timestamp TEXT
      );
    `);
  }

  /**
   * Registrar error de un bot
   */
  registrar_error(
    bot_id: string,
    tipo: ErrorBot['tipo_error'],
    descripcion: string,
    contexto: Record<string, unknown>
  ) {
    const id = randomUUID();
    const ahora = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO errores_bots (id, bot_id, tipo_error, descripcion, timestamp, contexto)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, bot_id, tipo, descripcion, ahora, JSON.stringify(contexto));

    // Aprender de error
    this.aprender_de_error(bot_id, tipo, descripcion, contexto);
  }

  /**
   * Aprender de errores cometidos
   */
  private aprender_de_error(
    bot_id: string,
    tipo: string,
    descripcion: string,
    contexto: Record<string, unknown>
  ) {
    let leccion = '';
    let solucion = '';

    switch (tipo) {
      case 'capital_insuficiente':
        leccion = 'El bot intenta gastar más capital del disponible';
        solucion = 'Reducir tamaño de posición o asignar más capital inicial';
        break;

      case 'posicion_no_existe':
        leccion = 'El bot intenta vender sin posición abierta';
        solucion = 'Verificar que existe posición antes de vender, o solo vender ganadores';
        break;

      case 'precio_invalido':
        leccion = 'El precio del símbolo no es válido o no está disponible';
        solucion = 'Validar disponibilidad de precio antes de operar';
        break;

      case 'timeout':
        leccion = 'Operación tardó demasiado tiempo';
        solucion = 'Reducir complejidad de estrategia o aumentar timeout';
        break;

      default:
        leccion = 'Error desconocido en ejecución';
        solucion = 'Revisar logs y contexto del error';
    }

    const id = randomUUID();
    const ahora = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO lecciones_aprendidas (id, bot_id, error_tipo, leccion, solucion, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, bot_id, tipo, leccion, solucion, ahora);
  }

  /**
   * Generar nuevos bots mejorando estrategias existentes
   */
  generar_bots_mejorados(bots_base: Bot[]): BotMejorado[] {
    const bots_mejorados: BotMejorado[] = [];

    for (const bot_base of bots_base) {
      // Estrategia 1: DCA mejorado (aumentar cantidad si está ganando)
      if (bot_base.estrategia === 'dca' && bot_base.win_rate > 50) {
        bots_mejorados.push({
          id: randomUUID(),
          nombre: `${bot_base.nombre}-mejorado-dca-adaptativo`,
          estrategia: 'dca',
          parametros_originales: bot_base.parametros,
          parametros_mejorados: {
            ...bot_base.parametros,
            cantidad_diaria: (bot_base.parametros.cantidad_diaria || 100) * 1.2, // +20%
            volatilidad_ajuste: 1, // Nuevo: ajustar por volatilidad
          },
          mejoras: [
            'Aumenta cantidad diaria 20% si win_rate > 50%',
            'Ajusta cantidad según volatilidad del mercado',
            'Reduce riesgo si hay pérdidas consecutivas',
          ],
          razon_mejora: `Basado en ${bot_base.trades_ganadores} operaciones ganadoras de ${bot_base.trades_ejecutados} totales`,
          win_rate_esperado: bot_base.win_rate * 1.05, // +5% esperado
          created_at: new Date().toISOString(),
        });
      }

      // Estrategia 2: Momentum mejorado (con stop-loss)
      if (bot_base.estrategia === 'momentum') {
        bots_mejorados.push({
          id: randomUUID(),
          nombre: `${bot_base.nombre}-mejorado-momentum-stop-loss`,
          estrategia: 'momentum',
          parametros_originales: bot_base.parametros,
          parametros_mejorados: {
            ...bot_base.parametros,
            stop_loss: -3, // Vende si cae 3%
            take_profit: 8, // Vende si sube 8%
            min_momentum: 0.7, // Mínimo cambio para actuar
          },
          mejoras: [
            'Agrega stop-loss en -3%',
            'Agrega take-profit en +8%',
            'Requiere momentum mínimo antes de actuar',
          ],
          razon_mejora: 'Proteger contra pérdidas grandes y asegurar ganancias',
          win_rate_esperado: Math.min(bot_base.win_rate * 1.15, 85), // Máx 85%
          created_at: new Date().toISOString(),
        });
      }

      // Estrategia 3: Mean-reversion mejorado (con bandas)
      if (bot_base.estrategia === 'mean-reversion') {
        bots_mejorados.push({
          id: randomUUID(),
          nombre: `${bot_base.nombre}-mejorado-mean-reversion-bandas`,
          estrategia: 'mean-reversion',
          parametros_originales: bot_base.parametros,
          parametros_mejorados: {
            ...bot_base.parametros,
            banda_superior: 2, // Vende si sube 2 desvíos std
            banda_inferior: -2, // Compra si baja 2 desvíos std
            confirmacion: 2, // Requiere 2 señales antes de actuar
          },
          mejoras: [
            'Usa bandas de Bollinger (2 desvíos estándar)',
            'Requiere confirmación de 2 velas',
            'Mejor timing de entrada/salida',
          ],
          razon_mejora: 'Mejora precisión de puntos de entrada/salida',
          win_rate_esperado: Math.min(bot_base.win_rate * 1.25, 80),
          created_at: new Date().toISOString(),
        });
      }

      // Estrategia 4: Buy-and-hold mejorado (con rebalanceo)
      if (bot_base.estrategia === 'buy-and-hold' && bot_base.ganancia_total > 0) {
        bots_mejorados.push({
          id: randomUUID(),
          nombre: `${bot_base.nombre}-mejorado-hold-rebalance`,
          estrategia: 'buy-and-hold',
          parametros_originales: bot_base.parametros,
          parametros_mejorados: {
            ...bot_base.parametros,
            rebalanceo_frecuencia: 30, // Cada 30 días
            rebalanceo_threshold: 15, // Si se desvía >15% del target
            diversificacion: 0.5, // 50% en cada símbolo
          },
          mejoras: [
            'Rebalanceo automático cada 30 días',
            'Mantiene 50/50 entre símbolos',
            'Vende ganadores para comprar perdedores',
          ],
          razon_mejora: 'Mejora diversificación y gestión de riesgo',
          win_rate_esperado: bot_base.win_rate * 1.1,
          created_at: new Date().toISOString(),
        });
      }
    }

    // Guardar bots mejorados en BD
    for (const bot of bots_mejorados) {
      this.db.prepare(`
        INSERT INTO bots_mejorados
        (id, nombre, estrategia, parametros_originales, parametros_mejorados, mejoras, razon_mejora, win_rate_esperado, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        bot.id,
        bot.nombre,
        bot.estrategia,
        JSON.stringify(bot.parametros_originales),
        JSON.stringify(bot.parametros_mejorados),
        JSON.stringify(bot.mejoras),
        bot.razon_mejora,
        bot.win_rate_esperado,
        bot.created_at
      );
    }

    return bots_mejorados;
  }

  /**
   * Obtener lecciones aprendidas de un bot
   */
  obtener_lecciones(bot_id: string): Array<{leccion: string; solucion: string; timestamp: string}> {
    const stmt = this.db.prepare(`
      SELECT leccion, solucion, timestamp FROM lecciones_aprendidas
      WHERE bot_id = ?
      ORDER BY timestamp DESC
    `);
    return stmt.all(bot_id) as any[];
  }

  /**
   * Obtener errores comunes entre todos los bots
   */
  analizar_errores_comunes(): Record<string, number> {
    const stmt = this.db.prepare(`
      SELECT tipo_error, COUNT(*) as cantidad FROM errores_bots
      GROUP BY tipo_error
      ORDER BY cantidad DESC
    `);

    const resultado: Record<string, number> = {};
    const rows = stmt.all() as any[];
    for (const row of rows) {
      resultado[row.tipo_error] = row.cantidad;
    }
    return resultado;
  }

  /**
   * Generar reporte de evolución
   */
  generar_reporte_evolucion(): {
    bots_mejorados_disponibles: number;
    errores_totales: number;
    errores_comunes: Record<string, number>;
    lecciones_aprendidas: number;
  } {
    const bots_mejorados = (this.db.prepare(
      'SELECT COUNT(*) as count FROM bots_mejorados'
    ).get() as any).count;

    const errores_totales = (this.db.prepare(
      'SELECT COUNT(*) as count FROM errores_bots'
    ).get() as any).count;

    const errores_comunes = this.analizar_errores_comunes();

    const lecciones = (this.db.prepare(
      'SELECT COUNT(*) as count FROM lecciones_aprendidas'
    ).get() as any).count;

    return {
      bots_mejorados_disponibles: bots_mejorados,
      errores_totales,
      errores_comunes,
      lecciones_aprendidas: lecciones,
    };
  }

  cerrar() {
    this.db.close();
  }
}
