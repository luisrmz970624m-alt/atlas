import { test } from 'node:test';
import * as assert from 'node:assert';
import { TradingEngine } from '../src/trading.ts';
import { unlinkSync, existsSync } from 'node:fs';

const DB_TEST = 'datos/trading-test.db';

function limpiar() {
  if (existsSync(DB_TEST)) unlinkSync(DB_TEST);
}

test('trading: crear portafolio', () => {
  limpiar();
  const engine = new TradingEngine(DB_TEST);

  const p = engine.crear_portafolio('usuario-1', 10000);

  assert.equal(p.capital_inicial, 10000);
  assert.equal(p.capital_actual, 10000);
  assert.equal(p.usuario_id, 'usuario-1');

  engine.cerrar();
  limpiar();
});

test('trading: compra correcta', () => {
  limpiar();
  const engine = new TradingEngine(DB_TEST);
  const p = engine.crear_portafolio('usuario-1', 1000000);

  // Compra 10 BTC a $50,000
  const orden = engine.comprar(p.id, 'BTC', 10, 50000);

  assert.equal(orden.tipo, 'compra');
  assert.equal(orden.simbolo, 'BTC');
  assert.equal(orden.cantidad, 10);
  assert.equal(orden.precio, 50000);
  assert.equal(orden.estado, 'ejecutada');

  // Verificar portafolio actualizado
  const p_updated = engine.obtener_portafolio(p.id)!;
  const costo = 10 * 50000 + orden.comision; // $500,000 + comisión
  const capital_esperado = 1000000 - costo;

  assert.equal(p_updated.capital_actual, capital_esperado);

  // Verificar posición
  const posiciones = engine.obtener_posiciones(p.id);
  assert.equal(posiciones.length, 1);
  assert.equal(posiciones[0].simbolo, 'BTC');
  assert.equal(posiciones[0].cantidad, 10);
  assert.equal(posiciones[0].precio_promedio, 50000);

  engine.cerrar();
  limpiar();
});

test('trading: rechazo compra sin capital', () => {
  limpiar();
  const engine = new TradingEngine(DB_TEST);
  const p = engine.crear_portafolio('usuario-1', 1000);

  // Intentar comprar BTC por más de $1000
  assert.throws(() => {
    engine.comprar(p.id, 'BTC', 10, 50000);
  }, /Capital insuficiente/);

  engine.cerrar();
  limpiar();
});

test('trading: venta correcta', () => {
  limpiar();
  const engine = new TradingEngine(DB_TEST);
  const p = engine.crear_portafolio('usuario-1', 100000);

  // Compra 1 BTC a $50,000
  engine.comprar(p.id, 'BTC', 1, 50000);

  // Vende 1 BTC a $60,000
  const orden_venta = engine.vender(p.id, 'BTC', 1, 60000);

  assert.equal(orden_venta.tipo, 'venta');
  assert.equal(orden_venta.simbolo, 'BTC');
  assert.equal(orden_venta.cantidad, 1);

  // Verificar que la posición desapareció
  const posiciones = engine.obtener_posiciones(p.id);
  assert.equal(posiciones.length, 0);

  // Verificar capital (debería tener ganancia)
  const p_updated = engine.obtener_portafolio(p.id)!;
  assert.ok(p_updated.capital_actual > 100000);

  engine.cerrar();
  limpiar();
});

test('trading: precio promedio con múltiples compras', () => {
  limpiar();
  const engine = new TradingEngine(DB_TEST);
  const p = engine.crear_portafolio('usuario-1', 200000);

  // Compra 1 BTC a $50,000
  engine.comprar(p.id, 'BTC', 1, 50000);

  // Compra 1 BTC a $52,000
  engine.comprar(p.id, 'BTC', 1, 52000);

  const posiciones = engine.obtener_posiciones(p.id);
  assert.equal(posiciones.length, 1);
  assert.equal(posiciones[0].cantidad, 2);

  // Precio promedio: (1*50000 + 1*52000) / 2 = 51000
  const precio_esperado = 51000;
  assert.equal(posiciones[0].precio_promedio, precio_esperado);

  engine.cerrar();
  limpiar();
});

test('trading: rechazo venta sin cantidad', () => {
  limpiar();
  const engine = new TradingEngine(DB_TEST);
  const p = engine.crear_portafolio('usuario-1', 100000);

  engine.comprar(p.id, 'BTC', 1, 50000);

  // Intentar vender 2 BTC cuando solo tenemos 1
  assert.throws(() => {
    engine.vender(p.id, 'BTC', 2, 60000);
  }, /No tienes/);

  engine.cerrar();
  limpiar();
});

test('trading: historial de órdenes', () => {
  limpiar();
  const engine = new TradingEngine(DB_TEST);
  const p = engine.crear_portafolio('usuario-1', 100000);

  engine.comprar(p.id, 'BTC', 1, 50000);
  engine.comprar(p.id, 'ETH', 10, 3000);
  engine.vender(p.id, 'BTC', 0.5, 55000);

  const ordenes = engine.obtener_ordenes(p.id);
  assert.equal(ordenes.length, 3);
  assert.equal(ordenes[0].tipo, 'venta'); // Más reciente primero
  assert.equal(ordenes[1].tipo, 'compra');
  assert.equal(ordenes[2].tipo, 'compra');

  engine.cerrar();
  limpiar();
});

test('trading: cálculo de PnL', () => {
  limpiar();
  const engine = new TradingEngine(DB_TEST);
  const p = engine.crear_portafolio('usuario-1', 100000);

  engine.comprar(p.id, 'BTC', 1, 50000);

  // Precios actuales
  const precios = { BTC: 60000 };

  const pnl = engine.calcular_pnl(p.id, precios);

  // PnL no realizado: (60000 - 50000) * 1 = 10000
  assert.ok(pnl.pnl_no_realizado > 0);

  // ROI > 0 porque ganamos dinero
  assert.ok(pnl.roi > 0);

  engine.cerrar();
  limpiar();
});
