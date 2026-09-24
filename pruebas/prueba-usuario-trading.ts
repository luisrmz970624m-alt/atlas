import { test } from 'node:test';
import * as assert from 'node:assert';
import { existsSync, unlinkSync } from 'node:fs';
import Database from 'better-sqlite3';
import { TradingEngine, USUARIO_ID, CAPITAL_INICIAL_USUARIO } from '../src/trading.ts';
import { OrquestadorV08 } from '../src/orquestador-v08.ts';


const DB_TEST = 'datos/usuario-trading-test.db';
const ESTADO_TEST = 'datos/usuario-trading-test-state.json';

function limpiar() {
  if (existsSync(DB_TEST)) unlinkSync(DB_TEST);
  if (existsSync(ESTADO_TEST)) unlinkSync(ESTADO_TEST);
}

test('usuario: obtener_portafolio_por_usuario encuentra por usuario_id, no por id', () => {
  limpiar();
  const trading = new TradingEngine(DB_TEST);

  const creado = trading.crear_portafolio(USUARIO_ID, 10000);

  // El bug original: buscar el portafolio pasando el usuario_id a obtener_portafolio(),
  // que espera el UUID del portafolio. Debe devolver null.
  assert.equal(trading.obtener_portafolio(USUARIO_ID), null);

  // La búsqueda correcta sí lo encuentra.
  const encontrado = trading.obtener_portafolio_por_usuario(USUARIO_ID);
  assert.equal(encontrado?.id, creado.id);

  trading.cerrar();
  limpiar();
});

test('usuario: asegurar_portafolio crea la primera vez y reutiliza después', () => {
  limpiar();
  const trading = new TradingEngine(DB_TEST);

  const primero = trading.asegurar_portafolio(USUARIO_ID, CAPITAL_INICIAL_USUARIO);
  const segundo = trading.asegurar_portafolio(USUARIO_ID, CAPITAL_INICIAL_USUARIO);

  assert.equal(primero.id, segundo.id);
  assert.equal(primero.capital_inicial, CAPITAL_INICIAL_USUARIO);

  trading.cerrar();
  limpiar();
});

test('usuario: estadísticas vacías cuando no hay operaciones', () => {
  limpiar();
  const trading = new TradingEngine(DB_TEST);
  const p = trading.asegurar_portafolio(USUARIO_ID, 10000);

  const stats = trading.obtener_estadisticas(p.id);

  assert.equal(stats.operaciones_cerradas, 0);
  assert.equal(stats.win_rate, 0);
  assert.equal(stats.pnl_realizado, 0);

  trading.cerrar();
  limpiar();
});

test('usuario: una compra abierta NO cuenta como operación cerrada', () => {
  limpiar();
  const trading = new TradingEngine(DB_TEST);
  const p = trading.asegurar_portafolio(USUARIO_ID, 10000);

  trading.comprar(p.id, 'BTC', 0.05, 50000);

  const stats = trading.obtener_estadisticas(p.id);

  // Mismo criterio que los bots: solo las ventas cierran una operación.
  assert.equal(stats.operaciones_cerradas, 0);

  trading.cerrar();
  limpiar();
});

test('usuario: venta con ganancia cuenta como ganadora e incluye ambas comisiones', () => {
  limpiar();
  const trading = new TradingEngine(DB_TEST);
  const p = trading.asegurar_portafolio(USUARIO_ID, 10000);

  trading.comprar(p.id, 'BTC', 0.05, 50000);  // costo 2500 + comisión 2.50
  trading.vender(p.id, 'BTC', 0.05, 60000);   // ingreso 3000 - comisión 3.00

  const stats = trading.obtener_estadisticas(p.id);

  assert.equal(stats.operaciones_cerradas, 1);
  assert.equal(stats.ganadoras, 1);
  assert.equal(stats.perdedoras, 0);
  assert.equal(stats.win_rate, 100);

  // (3000 - 3.00) - (2500 + 2.50) = 494.50
  assert.ok(Math.abs(stats.pnl_realizado - 494.5) < 0.01);

  trading.cerrar();
  limpiar();
});

test('usuario: venta con pérdida cuenta como perdedora', () => {
  limpiar();
  const trading = new TradingEngine(DB_TEST);
  const p = trading.asegurar_portafolio(USUARIO_ID, 10000);

  trading.comprar(p.id, 'BTC', 0.05, 50000);
  trading.vender(p.id, 'BTC', 0.05, 40000);

  const stats = trading.obtener_estadisticas(p.id);

  assert.equal(stats.operaciones_cerradas, 1);
  assert.equal(stats.ganadoras, 0);
  assert.equal(stats.perdedoras, 1);
  assert.equal(stats.win_rate, 0);
  assert.ok(stats.pnl_realizado < 0);

  trading.cerrar();
  limpiar();
});

test('usuario: win_rate mixto se calcula sobre operaciones cerradas', () => {
  limpiar();
  const trading = new TradingEngine(DB_TEST);
  const p = trading.asegurar_portafolio(USUARIO_ID, 100000);

  trading.comprar(p.id, 'BTC', 0.1, 50000);
  trading.vender(p.id, 'BTC', 0.1, 60000);   // ganadora
  trading.comprar(p.id, 'ETH', 1, 3000);
  trading.vender(p.id, 'ETH', 1, 2000);      // perdedora
  trading.comprar(p.id, 'SOL', 10, 100);
  trading.vender(p.id, 'SOL', 10, 150);      // ganadora

  const stats = trading.obtener_estadisticas(p.id);

  assert.equal(stats.operaciones_cerradas, 3);
  assert.equal(stats.ganadoras, 2);
  assert.equal(stats.perdedoras, 1);
  assert.ok(Math.abs(stats.win_rate - 66.67) < 0.1);

  trading.cerrar();
  limpiar();
});

test('usuario: venta parcial usa el costo promedio de varias compras', () => {
  limpiar();
  const trading = new TradingEngine(DB_TEST);
  const p = trading.asegurar_portafolio(USUARIO_ID, 100000);

  trading.comprar(p.id, 'BTC', 1, 10000);   // costo 10000 + 10
  trading.comprar(p.id, 'BTC', 1, 20000);   // costo 20000 + 20
  // promedio con comisiones: 30030 / 2 = 15015 por unidad
  trading.vender(p.id, 'BTC', 1, 20000);    // ingreso 20000 - 20 = 19980

  const stats = trading.obtener_estadisticas(p.id);

  assert.equal(stats.operaciones_cerradas, 1);
  assert.equal(stats.ganadoras, 1);
  // 19980 - 15015 = 4965
  assert.ok(Math.abs(stats.pnl_realizado - 4965) < 0.01);

  trading.cerrar();
  limpiar();
});

test('competencia: el orquestador refleja las operaciones reales del usuario', async () => {
  limpiar();

  const trading = new TradingEngine(DB_TEST);
  const p = trading.asegurar_portafolio(USUARIO_ID, 10000);
  trading.comprar(p.id, 'BTC', 0.05, 50000);
  trading.vender(p.id, 'BTC', 0.05, 60000);
  trading.cerrar();

  const orq = new OrquestadorV08(DB_TEST, ESTADO_TEST);
  const estado = await orq.obtener_estado();

  // Antes estos dos venían hardcodeados en 0 (los TODO del orquestador).
  assert.equal(estado.portafolio_usuario.trades, 1);
  assert.equal(estado.portafolio_usuario.win_rate, 100);

  // Y la ganancia sale del portafolio real, no de un capital fijo.
  assert.ok(estado.portafolio_usuario.ganancia > 0);
  assert.equal(estado.competencia.lider, 'usuario');

  orq.cerrar();
  limpiar();
});

test('competencia: comprar no se ve como pérdida (valora las posiciones abiertas)', async () => {
  limpiar();

  const trading = new TradingEngine(DB_TEST);
  const p = trading.asegurar_portafolio(USUARIO_ID, 10000);
  const cantidad = 0.01;
  const precio_compra = 50000;
  trading.comprar(p.id, 'BTC', cantidad, precio_compra); // baja el efectivo, pero tiene el activo
  trading.cerrar();

  const orq = new OrquestadorV08(DB_TEST, ESTADO_TEST);
  const estado = await orq.obtener_estado();

  // No se compara contra el precio del momento (fluctúa, y el fallback
  // simulado genera un random walk distinto por instancia). Se comprueba la
  // propiedad que importa: con el bug, la ganancia era el desembolso completo
  // en negativo (-$500.50); valorando la posición, solo puede moverse lo que
  // se mueva el precio. BTC tendría que desplomarse bajo $10.000 para bajar
  // de este umbral.
  const desembolso = cantidad * precio_compra; // $500
  assert.ok(
    estado.portafolio_usuario.ganancia > -(desembolso * 0.8),
    `ganancia fue ${estado.portafolio_usuario.ganancia}; con el bug sería ≈ -${desembolso}`
  );

  orq.cerrar();
  limpiar();
});

test('usuario: solo cuenta las órdenes ejecutadas, no las canceladas', () => {
  limpiar();
  const trading = new TradingEngine(DB_TEST);
  const p = trading.asegurar_portafolio(USUARIO_ID, 100000);

  trading.comprar(p.id, 'BTC', 1, 10000);
  trading.vender(p.id, 'BTC', 1, 12000);

  // Una orden cancelada inyectada a mano no debe alterar las estadísticas.
  const db = new Database(DB_TEST);
  db.prepare(`
    INSERT INTO ordenes (id, portafolio_id, tipo, simbolo, cantidad, precio, estado, comision, executed_at)
    VALUES ('cancelada-1', ?, 'venta', 'BTC', 5, 99999, 'cancelada', 0, ?)
  `).run(p.id, new Date().toISOString());
  db.close();

  const stats = trading.obtener_estadisticas(p.id);

  assert.equal(stats.operaciones_cerradas, 1);
  assert.equal(stats.ganadoras, 1);

  trading.cerrar();
  limpiar();
});

test('usuario: el orden del replay no depende de timestamps empatados', () => {
  limpiar();
  const trading = new TradingEngine(DB_TEST);
  const p = trading.asegurar_portafolio(USUARIO_ID, 100000);

  // Compra y venta con el MISMO executed_at: sin desempate por rowid, SQLite
  // podría devolver la venta primero y el costo base saldría del fallback.
  const mismo_instante = new Date().toISOString();
  const db = new Database(DB_TEST);
  db.prepare(`
    INSERT INTO ordenes (id, portafolio_id, tipo, simbolo, cantidad, precio, estado, comision, executed_at)
    VALUES ('compra-1', ?, 'compra', 'BTC', 1, 10000, 'ejecutada', 10, ?)
  `).run(p.id, mismo_instante);
  db.prepare(`
    INSERT INTO ordenes (id, portafolio_id, tipo, simbolo, cantidad, precio, estado, comision, executed_at)
    VALUES ('venta-1', ?, 'venta', 'BTC', 1, 20000, 'ejecutada', 20, ?)
  `).run(p.id, mismo_instante);
  db.close();

  const stats = trading.obtener_estadisticas(p.id);

  // 19980 - 10010 = 9970 de ganancia, no una pérdida por costo base perdido.
  assert.equal(stats.ganadoras, 1);
  assert.ok(Math.abs(stats.pnl_realizado - 9970) < 0.01, `pnl fue ${stats.pnl_realizado}`);

  trading.cerrar();
  limpiar();
});

test('usuario: una operación a break-even no cuenta ni como ganadora ni perdedora', () => {
  limpiar();
  const trading = new TradingEngine(DB_TEST);
  const p = trading.asegurar_portafolio(USUARIO_ID, 100000);

  // Sin comisiones (inyectadas a mano) para lograr un cero exacto.
  const db = new Database(DB_TEST);
  const ahora = new Date().toISOString();
  db.prepare(`
    INSERT INTO ordenes (id, portafolio_id, tipo, simbolo, cantidad, precio, estado, comision, executed_at)
    VALUES ('c1', ?, 'compra', 'BTC', 1, 10000, 'ejecutada', 0, ?)
  `).run(p.id, ahora);
  db.prepare(`
    INSERT INTO ordenes (id, portafolio_id, tipo, simbolo, cantidad, precio, estado, comision, executed_at)
    VALUES ('v1', ?, 'venta', 'BTC', 1, 10000, 'ejecutada', 0, ?)
  `).run(p.id, ahora);
  db.close();

  const stats = trading.obtener_estadisticas(p.id);

  assert.equal(stats.operaciones_cerradas, 1);
  assert.equal(stats.ganadoras, 0);
  assert.equal(stats.perdedoras, 0);
  assert.equal(stats.pnl_realizado, 0);

  trading.cerrar();
  limpiar();
});

test('usuario: vender todo no deja posiciones fantasma por coma flotante', () => {
  limpiar();
  const trading = new TradingEngine(DB_TEST);
  const p = trading.asegurar_portafolio(USUARIO_ID, 100000);

  trading.comprar(p.id, 'BTC', 0.1, 10000);
  trading.comprar(p.id, 'BTC', 0.2, 10000);  // 0.1 + 0.2 = 0.30000000000000004
  trading.vender(p.id, 'BTC', 0.3, 10000);

  const posiciones = trading.obtener_posiciones(p.id);

  assert.equal(posiciones.length, 0, `quedó ${JSON.stringify(posiciones)}`);

  trading.cerrar();
  limpiar();
});

test('usuario: calcular_pnl y obtener_estadisticas dan el mismo PnL realizado', () => {
  limpiar();
  const trading = new TradingEngine(DB_TEST);
  const p = trading.asegurar_portafolio(USUARIO_ID, 100000);

  trading.comprar(p.id, 'BTC', 1, 10000);
  trading.vender(p.id, 'BTC', 1, 12000);   // cierra la posición por completo

  const stats = trading.obtener_estadisticas(p.id);
  const pnl = trading.calcular_pnl(p.id, { BTC: 12000 });

  // Antes divergían: calcular_pnl daba 0 para operaciones ya cerradas.
  assert.equal(pnl.pnl_realizado, stats.pnl_realizado);
  assert.ok(pnl.pnl_realizado > 0);

  trading.cerrar();
  limpiar();
});

test('usuario: un solo portafolio por usuario (índice UNIQUE)', () => {
  limpiar();
  const trading = new TradingEngine(DB_TEST);

  trading.crear_portafolio(USUARIO_ID, 10000);

  assert.throws(() => trading.crear_portafolio(USUARIO_ID, 99999));

  trading.cerrar();
  limpiar();
});

test('usuario: el orquestador usa el capital inicial real del portafolio', async () => {
  limpiar();

  const trading = new TradingEngine(DB_TEST);
  trading.asegurar_portafolio(USUARIO_ID, 55000); // distinto del default de 10000
  trading.cerrar();

  const orq = new OrquestadorV08(DB_TEST, ESTADO_TEST);
  const estado = await orq.obtener_estado();

  assert.equal(estado.portafolio_usuario.capital, 55000);

  orq.cerrar();
  limpiar();
});
