import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { MotorMineria } from '../src/mineria.ts';
import { MotorBots } from '../src/bots.ts';
import { GestorCompetencia } from '../src/competencia.ts';
import { GestorEnergia } from '../src/energia.ts';

const DB_TEST = 'datos/test-cli.db';

test('CLI V0.8 - Minería: obtener estado', () => {
  const mineria = new MotorMineria(DB_TEST);
  const estado = mineria.obtener_estado_hoy();

  strictEqual(typeof estado.energia_asignada, 'number');
  strictEqual(typeof estado.eth_generado_hoy, 'number');
  strictEqual(typeof estado.bloques_minados, 'number');
  strictEqual(typeof estado.dificultad, 'number');

  mineria.cerrar();
});

test('CLI V0.8 - Minería: ejecutar sesión', () => {
  const mineria = new MotorMineria(DB_TEST);
  const energia = new GestorEnergia(DB_TEST);

  const resultado = mineria.minar_sesion(10, 50, 1);

  strictEqual(typeof resultado.eth_total, 'number');
  strictEqual(resultado.bloques.length > 0, true);
  strictEqual(resultado.energia_consumida > 0, true);

  mineria.cerrar();
  energia.cerrar();
});

test('CLI V0.8 - Minería: historial', () => {
  const mineria = new MotorMineria(DB_TEST);

  const registro = mineria.obtener_registro_hoy();

  strictEqual(Array.isArray(registro), true);
  if (registro.length > 0) {
    strictEqual(typeof registro[0].timestamp, 'string');
    strictEqual(typeof registro[0].eth_generado, 'number');
  }

  mineria.cerrar();
});

test('CLI V0.8 - Bots: crear bot', () => {
  const bots = new MotorBots(DB_TEST);

  const bot = bots.crear_bot({
    nombre: `TestBot1-${Date.now()}`,
    estrategia: 'dca',
    capital_inicial: 1000,
    simbolos: ['ETH'],
    parametros: { cantidad_compra: 0.5, umbral_venta: 10 },
  });

  strictEqual(bot.nombre.includes('TestBot1'), true);
  strictEqual(bot.estrategia, 'dca');
  strictEqual(bot.estado, 'activo');

  bots.cerrar();
});

test('CLI V0.8 - Bots: listar bots', () => {
  const bots = new MotorBots(DB_TEST);

  bots.crear_bot({
    nombre: `Bot1-${Date.now()}`,
    estrategia: 'momentum',
    capital_inicial: 500,
    simbolos: ['BTC'],
    parametros: { cantidad_compra: 0.1, umbral_venta: 5 },
  });

  const lista = bots.listar_bots();

  strictEqual(lista.length > 0, true);
  strictEqual(typeof lista[0].id, 'string');
  strictEqual(typeof lista[0].nombre, 'string');

  bots.cerrar();
});

test('CLI V0.8 - Bots: obtener estadísticas', () => {
  const bots = new MotorBots(DB_TEST);

  const bot = bots.crear_bot({
    nombre: `TestBot-${Date.now()}`,
    estrategia: 'buy-and-hold',
    capital_inicial: 2000,
    simbolos: ['SOL'],
    parametros: {},
  });

  strictEqual(typeof bot.trades_ejecutados, 'number');
  strictEqual(typeof bot.win_rate, 'number');
  strictEqual(typeof bot.ganancia_total, 'number');

  bots.cerrar();
});

test('CLI V0.8 - Competencia: registrar resultado', () => {
  const competencia = new GestorCompetencia(DB_TEST);

  competencia.registrar_resultado_diario(0.5, 10000, 0.3, 10000);

  const stats = competencia.obtener_estadisticas(30);

  strictEqual(stats.usuario_ganancias >= 0.5, true);
  strictEqual(stats.atlas_ganancias >= 0.3, true);

  competencia.cerrar();
});

test('CLI V0.8 - Competencia: crear snapshot', () => {
  const competencia = new GestorCompetencia(DB_TEST);

  const snap = competencia.crear_snapshot(10000, 100, 5, 60, 10000, 80, 4, 2, 55);

  strictEqual(typeof snap.usuario.ganancia, 'number');
  strictEqual(typeof snap.atlas.ganancia, 'number');
  strictEqual(typeof snap.diferencia, 'number');
  strictEqual(snap.lider, 'usuario');

  competencia.cerrar();
});

test('CLI V0.8 - Competencia: obtener estadísticas', () => {
  const competencia = new GestorCompetencia(DB_TEST);

  const stats = competencia.obtener_estadisticas(30);

  strictEqual(typeof stats.dias_jugados, 'number');
  strictEqual(typeof stats.usuario_ganancias, 'number');
  strictEqual(typeof stats.atlas_ganancias, 'number');

  competencia.cerrar();
});

test('CLI V0.8 - Energía: consumir energía', () => {
  const energia = new GestorEnergia(DB_TEST);

  const estado_inicial = energia.obtener_estado_hoy();
  const consumo = 5;

  energia.consumir_energia('minar', consumo, { eth: 0.001 });

  const estado_final = energia.obtener_estado_hoy();

  strictEqual(estado_final.energia_usada > estado_inicial.energia_usada, true);

  energia.cerrar();
});

test('CLI V0.8 - Energía: validar asignación', () => {
  const energia = new GestorEnergia(DB_TEST);

  try {
    energia.establecer_asignacion(-10, 50, 60);
    throw new Error('Debería rechazar asignación negativa');
  } catch (e) {
    strictEqual((e as Error).message.includes('negativa'), true);
  }

  energia.cerrar();
});
