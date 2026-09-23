import { test } from 'node:test';
import * as assert from 'node:assert';
import { SistemaEvolucionBots } from '../src/evolucion-bots.ts';
import { MotorBots } from '../src/bots.ts';
import { unlinkSync, existsSync } from 'node:fs';

const DB_TEST = 'datos/evolucion-test.db';

function limpiar() {
  if (existsSync(DB_TEST)) unlinkSync(DB_TEST);
}

test('evolución: registrar error', () => {
  limpiar();
  const sistema = new SistemaEvolucionBots(DB_TEST);

  sistema.registrar_error(
    'bot-1',
    'capital_insuficiente',
    'Intentó comprar BTC pero no tiene capital',
    { simbolo: 'BTC', cantidad: 1, precio: 50000 }
  );

  const errores = sistema.analizar_errores_comunes();
  assert.ok(errores['capital_insuficiente'] >= 1);

  sistema.cerrar();
  limpiar();
});

test('evolución: aprender de errores', () => {
  limpiar();
  const sistema = new SistemaEvolucionBots(DB_TEST);

  // Registrar varios errores
  sistema.registrar_error('bot-1', 'capital_insuficiente', 'Sin capital', {});
  sistema.registrar_error('bot-1', 'posicion_no_existe', 'No hay posición', {});
  sistema.registrar_error('bot-2', 'capital_insuficiente', 'Sin capital', {});

  const errores = sistema.analizar_errores_comunes();
  assert.equal(errores['capital_insuficiente'], 2);
  assert.equal(errores['posicion_no_existe'], 1);

  sistema.cerrar();
  limpiar();
});

test('evolución: generar bots mejorados', () => {
  limpiar();
  const motor = new MotorBots(DB_TEST);
  const sistema = new SistemaEvolucionBots(DB_TEST);

  // Crear bot base con buen win_rate
  const bot = motor.crear_bot({
    nombre: 'DCA-BTC',
    estrategia: 'dca',
    capital_inicial: 10000,
    simbolos: ['BTC'],
    parametros: { cantidad_diaria: 100 },
  });

  // Simular que ganó operaciones
  motor.ejecutar_orden_bot(bot.id, 'compra', 'BTC', 0.1, 50000);
  motor.ejecutar_orden_bot(bot.id, 'venta', 'BTC', 0.1, 55000); // +$500

  const bot_updated = motor.obtener_bot(bot.id)!;
  const bots_mejorados = sistema.generar_bots_mejorados([bot_updated]);

  assert.ok(bots_mejorados.length > 0);

  // Verificar que el bot mejorado tiene parámetros diferentes
  const mejorado = bots_mejorados[0];
  assert.ok(mejorado.parametros_mejorados.cantidad_diaria > mejorado.parametros_originales.cantidad_diaria);
  assert.ok(mejorado.mejoras.length > 0);

  motor.cerrar();
  sistema.cerrar();
  limpiar();
});

test('evolución: reporte de evolución', () => {
  limpiar();
  const motor = new MotorBots(DB_TEST);
  const sistema = new SistemaEvolucionBots(DB_TEST);

  // Crear bot y generar errores
  const bot = motor.crear_bot({
    nombre: 'Momentum-ETH',
    estrategia: 'momentum',
    capital_inicial: 10000,
    simbolos: ['ETH'],
    parametros: {},
  });

  sistema.registrar_error('bot-1', 'capital_insuficiente', 'Sin capital', {});
  sistema.registrar_error('bot-2', 'capital_insuficiente', 'Sin capital', {});

  const bot_updated = motor.obtener_bot(bot.id)!;
  sistema.generar_bots_mejorados([bot_updated]);

  const reporte = sistema.generar_reporte_evolucion();

  assert.ok(reporte.bots_mejorados_disponibles > 0);
  assert.equal(reporte.errores_totales, 2);
  assert.ok(reporte.errores_comunes['capital_insuficiente'] >= 2);

  motor.cerrar();
  sistema.cerrar();
  limpiar();
});
