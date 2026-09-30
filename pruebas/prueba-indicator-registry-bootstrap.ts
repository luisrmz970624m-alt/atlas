import test from 'node:test';
import assert from 'node:assert/strict';
import { IndicatorRegistry, bootstrapMACrossIndicador, inicializarIR, asignarIR } from '../src/trading-lab/indicator-registry.ts';

test('registry: bootstrap MA_CROSS idempotente', () => {
  const registry = new IndicatorRegistry();

  // Primera vez: registro
  bootstrapMACrossIndicador(registry);
  let estado1 = registry.estado();
  assert.equal(estado1.totalIndicadores, 1);

  // Segunda vez: noop (idempotente)
  bootstrapMACrossIndicador(registry);
  let estado2 = registry.estado();
  assert.equal(estado2.totalIndicadores, 1);
});

test('registry: MA_CROSS realmente registrado', () => {
  const registry = new IndicatorRegistry();
  bootstrapMACrossIndicador(registry);

  const spec = registry.obtenerIndicador('MA_CROSS');
  assert.ok(spec);
  assert.equal(spec.indicatorId, 'MA_CROSS');
  assert.equal(spec.version, '1.0');
  assert.equal(spec.category, 'TREND');
  assert.equal(spec.status, 'ACTIVE');
});

test('registry: MA_CROSS está en activos', () => {
  const registry = new IndicatorRegistry();
  bootstrapMACrossIndicador(registry);

  const activos = registry.listarActivos();
  assert.equal(activos.length, 1);
  assert.equal(activos[0]!.indicatorId, 'MA_CROSS');
});

test('registry: MA_CROSS en categoría TREND', () => {
  const registry = new IndicatorRegistry();
  bootstrapMACrossIndicador(registry);

  const trend = registry.obtenerPorCategoria('TREND');
  assert.equal(trend.length, 1);
  assert.equal(trend[0]!.indicatorId, 'MA_CROSS');
});

test('registry: singleton con bootstrap', () => {
  // Limpiar singleton
  asignarIR(null);

  // Inicializar (debe hacer bootstrap)
  const reg1 = inicializarIR();
  assert.ok(reg1);

  // Verificar que MA_CROSS está ahí
  assert.ok(reg1.obtenerIndicador('MA_CROSS'));
  assert.equal(reg1.estado().totalIndicadores, 1);
});

test('registry: obtener estado correcto', () => {
  const registry = new IndicatorRegistry();
  bootstrapMACrossIndicador(registry);

  const estado = registry.estado();
  assert.equal(estado.totalIndicadores, 1);
  assert.equal(estado.activos, 1);
  assert.ok(estado.porCategoria.TREND === 1);
});

test('registry: parámetros correctos en MA_CROSS', () => {
  const registry = new IndicatorRegistry();
  bootstrapMACrossIndicador(registry);

  const spec = registry.obtenerIndicador('MA_CROSS');
  assert.ok(spec);
  assert.deepEqual(spec.parameters, {
    fastPeriod: 9,
    slowPeriod: 21,
    riskPerOperation: 0.01,
  });
});

test('registry: implementation source referenciable', () => {
  const registry = new IndicatorRegistry();
  bootstrapMACrossIndicador(registry);

  const spec = registry.obtenerIndicador('MA_CROSS');
  assert.ok(spec);
  // Debe mencionar que es de existing implementation
  assert.ok(spec.description.includes('existing'));
});
