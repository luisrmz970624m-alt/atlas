import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface Posicion {
  id: string;
  portafolio_id: string;
  simbolo: string;
  cantidad: number;
  precio_promedio: number;
  created_at: string;
  updated_at: string;
}

export interface Orden {
  id: string;
  portafolio_id: string;
  tipo: 'compra' | 'venta';
  simbolo: string;
  cantidad: number;
  precio: number;
  estado: 'ejecutada' | 'pendiente' | 'cancelada';
  comision: number;
  executed_at: string;
}

export interface Portafolio {
  id: string;
  usuario_id: string;
  capital_inicial: number;
  capital_actual: number;
  created_at: string;
  updated_at: string;
}

export class TradingEngine {
  private db: Database.Database;

  constructor(db_path: string = 'datos/trading.db') {
    this.db = new Database(db_path);
    this.inicializar_schema();
  }

  private inicializar_schema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS portafolios (
        id TEXT PRIMARY KEY,
        usuario_id TEXT,
        capital_inicial REAL,
        capital_actual REAL,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS posiciones (
        id TEXT PRIMARY KEY,
        portafolio_id TEXT,
        simbolo TEXT,
        cantidad REAL,
        precio_promedio REAL,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY(portafolio_id) REFERENCES portafolios(id)
      );

      CREATE TABLE IF NOT EXISTS ordenes (
        id TEXT PRIMARY KEY,
        portafolio_id TEXT,
        tipo TEXT,
        simbolo TEXT,
        cantidad REAL,
        precio REAL,
        estado TEXT,
        comision REAL,
        executed_at TEXT,
        FOREIGN KEY(portafolio_id) REFERENCES portafolios(id)
      );

      CREATE TABLE IF NOT EXISTS precios (
        id TEXT PRIMARY KEY,
        simbolo TEXT,
        fecha TEXT,
        apertura REAL,
        cierre REAL,
        minimo REAL,
        maximo REAL,
        volumen INTEGER
      );
    `);
  }

  crear_portafolio(usuario_id: string, capital_inicial: number): Portafolio {
    const id = randomUUID();
    const ahora = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO portafolios (id, usuario_id, capital_inicial, capital_actual, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, usuario_id, capital_inicial, capital_inicial, ahora, ahora);

    return {
      id,
      usuario_id,
      capital_inicial,
      capital_actual: capital_inicial,
      created_at: ahora,
      updated_at: ahora,
    };
  }

  obtener_portafolio(id: string): Portafolio | null {
    const stmt = this.db.prepare('SELECT * FROM portafolios WHERE id = ?');
    return stmt.get(id) as Portafolio || null;
  }

  comprar(portafolio_id: string, simbolo: string, cantidad: number, precio: number): Orden {
    const portafolio = this.obtener_portafolio(portafolio_id);
    if (!portafolio) throw new Error('Portafolio no encontrado');

    const costo = cantidad * precio;
    const comision = costo * 0.001; // 0.1% de comisión
    const total = costo + comision;

    if (portafolio.capital_actual < total) {
      throw new Error(`Capital insuficiente. Necesitas $${total.toFixed(2)}, tienes $${portafolio.capital_actual.toFixed(2)}`);
    }

    const id = randomUUID();
    const ahora = new Date().toISOString();

    // Registrar orden
    const stmt_orden = this.db.prepare(`
      INSERT INTO ordenes (id, portafolio_id, tipo, simbolo, cantidad, precio, estado, comision, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt_orden.run(id, portafolio_id, 'compra', simbolo, cantidad, precio, 'ejecutada', comision, ahora);

    // Actualizar o crear posición
    const posicion_actual = this.db.prepare(
      'SELECT * FROM posiciones WHERE portafolio_id = ? AND simbolo = ?'
    ).get(portafolio_id, simbolo) as Posicion | undefined;

    if (posicion_actual) {
      const nueva_cantidad = posicion_actual.cantidad + cantidad;
      const nuevo_precio_promedio = (
        (posicion_actual.cantidad * posicion_actual.precio_promedio + cantidad * precio) /
        nueva_cantidad
      );

      const stmt_update = this.db.prepare(`
        UPDATE posiciones
        SET cantidad = ?, precio_promedio = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt_update.run(nueva_cantidad, nuevo_precio_promedio, ahora, posicion_actual.id);
    } else {
      const pos_id = randomUUID();
      const stmt_insert = this.db.prepare(`
        INSERT INTO posiciones (id, portafolio_id, simbolo, cantidad, precio_promedio, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt_insert.run(pos_id, portafolio_id, simbolo, cantidad, precio, ahora, ahora);
    }

    // Actualizar capital
    const nuevo_capital = portafolio.capital_actual - total;
    const stmt_capital = this.db.prepare(
      'UPDATE portafolios SET capital_actual = ?, updated_at = ? WHERE id = ?'
    );
    stmt_capital.run(nuevo_capital, ahora, portafolio_id);

    return {
      id,
      portafolio_id,
      tipo: 'compra',
      simbolo,
      cantidad,
      precio,
      estado: 'ejecutada',
      comision,
      executed_at: ahora,
    };
  }

  vender(portafolio_id: string, simbolo: string, cantidad: number, precio: number): Orden {
    const posicion = this.db.prepare(
      'SELECT * FROM posiciones WHERE portafolio_id = ? AND simbolo = ?'
    ).get(portafolio_id, simbolo) as Posicion | undefined;

    if (!posicion || posicion.cantidad < cantidad) {
      throw new Error(`No tienes ${cantidad} ${simbolo}. Disponibles: ${posicion?.cantidad || 0}`);
    }

    const ingreso = cantidad * precio;
    const comision = ingreso * 0.001;
    const neto = ingreso - comision;

    const id = randomUUID();
    const ahora = new Date().toISOString();
    const portafolio = this.obtener_portafolio(portafolio_id)!;

    // Registrar orden
    const stmt_orden = this.db.prepare(`
      INSERT INTO ordenes (id, portafolio_id, tipo, simbolo, cantidad, precio, estado, comision, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt_orden.run(id, portafolio_id, 'venta', simbolo, cantidad, precio, 'ejecutada', comision, ahora);

    // Actualizar posición
    if (posicion.cantidad === cantidad) {
      const stmt_delete = this.db.prepare('DELETE FROM posiciones WHERE id = ?');
      stmt_delete.run(posicion.id);
    } else {
      const stmt_update = this.db.prepare(
        'UPDATE posiciones SET cantidad = ?, updated_at = ? WHERE id = ?'
      );
      stmt_update.run(posicion.cantidad - cantidad, ahora, posicion.id);
    }

    // Actualizar capital
    const nuevo_capital = portafolio.capital_actual + neto;
    const stmt_capital = this.db.prepare(
      'UPDATE portafolios SET capital_actual = ?, updated_at = ? WHERE id = ?'
    );
    stmt_capital.run(nuevo_capital, ahora, portafolio_id);

    return {
      id,
      portafolio_id,
      tipo: 'venta',
      simbolo,
      cantidad,
      precio,
      estado: 'ejecutada',
      comision,
      executed_at: ahora,
    };
  }

  obtener_posiciones(portafolio_id: string): Posicion[] {
    const stmt = this.db.prepare('SELECT * FROM posiciones WHERE portafolio_id = ?');
    return stmt.all(portafolio_id) as Posicion[];
  }

  obtener_ordenes(portafolio_id: string, limite: number = 50): Orden[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ordenes WHERE portafolio_id = ?
      ORDER BY executed_at DESC LIMIT ?
    `);
    return stmt.all(portafolio_id, limite) as Orden[];
  }

  calcular_valor_portafolio(portafolio_id: string, precios_actuales: Record<string, number>): number {
    const portafolio = this.obtener_portafolio(portafolio_id);
    if (!portafolio) return 0;

    const posiciones = this.obtener_posiciones(portafolio_id);
    const valor_posiciones = posiciones.reduce((sum, pos) => {
      const precio = precios_actuales[pos.simbolo] || pos.precio_promedio;
      return sum + (pos.cantidad * precio);
    }, 0);

    return portafolio.capital_actual + valor_posiciones;
  }

  calcular_pnl(portafolio_id: string, precios_actuales: Record<string, number>) {
    const portafolio = this.obtener_portafolio(portafolio_id)!;
    const posiciones = this.obtener_posiciones(portafolio_id);

    // PnL no realizado
    let pnl_no_realizado = 0;
    posiciones.forEach(pos => {
      const precio_actual = precios_actuales[pos.simbolo] || pos.precio_promedio;
      pnl_no_realizado += pos.cantidad * (precio_actual - pos.precio_promedio);
    });

    // PnL realizado (de órdenes ejecutadas)
    const ordenes = this.obtener_ordenes(portafolio_id, 1000);
    let pnl_realizado = 0;

    ordenes.forEach(orden => {
      if (orden.tipo === 'venta') {
        // Buscar la compra original (simplificado: usar precio promedio)
        const posiciones_vendidas = posiciones.filter(p => p.simbolo === orden.simbolo);
        if (posiciones_vendidas.length > 0) {
          const ganancia = (orden.precio - posiciones_vendidas[0].precio_promedio) * orden.cantidad;
          pnl_realizado += ganancia - orden.comision;
        }
      }
    });

    return {
      pnl_realizado,
      pnl_no_realizado,
      pnl_total: pnl_realizado + pnl_no_realizado,
      roi: (pnl_no_realizado + pnl_realizado) / portafolio.capital_inicial,
    };
  }

  cerrar() {
    this.db.close();
  }
}
