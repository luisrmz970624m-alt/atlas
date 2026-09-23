// Generador de precios en TIEMPO REAL usando CoinGecko (gratuito, sin API key)
// Los precios son REALES del mercado, simulados localmente para demo

import Database from 'better-sqlite3';

export interface PrecioActual {
  simbolo: string;
  precio: number;
  cambio_24h: number;      // %
  cambio_1h: number;       // %
  timestamp: string;
  fuente: 'coingecko' | 'simulado';
}

export interface PrecioHistorico {
  simbolo: string;
  fecha: string;           // YYYY-MM-DD
  apertura: number;
  cierre: number;
  minimo: number;
  maximo: number;
  volumen: number;
}

export class GeneradorPreciosRealtime {
  private db: Database.Database;
  private cache_precios = new Map<string, PrecioActual>();
  private ultimas_actualizaciones = new Map<string, number>();

  // Mapeo de símbolos a IDs de CoinGecko
  private ID_COINGECKO: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'ADA': 'cardano',
    'SOL': 'solana',
  };

  private ID_ALPHAVANTAGE: Record<string, string> = {
    'AAPL': 'AAPL',
    'MSFT': 'MSFT',
    'GOOGL': 'GOOGL',
    'AMZN': 'AMZN',
    'TSLA': 'TSLA',
  };

  constructor(db_path: string = 'datos/atlas.db') {
    this.db = new Database(db_path);
    this.inicializar_schema();
  }

  private inicializar_schema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS precios_cache (
        id TEXT PRIMARY KEY,
        simbolo TEXT,
        precio REAL,
        cambio_24h REAL,
        cambio_1h REAL,
        timestamp TEXT,
        fuente TEXT
      );

      CREATE TABLE IF NOT EXISTS precios_historico (
        id TEXT PRIMARY KEY,
        simbolo TEXT,
        fecha TEXT,
        apertura REAL,
        cierre REAL,
        minimo REAL,
        maximo REAL,
        volumen REAL
      );
    `);
  }

  /**
   * Obtener precio actual desde caché o API
   * Intenta real primero, si falla usa simulado
   */
  async obtener_precio(simbolo: string): Promise<PrecioActual> {
    // Si está en caché y es reciente (< 1 minuto), devolverlo
    const ahora = Date.now();
    const ultima = this.ultimas_actualizaciones.get(simbolo) || 0;
    if (ahora - ultima < 60000 && this.cache_precios.has(simbolo)) {
      return this.cache_precios.get(simbolo)!;
    }

    // Intentar obtener precio real
    let precio = await this.obtener_precio_real(simbolo);
    if (!precio) {
      // Si falla, usar simulado
      precio = this.obtener_precio_simulado(simbolo);
    }

    // Guardar en caché
    this.cache_precios.set(simbolo, precio);
    this.ultimas_actualizaciones.set(simbolo, ahora);

    // Guardar en BD
    const id = `${simbolo}-${Date.now()}`;
    this.db.prepare(`
      INSERT INTO precios_cache (id, simbolo, precio, cambio_24h, cambio_1h, timestamp, fuente)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, precio.simbolo, precio.precio, precio.cambio_24h,
      precio.cambio_1h, precio.timestamp, precio.fuente
    );

    return precio;
  }

  /**
   * Obtener precio REAL de CoinGecko (gratis, sin API key)
   */
  private async obtener_precio_real(simbolo: string): Promise<PrecioActual | null> {
    try {
      // Criptos: usar CoinGecko
      if (this.ID_COINGECKO[simbolo]) {
        const coin_id = this.ID_COINGECKO[simbolo];
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coin_id}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;

        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();
        const coin_data = data[coin_id];

        return {
          simbolo,
          precio: coin_data.usd,
          cambio_24h: coin_data.usd_24h_change,
          cambio_1h: 0, // CoinGecko no da cambio 1h en free tier
          timestamp: new Date().toISOString(),
          fuente: 'coingecko',
        };
      }

      // Acciones: usar Alpha Vantage (requeriría API key, por ahora saltamos)
      if (this.ID_ALPHAVANTAGE[simbolo]) {
        // En producción: usar Alpha Vantage con API key
        return null;
      }

      return null;
    } catch (e) {
      console.error(`Error obteniendo precio real de ${simbolo}:`, e);
      return null;
    }
  }

  /**
   * Generar precio SIMULADO realista si la API falla
   * Usa Random Walk que parece real
   */
  private obtener_precio_simulado(simbolo: string): PrecioActual {
    // Precios iniciales realistas
    const precios_iniciales: Record<string, number> = {
      'BTC': 46000,
      'ETH': 2800,
      'ADA': 0.98,
      'SOL': 180,
      'AAPL': 230,
      'MSFT': 420,
      'GOOGL': 140,
      'AMZN': 185,
      'TSLA': 250,
    };

    const precio_base = precios_iniciales[simbolo] || 100;

    // Random walk: ±2% cambio cada minuto
    const cambio_1h = (Math.random() - 0.5) * 4; // ±2%
    const cambio_24h = (Math.random() - 0.5) * 15; // ±7.5%

    const precio = precio_base * (1 + cambio_1h / 100);

    return {
      simbolo,
      precio: parseFloat(precio.toFixed(2)),
      cambio_24h: parseFloat(cambio_24h.toFixed(2)),
      cambio_1h: parseFloat(cambio_1h.toFixed(2)),
      timestamp: new Date().toISOString(),
      fuente: 'simulado',
    };
  }

  /**
   * Obtener precios de múltiples símbolos
   */
  async obtener_precios(simbolos: string[]): Promise<Record<string, PrecioActual>> {
    const precios: Record<string, PrecioActual> = {};
    for (const sim of simbolos) {
      precios[sim] = await this.obtener_precio(sim);
    }
    return precios;
  }

  /**
   * Obtener histórico de precios (últimos N días)
   */
  obtener_historico(simbolo: string, dias: number = 30): PrecioHistorico[] {
    const stmt = this.db.prepare(`
      SELECT * FROM precios_historico
      WHERE simbolo = ?
      ORDER BY fecha DESC
      LIMIT ?
    `);
    return stmt.all(simbolo, dias) as PrecioHistorico[];
  }

  /**
   * Guardar cierre de día (para histórico)
   */
  guardar_cierre_diario(simbolo: string, precio_cierre: number, precio_minimo: number, precio_maximo: number, volumen: number) {
    const hoy = new Date().toISOString().split('T')[0];
    const id = `${simbolo}-${hoy}`;

    // Obtener apertura (precio de hace 24h)
    const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const cierre_ayer = this.db.prepare(`
      SELECT cierre FROM precios_historico WHERE simbolo = ? AND fecha = ?
    `).get(simbolo, ayer) as any;

    const precio_apertura = cierre_ayer?.cierre || precio_cierre;

    this.db.prepare(`
      INSERT OR REPLACE INTO precios_historico
      (id, simbolo, fecha, apertura, cierre, minimo, maximo, volumen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, simbolo, hoy, precio_apertura, precio_cierre,
      precio_minimo, precio_maximo, volumen
    );
  }

  cerrar() {
    this.db.close();
  }
}
