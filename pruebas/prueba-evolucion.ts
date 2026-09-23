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

test('evolución: bot momentum genera variante con stop-loss', () => {
  limpiar();
  const motor = new MotorBots(DB_TEST);
  const sistema = new SistemaEvolucionBots(DB_TEST);

  const bot = motor.crear_bot({
    nombre: 'Momentum-BTC',
    estrategia: 'momentum',
    capital_inicial: 10000,
    simbolos: ['BTC'],
    parametros: {},
  });

  const mejorados = sistema.generar_bots_mejorados([bot]);

  assert.equal(mejorados.length, 1);
  assert.equal(mejorados[0].parametros_mejorados.stop_loss, -3);
  assert.equal(mejorados[0].parametros_mejorados.take_profit, 8);
  assert.ok(mejorados[0].nombre.includes('stop-loss'));

  motor.cerrar();
  sistema.cerrar();
  limpiar();
});

test('evolución: bot mean-reversion genera variante con bandas de Bollinger', () => {
  limpiar();
  const motor = new MotorBots(DB_TEST);
  const sistema = new SistemaEvolucionBots(DB_TEST);

  const bot = motor.crear_bot({
    nombre: 'MeanRev-ETH',
    estrategia: 'mean-reversion',
    capital_inicial: 10000,
    simbolos: ['ETH'],
    parametros: {},
  });

  const mejorados = sistema.generar_bots_mejorados([bot]);

  assert.equal(mejorados.length, 1);
  assert.equal(mejorados[0].parametros_mejorados.banda_superior, 2);
  assert.equal(mejorados[0].parametros_mejorados.banda_inferior, -2);
  assert.equal(mejorados[0].parametros_mejorados.confirmacion, 2);

  motor.cerrar();
  sistema.cerrar();
  limpiar();
});

test('evolución: bot buy-and-hold rentable genera variante con rebalanceo', () => {
  limpiar();
  const motor = new MotorBots(DB_TEST);
  const sistema = new SistemaEvolucionBots(DB_TEST);

  const bot = motor.crear_bot({
    nombre: 'Hold-SOL',
    estrategia: 'buy-and-hold',
    capital_inicial: 10000,
    simbolos: ['SOL'],
    parametros: {},
  });

  // Simular ganancia: comprar y vender con ganancia
  motor.ejecutar_orden_bot(bot.id, 'compra', 'SOL', 10, 100);
  motor.ejecutar_orden_bot(bot.id, 'venta', 'SOL', 10, 120);
  const bot_rentable = motor.obtener_bot(bot.id)!;

  const mejorados = sistema.generar_bots_mejorados([bot_rentable]);

  assert.equal(mejorados.length, 1);
  assert.equal(mejorados[0].parametros_mejorados.rebalanceo_frecuencia, 30);
  assert.equal(mejorados[0].parametros_mejorados.diversificacion, 0.5);

  motor.cerrar();
  sistema.cerrar();
  limpiar();
});

test('evolución: bot buy-and-hold sin ganancia NO genera variante mejorada', () => {
  limpiar();
  const motor = new MotorBots(DB_TEST);
  const sistema = new SistemaEvolucionBots(DB_TEST);

  const bot = motor.crear_bot({
    nombre: 'Hold-perdedor',
    estrategia: 'buy-and-hold',
    capital_inicial: 10000,
    simbolos: ['SOL'],
    parametros: {},
  });
  // Sin trades: ganancia_total = 0, no cumple "> 0"

  const mejorados = sistema.generar_bots_mejorados([bot]);

  assert.equal(mejorados.length, 0);

  motor.cerrar();
  sistema.cerrar();
  limpiar();
});

test('evolución: bot DCA con win_rate bajo NO genera variante mejorada', () => {
  limpiar();
  const motor = new MotorBots(DB_TEST);
  const sistema = new SistemaEvolucionBots(DB_TEST);

  const bot = motor.crear_bot({
    nombre: 'DCA-perdedor',
    estrategia: 'dca',
    capital_inicial: 10000,
    simbolos: ['BTC'],
    parametros: {},
  });
  // win_rate por defecto es 0, no supera el umbral de 50

  const mejorados = sistema.generar_bots_mejorados([bot]);

  assert.equal(mejorados.length, 0);

  motor.cerrar();
  sistema.cerrar();
  limpiar();
});

test('evolución: obtener_lecciones devuelve las lecciones de un bot específico', () => {
  limpiar();
  const sistema = new SistemaEvolucionBots(DB_TEST);

  sistema.registrar_error('bot-A', 'capital_insuficiente', 'Sin capital', {});
  sistema.registrar_error('bot-A', 'timeout', 'Muy lento', {});
  sistema.registrar_error('bot-B', 'precio_invalido', 'Precio raro', {});

  const lecciones_a = sistema.obtener_lecciones('bot-A');
  const lecciones_b = sistema.obtener_lecciones('bot-B');

  assert.equal(lecciones_a.length, 2);
  assert.equal(lecciones_b.length, 1);
  assert.ok(lecciones_b[0].leccion.includes('precio'));

  sistema.cerrar();
  limpiar();
});

test('evolución: cada tipo de error produce su lección y solución específicas', () => {
  limpiar();
  const sistema = new SistemaEvolucionBots(DB_TEST);

  sistema.registrar_error('bot-X', 'posicion_no_existe', 'Vender sin posición', {});
  sistema.registrar_error('bot-X', 'timeout', 'Tardó mucho', {});
  sistema.registrar_error('bot-X', 'otro', 'Algo raro', {});

  const lecciones = sistema.obtener_lecciones('bot-X');

  assert.equal(lecciones.length, 3);
  assert.ok(lecciones.some(l => l.leccion.includes('sin posición abierta')));
  assert.ok(lecciones.some(l => l.solucion.includes('timeout') || l.leccion.includes('tiempo')));
  assert.ok(lecciones.some(l => l.leccion.includes('desconocido')));

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
