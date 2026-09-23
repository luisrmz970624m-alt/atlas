import { test } from 'node:test';
import * as assert from 'node:assert';
import { MotorBots } from '../src/bots.ts';
import { GestorCompetencia } from '../src/competencia.ts';
import { unlinkSync, existsSync } from 'node:fs';

const DB_TEST = 'datos/bots-test.db';

function limpiar() {
  if (existsSync(DB_TEST)) unlinkSync(DB_TEST);
}

test('bots: crear bot', () => {
  limpiar();
  const motor = new MotorBots(DB_TEST);

  const bot = motor.crear_bot({
    nombre: 'DCA-BTC',
    estrategia: 'dca',
    capital_inicial: 10000,
    simbolos: ['BTC'],
    parametros: { cantidad_diaria: 100 },
  });

  assert.equal(bot.nombre, 'DCA-BTC');
  assert.equal(bot.estrategia, 'dca');
  assert.equal(bot.capital_inicial, 10000);
  assert.equal(bot.capital_actual, 10000);
  assert.equal(bot.estado, 'activo');

  motor.cerrar();
  limpiar();
});

test('bots: ejecutar compra', () => {
  limpiar();
  const motor = new MotorBots(DB_TEST);

  const bot = motor.crear_bot({
    nombre: 'DCA-BTC',
    estrategia: 'dca',
    capital_inicial: 10000,
    simbolos: ['BTC'],
    parametros: {},
  });

  const orden = motor.ejecutar_orden_bot(
    bot.id,
    'compra',
    'BTC',
    0.1,
    50000
  );

  assert.equal(orden.tipo, 'compra');
  assert.equal(orden.simbolo, 'BTC');
  assert.equal(orden.cantidad, 0.1);
  assert.equal(orden.precio_entrada, 50000);
  assert.equal(orden.estado, 'abierta');

  const bot_updated = motor.obtener_bot(bot.id)!;
  assert.equal(bot_updated.capital_actual, 10000 - (0.1 * 50000));

  motor.cerrar();
  limpiar();
});

test('bots: ejecutar venta y calcular ganancia', () => {
  limpiar();
  const motor = new MotorBots(DB_TEST);

  const bot = motor.crear_bot({
    nombre: 'DCA-BTC',
    estrategia: 'dca',
    capital_inicial: 10000,
    simbolos: ['BTC'],
    parametros: {},
  });

  // Comprar 0.1 BTC a $50,000
  motor.ejecutar_orden_bot(bot.id, 'compra', 'BTC', 0.1, 50000);

  // Vender 0.1 BTC a $55,000 (+$500 ganancia)
  motor.ejecutar_orden_bot(bot.id, 'venta', 'BTC', 0.1, 55000);

  const bot_updated = motor.obtener_bot(bot.id)!;

  assert.equal(bot_updated.trades_ejecutados, 1);
  assert.equal(bot_updated.trades_ganadores, 1);
  assert.equal(bot_updated.win_rate, 100);
  assert.ok(bot_updated.ganancia_total > 0);

  motor.cerrar();
  limpiar();
});

test('bots: rechazar compra sin capital', () => {
  limpiar();
  const motor = new MotorBots(DB_TEST);

  const bot = motor.crear_bot({
    nombre: 'DCA-BTC',
    estrategia: 'dca',
    capital_inicial: 1000,
    simbolos: ['BTC'],
    parametros: {},
  });

  assert.throws(() => {
    motor.ejecutar_orden_bot(bot.id, 'compra', 'BTC', 1, 50000);
  }, /Capital insuficiente/);

  motor.cerrar();
  limpiar();
});

test('bots: listar bots', () => {
  limpiar();
  const motor = new MotorBots(DB_TEST);

  motor.crear_bot({
    nombre: 'Bot-1',
    estrategia: 'dca',
    capital_inicial: 10000,
    simbolos: ['BTC'],
    parametros: {},
  });

  motor.crear_bot({
    nombre: 'Bot-2',
    estrategia: 'momentum',
    capital_inicial: 5000,
    simbolos: ['ETH'],
    parametros: {},
  });

  const bots = motor.listar_bots();
  assert.equal(bots.length, 2);
  assert.equal(bots[0].nombre, 'Bot-2'); // Más reciente primero

  motor.cerrar();
  limpiar();
});

test('competencia: registrar resultado diario', () => {
  limpiar();
  const gestor = new GestorCompetencia(DB_TEST);

  gestor.registrar_resultado_diario(
    500,   // Usuario ganó $500
    10000, // De capital inicial 10000 (5%)
    300,   // Atlas ganó $300
    10000  // De capital inicial 10000 (3%)
  );

  const stats = gestor.obtener_estadisticas(1);

  assert.equal(stats.dias_jugados, 1);
  assert.equal(stats.usuario_ganancias, 500);
  assert.equal(stats.atlas_ganancias, 300);
  assert.equal(stats.usuario_win_days, 1);
  assert.equal(stats.atlas_win_days, 0);

  gestor.cerrar();
  limpiar();
});

test('competencia: snapshot actual', () => {
  limpiar();
  const gestor = new GestorCompetencia(DB_TEST);

  const snapshot = gestor.crear_snapshot(
    11000,  // usuario capital
    1000,   // usuario ganancia
    5,      // usuario trades
    60,     // usuario win_rate
    10800,  // atlas capital
    800,    // atlas ganancia
    12,     // atlas trades
    2,      // atlas bots activos
    65      // atlas win_rate
  );

  assert.equal(snapshot.usuario.capital, 11000);
  assert.equal(snapshot.atlas.capital, 10800);
  assert.equal(snapshot.diferencia, 200); // Usuario gana por $200
  assert.equal(snapshot.lider, 'usuario');

  gestor.cerrar();
  limpiar();
});

test('competencia: obtener estadísticas después de registro', () => {
  limpiar();
  const gestor = new GestorCompetencia(DB_TEST);

  // Registrar un resultado
  gestor.registrar_resultado_diario(500, 10000, 300, 10000);

  const stats = gestor.obtener_estadisticas(30);

  assert.equal(stats.dias_jugados, 1);
  assert.equal(stats.usuario_win_days, 1);
  assert.equal(stats.atlas_win_days, 0);
  assert.equal(stats.empates, 0);
  assert.equal(stats.usuario_ganancias, 500);
  assert.equal(stats.atlas_ganancias, 300);

  gestor.cerrar();
  limpiar();
});
