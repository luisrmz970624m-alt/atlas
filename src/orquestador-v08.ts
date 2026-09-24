// Orquestador de V0.8: integra energía, minería, bots, competencia y precios en tiempo real

import Database from 'better-sqlite3';
import { GestorEnergia } from './energia.ts';
import { MotorMineria } from './mineria.ts';
import { TradingEngine, USUARIO_ID, CAPITAL_INICIAL_USUARIO } from './trading.ts';
import { GeneradorPreciosRealtime, SIMBOLOS_SOPORTADOS, type PrecioActual } from './precios-realtime.ts';
import { MotorBots, type Bot } from './bots.ts';
import { GestorCompetencia } from './competencia.ts';
import { guardarEstado, cargarEstado } from './persistencia.ts';

export interface EstadoAtlasV08 {
  timestamp: string;
  nivel: number;
  energia_hoy: number;
  energia_disponible: number;
  eth_generado_hoy: number;
  dinero_ganado: number;

  portafolio_usuario: {
    capital: number;
    ganancia: number;
    ganancia_porcentaje: number;
    trades: number;
    win_rate: number;
  };

  portafolio_atlas: {
    capital: number;
    ganancia: number;
    ganancia_porcentaje: number;
    trades_total: number;
    bots_activos: number;
    bots: Bot[];
  };

  competencia: {
    lider: 'usuario' | 'atlas' | 'empate';
    diferencia: number;
    usuario_ganancias_hoy: number;
    atlas_ganancias_hoy: number;
  };
}

export class OrquestadorV08 {
  private db: Database.Database;
  private energia: GestorEnergia;
  private mineria: MotorMineria;
  private trading: TradingEngine;
  private precios: GeneradorPreciosRealtime;
  private bots: MotorBots;
  private competencia: GestorCompetencia;

  private intervalo_ejecucion: NodeJS.Timer | null = null;
  private precios_cache: Record<string, PrecioActual> = {};
  private ciclos_ejecutados = 0;
  private ruta_estado: string;

  constructor(db_path: string = 'datos/atlas.db', ruta_estado: string = 'datos/atlas-state.json') {
    this.db = new Database(db_path);
    this.energia = new GestorEnergia(db_path);
    this.mineria = new MotorMineria(db_path);
    this.trading = new TradingEngine(db_path);
    this.precios = new GeneradorPreciosRealtime(db_path);
    this.bots = new MotorBots(db_path);
    this.competencia = new GestorCompetencia(db_path);
    this.ruta_estado = ruta_estado;

    // Restaurar contador de ciclos si hay un snapshot previo
    const previo = cargarEstado(this.ruta_estado);
    if (previo) this.ciclos_ejecutados = previo.ciclos_ejecutados;
  }

  /**
   * Obtener estado completo de Atlas V0.8
   */
  async obtener_estado(): Promise<EstadoAtlasV08> {
    const ahora = new Date().toISOString();
    const energia_estado = this.energia.obtener_estado_hoy();
    const mineria_estado = this.mineria.obtener_estado_hoy();
    const bots_lista = this.bots.listar_bots();

    // Obtener precios actuales
    const simbolos = [...SIMBOLOS_SOPORTADOS];
    const precios = await this.precios.obtener_precios(simbolos);

    // Portafolio manual del usuario. La ganancia se mide sobre el valor TOTAL
    // (efectivo + posiciones abiertas a precio actual): si solo miráramos el
    // efectivo, comprar algo se vería como una pérdida instantánea.
    const usuario_portafolio = this.trading.obtener_portafolio_por_usuario(USUARIO_ID);
    const usuario_capital = usuario_portafolio?.capital_inicial ?? CAPITAL_INICIAL_USUARIO;

    const precios_planos: Record<string, number> = {};
    for (const [simbolo, p] of Object.entries(precios)) precios_planos[simbolo] = p.precio;

    const usuario_stats = usuario_portafolio
      ? this.trading.obtener_estadisticas(usuario_portafolio.id)
      : null;

    const usuario_ganancia = usuario_portafolio
      ? this.trading.calcular_valor_portafolio(usuario_portafolio.id, precios_planos) - usuario_capital
      : 0;

    // Calcular ganancia de Atlas (suma de todos los bots)
    let atlas_capital = 0;
    let atlas_ganancia = 0;
    let atlas_trades = 0;
    let atlas_win_rate = 0;

    for (const bot of bots_lista) {
      atlas_capital += bot.capital_actual;
      atlas_ganancia += bot.ganancia_total;
      atlas_trades += bot.trades_ejecutados;
      atlas_win_rate += bot.win_rate;
    }

    if (bots_lista.length > 0) {
      atlas_win_rate /= bots_lista.length;
    }

    // Determinar líder
    let lider: 'usuario' | 'atlas' | 'empate';
    if (usuario_ganancia > atlas_ganancia) lider = 'usuario';
    else if (atlas_ganancia > usuario_ganancia) lider = 'atlas';
    else lider = 'empate';

    return {
      timestamp: ahora,
      nivel: 1 + Math.floor((mineria_estado.bloques_minados + atlas_trades) / 10),
      energia_hoy: energia_estado.energia_disponible,
      energia_disponible: energia_estado.energia_disponible,
      eth_generado_hoy: mineria_estado.eth_generado_hoy,
      dinero_ganado: atlas_ganancia,

      portafolio_usuario: {
        capital: usuario_capital,
        ganancia: usuario_ganancia,
        ganancia_porcentaje: (usuario_ganancia / usuario_capital) * 100,
        trades: usuario_stats?.operaciones_cerradas ?? 0,
        win_rate: usuario_stats?.win_rate ?? 0,
      },

      portafolio_atlas: {
        capital: atlas_capital,
        ganancia: atlas_ganancia,
        ganancia_porcentaje: atlas_capital > 0 ? (atlas_ganancia / atlas_capital) * 100 : 0,
        trades_total: atlas_trades,
        bots_activos: bots_lista.filter(b => b.estado === 'activo').length,
        bots: bots_lista,
      },

      competencia: {
        lider,
        diferencia: usuario_ganancia - atlas_ganancia,
        usuario_ganancias_hoy: usuario_ganancia,
        atlas_ganancias_hoy: atlas_ganancia,
      },
    };
  }

  /**
   * Ciclo principal: minar, ejecutar bots, registrar competencia
   */
  async ejecutar_ciclo() {
    const energia = this.energia.obtener_estado_hoy();
    // Todos los símbolos soportados, no solo BTC/ETH: un bot creado sobre ADA
    // o SOL no encontraría precio y nunca llegaría a operar.
    const precios = await this.precios.obtener_precios([...SIMBOLOS_SOPORTADOS]);

    // 1. MINAR
    const energia_mineria = this.energia.obtener_energia_asignada('minar');
    if (energia_mineria > 0) {
      const sesion_mineria = this.mineria.minar_sesion(
        energia_mineria,
        30,  // % de energía asignada
        1    // nivel base
      );

      this.energia.consumir_energia(
        'minar',
        sesion_mineria.energia_consumida,
        { eth_generado: sesion_mineria.eth_total, bloques: sesion_mineria.bloques.length }
      );
    }

    // 2. EJECUTAR BOTS
    const bots = this.bots.listar_bots().filter(b => b.estado === 'activo');
    const energia_tradeo = this.energia.obtener_energia_asignada('tradear');

    for (const bot of bots) {
      if (energia_tradeo < 3) break; // 3 energía por orden

      // Decidir si comprar o vender (estrategia simplificada)
      const decision = this.decidir_accion_bot(bot, precios);

      if (decision && decision.tipo === 'compra') {
        try {
          this.bots.ejecutar_orden_bot(
            bot.id,
            'compra',
            decision.simbolo,
            decision.cantidad,
            precios[decision.simbolo]?.precio || 0
          );
          this.energia.consumir_energia('tradear', 3, { orden: 'compra' });
        } catch (e) {
          // Capital insuficiente, etc
        }
      } else if (decision && decision.tipo === 'venta') {
        try {
          this.bots.ejecutar_orden_bot(
            bot.id,
            'venta',
            decision.simbolo,
            decision.cantidad,
            precios[decision.simbolo]?.precio || 0
          );
          this.energia.consumir_energia('tradear', 3, { orden: 'venta' });
        } catch (e) {
          // Sin posición abierta, etc
        }
      }
    }

    // 3. REGISTRAR COMPETENCIA
    const estado = await this.obtener_estado();
    this.competencia.crear_snapshot(
      estado.portafolio_usuario.capital,
      estado.portafolio_usuario.ganancia,
      estado.portafolio_usuario.trades,
      estado.portafolio_usuario.win_rate,
      estado.portafolio_atlas.capital,
      estado.portafolio_atlas.ganancia,
      estado.portafolio_atlas.trades_total,
      estado.portafolio_atlas.bots_activos,
      estado.portafolio_atlas.ganancia_porcentaje
    );

    // 4. INTENTAR EVOLUCIONAR BOTS
    for (const bot of bots) {
      if (bot.experiencia > 20 && Math.random() < 0.1) {
        // 10% de chance de evolucionar si tiene experiencia
        this.evolucionar_bot(bot);
      }
    }

    // 5. PERSISTIR SNAPSHOT DE ESTADO
    this.ciclos_ejecutados++;
    guardarEstado(estado, this.intervalo_ejecucion !== null, this.ciclos_ejecutados, this.ruta_estado);
  }

  /**
   * Leer el último snapshot persistido sin recalcular nada (rápido, para CLI/dashboard)
   */
  obtener_estado_persistido() {
    return cargarEstado(this.ruta_estado);
  }

  /**
   * Decidir acción de un bot basado en su estrategia
   */
  private decidir_accion_bot(
    bot: Bot,
    precios: Record<string, PrecioActual>
  ): { tipo: 'compra' | 'venta'; simbolo: string; cantidad: number } | null {
    const simbolo = bot.simbolos[0]; // Simplificado: primer símbolo
    const precio = precios[simbolo];

    if (!precio) return null;

    switch (bot.estrategia) {
      case 'dca':
        // Dollar-Cost Averaging: compra siempre
        if (bot.capital_actual > precio.precio * 0.1) {
          return {
            tipo: 'compra',
            simbolo,
            cantidad: 0.1,
          };
        }
        return null;

      case 'momentum':
        // Compra si precio sube, vende si baja
        if (precio.cambio_1h > 0.5 && bot.capital_actual > precio.precio * 0.1) {
          return {
            tipo: 'compra',
            simbolo,
            cantidad: 0.1,
          };
        } else if (precio.cambio_1h < -0.5) {
          return {
            tipo: 'venta',
            simbolo,
            cantidad: 0.05,
          };
        }
        return null;

      case 'mean-reversion':
        // Compra si baja mucho, vende si sube mucho
        if (precio.cambio_24h < -5) {
          return {
            tipo: 'compra',
            simbolo,
            cantidad: 0.1,
          };
        } else if (precio.cambio_24h > 10) {
          return {
            tipo: 'venta',
            simbolo,
            cantidad: 0.05,
          };
        }
        return null;

      case 'buy-and-hold':
      default:
        // Solo compra una vez
        if (bot.trades_ejecutados === 0 && bot.capital_actual > precio.precio * 0.5) {
          return {
            tipo: 'compra',
            simbolo,
            cantidad: 0.5,
          };
        }
        return null;
    }
  }

  /**
   * Evolucionar un bot: mejorar parámetros basado en experiencia
   */
  private evolucionar_bot(bot: Bot) {
    if (bot.win_rate < 50) return; // Solo evolucionar si es rentable

    const ahora = new Date().toISOString();

    // Registrar evolución
    this.db.prepare(`
      INSERT INTO evoluciones_bot
      (id, bot_id, version, estrategia, parametros, win_rate_anterior, win_rate_nuevo, mejora_porcentaje, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `evol-${bot.id}-${Date.now()}`,
      bot.id,
      bot.nivel + 1,
      bot.estrategia,
      JSON.stringify(bot.parametros),
      bot.win_rate - 5,
      bot.win_rate,
      5,
      ahora
    );

    // Subir nivel
    this.bots.subir_nivel_bot(bot.id);
  }

  /**
   * Iniciar ejecución periódica en tiempo real
   * @param intervalo_ms Cada cuántos ms ejecutar ciclo (default: 60000 = 1 minuto)
   */
  iniciar_ejecucion(intervalo_ms: number = 60000) {
    if (this.intervalo_ejecucion) {
      console.log('Ejecución ya está activa');
      return;
    }

    console.log(`🚀 Atlas V0.8 iniciando ejecución cada ${intervalo_ms}ms`);

    this.intervalo_ejecucion = setInterval(async () => {
      try {
        await this.ejecutar_ciclo();
        const estado = await this.obtener_estado();
        console.log(`⚡ Ciclo ejecutado | Atlas: $${estado.portafolio_atlas.ganancia.toFixed(2)} | Tú: $${estado.portafolio_usuario.ganancia.toFixed(2)}`);
      } catch (e) {
        console.error('Error en ciclo de Atlas:', e);
      }
    }, intervalo_ms);
  }

  /**
   * Detener ejecución
   */
  detener_ejecucion() {
    if (this.intervalo_ejecucion) {
      clearInterval(this.intervalo_ejecucion);
      this.intervalo_ejecucion = null;
      console.log('⏸️ Atlas V0.8 detenido');
    }
  }

  cerrar() {
    this.detener_ejecucion();
    this.db.close();
    this.energia.cerrar();
    this.mineria.cerrar();
    this.trading.cerrar();
    this.precios.cerrar();
    this.bots.cerrar();
    this.competencia.cerrar();
  }
}
