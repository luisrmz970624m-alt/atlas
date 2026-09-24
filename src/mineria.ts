import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface EstadoMineria {
  energia_asignada: number;      // % de energía diaria
  hash_rate: number;             // H/s (aumenta con nivel de Atlas)
  eth_generado_hoy: number;      // ETH acumulado hoy
  bloques_minados: number;
  dificultad: number;            // Aumenta con el tiempo
  velocidad_mining: number;      // ETH por hora
}

export interface RegistroMineria {
  id: string;
  timestamp: string;
  energia_consumida: number;
  eth_generado: number;
  hash_rate: number;
  dificultad: number;
}

export class MotorMineria {
  private db: Database.Database;
  private energia_por_bloque = 1;      // 1 energía por bloque
  private eth_base_por_bloque = 0.001; // 0.001 ETH base

  constructor(db_path: string = 'datos/atlas.db') {
    this.db = new Database(db_path);
    this.inicializar_schema();
  }

  private inicializar_schema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mineria_registro (
        id TEXT PRIMARY KEY,
        fecha TEXT,
        timestamp TEXT,
        energia_consumida REAL,
        eth_generado REAL,
        hash_rate REAL,
        dificultad REAL
      );

      CREATE TABLE IF NOT EXISTS mineria_estado (
        id TEXT PRIMARY KEY,
        fecha TEXT UNIQUE,
        energia_asignada REAL,
        hash_rate REAL,
        eth_generado_hoy REAL,
        bloques_minados INTEGER,
        dificultad REAL,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    this.asegurar_estado_hoy();
  }

  /**
   * Crea la fila del día si aún no existe. Se llama en cada lectura, no solo
   * al construir: un proceso que lleva días corriendo cruza la medianoche y
   * necesitaría una fila nueva que nadie habría creado. La dificultad vuelve
   * a 1.0 cada día.
   */
  private asegurar_estado_hoy() {
    const hoy = new Date().toISOString().split('T')[0];
    const existe = this.db.prepare(
      'SELECT 1 FROM mineria_estado WHERE fecha = ?'
    ).get(hoy);

    if (!existe) {
      const ahora = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO mineria_estado
        (id, fecha, energia_asignada, hash_rate, eth_generado_hoy, bloques_minados, dificultad, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        hoy,
        30,          // 30% energía por defecto
        100,         // hash rate base
        0,           // ETH generado hoy
        0,           // bloques minados
        1.0,         // dificultad base
        ahora,
        ahora
      );
    }
  }

  obtener_estado_hoy(): EstadoMineria {
    this.asegurar_estado_hoy();
    const hoy = new Date().toISOString().split('T')[0];
    const stmt = this.db.prepare(
      'SELECT * FROM mineria_estado WHERE fecha = ?'
    );
    const row = stmt.get(hoy) as any;

    if (!row) throw new Error('No hay estado de minería para hoy');

    return {
      energia_asignada: row.energia_asignada,
      hash_rate: row.hash_rate,
      eth_generado_hoy: row.eth_generado_hoy,
      bloques_minados: row.bloques_minados,
      dificultad: row.dificultad,
      velocidad_mining: this.calcular_velocidad_mining(row.hash_rate, row.dificultad),
    };
  }

  private calcular_velocidad_mining(hash_rate: number, dificultad: number): number {
    // ETH por hora = (hash_rate base) * (0.001 ETH/bloque) / dificultad
    return (hash_rate / 100) * this.eth_base_por_bloque * (1 / dificultad);
  }

  /**
   * Ejecutar ciclo de minería
   * Consume energía y genera ETH
   */
  minar_bloque(energia_asignada_pct: number, nivel_atlas: number = 1): RegistroMineria {
    const hoy = new Date().toISOString().split('T')[0];
    const ahora = new Date().toISOString();
    const estado = this.obtener_estado_hoy();

    // Calcular energía real a consumir (1 energía por bloque)
    const energia_a_consumir = this.energia_por_bloque;

    // Calcular hash rate (mejora con nivel)
    const hash_rate_actual = 100 + (nivel_atlas * 5);

    // Calcular ETH generado
    // Formula: eth_base * (energia_asignada_pct / 100) * (nivel / 10) / dificultad
    const eth_generado = (
      this.eth_base_por_bloque *
      (energia_asignada_pct / 100) *
      (nivel_atlas / 10) *
      (1 / estado.dificultad)
    );

    // Registrar minería
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO mineria_registro
      (id, fecha, timestamp, energia_consumida, eth_generado, hash_rate, dificultad)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      hoy,
      ahora,
      energia_a_consumir,
      eth_generado,
      hash_rate_actual,
      estado.dificultad
    );

    // Actualizar estado
    const nuevo_eth = estado.eth_generado_hoy + eth_generado;
    const nuevo_bloques = estado.bloques_minados + 1;

    // Aumentar dificultad lentamente (máximo 5)
    const nueva_dificultad = Math.min(
      estado.dificultad + (0.001 * nuevo_bloques),
      5.0  // Cap at 5x difficulty
    );

    this.db.prepare(`
      UPDATE mineria_estado
      SET eth_generado_hoy = ?, bloques_minados = ?, dificultad = ?, updated_at = ?
      WHERE fecha = ?
    `).run(nuevo_eth, nuevo_bloques, nueva_dificultad, ahora, hoy);

    return {
      id,
      timestamp: ahora,
      energia_consumida: energia_a_consumir,
      eth_generado,
      hash_rate: hash_rate_actual,
      dificultad: nueva_dificultad,
    };
  }

  /**
   * Minar continuamente durante X energía
   */
  minar_sesion(
    energia_disponible: number,
    energia_asignada_pct: number,
    nivel_atlas: number = 1
  ): {
    bloques: RegistroMineria[];
    eth_total: number;
    energia_consumida: number;
  } {
    const bloques: RegistroMineria[] = [];
    let eth_total = 0;
    let energia_consumida = 0;

    // Minar mientras haya energía
    while (energia_consumida + this.energia_por_bloque <= energia_disponible) {
      const bloque = this.minar_bloque(energia_asignada_pct, nivel_atlas);
      bloques.push(bloque);
      eth_total += bloque.eth_generado;
      energia_consumida += this.energia_por_bloque;
    }

    return { bloques, eth_total, energia_consumida };
  }

  obtener_registro_hoy(): RegistroMineria[] {
    const hoy = new Date().toISOString().split('T')[0];
    const stmt = this.db.prepare(
      'SELECT * FROM mineria_registro WHERE fecha = ? ORDER BY timestamp DESC'
    );
    return stmt.all(hoy) as RegistroMineria[];
  }

  obtener_eth_total(desde_fecha?: string): number {
    let query = 'SELECT COALESCE(SUM(eth_generado), 0) as total FROM mineria_registro';
    if (desde_fecha) {
      query += ` WHERE fecha >= ?`;
      const stmt = this.db.prepare(query);
      const row = stmt.get(desde_fecha) as any;
      return row.total;
    }
    const stmt = this.db.prepare(query);
    const row = stmt.get() as any;
    return row.total;
  }

  actualizar_energia_asignada(pct: number) {
    if (pct < 0 || pct > 100) {
      throw new Error('Energía asignada debe estar entre 0 y 100');
    }

    const hoy = new Date().toISOString().split('T')[0];
    const ahora = new Date().toISOString();

    this.db.prepare(
      'UPDATE mineria_estado SET energia_asignada = ?, updated_at = ? WHERE fecha = ?'
    ).run(pct, ahora, hoy);
  }

  cerrar() {
    this.db.close();
  }
}
