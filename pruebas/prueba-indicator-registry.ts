import test from 'node:test';
import assert from 'node:assert/strict';
import { IndicatorRegistry } from '../src/trading-lab/indicator-registry.ts';

test('ir: registra indicador', () => {
  const ir = new IndicatorRegistry();

  ir.registrarIndicador({
    indicatorId: 'MA_CROSS_1',
    name: 'Moving Average Crossover',
    version: '1.0',
    category: 'TREND',
    description: 'Simple MA crossover strategy',
    inputs: ['close', 'period1', 'period2'],
    parameters: { period1: 20, period2: 50 },
    output: 'SIGNAL',
    assumptions: ['Trending market', 'Sufficient liquidity'],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const ind = ir.obtenerIndicador('MA_CROSS_1');
  assert.ok(ind);
  assert.equal(ind!.name, 'Moving Average Crossover');
  assert.equal(ind!.status, 'ACTIVE');
});

test('ir: NO duplica indicadores', () => {
  const ir = new IndicatorRegistry();

  ir.registrarIndicador({
    indicatorId: 'IND_001',
    name: 'Test',
    version: '1.0',
    category: 'TREND',
    description: 'Test indicator',
    inputs: [],
    parameters: {},
    output: 'SIGNAL',
    assumptions: [],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  assert.throws(() => {
    ir.registrarIndicador({
      indicatorId: 'IND_001',
      name: 'Duplicate',
      version: '1.0',
      category: 'TREND',
      description: 'Duplicate',
      inputs: [],
      parameters: {},
      output: 'SIGNAL',
      assumptions: [],
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
});

test('ir: obtiene por categoría', () => {
  const ir = new IndicatorRegistry();

  ir.registrarIndicador({
    indicatorId: 'TREND_1',
    name: 'Trend 1',
    version: '1.0',
    category: 'TREND',
    description: 'Trend indicator',
    inputs: [],
    parameters: {},
    output: 'SIGNAL',
    assumptions: [],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  ir.registrarIndicador({
    indicatorId: 'MOM_1',
    name: 'Momentum 1',
    version: '1.0',
    category: 'MOMENTUM',
    description: 'Momentum indicator',
    inputs: [],
    parameters: {},
    output: 'SIGNAL',
    assumptions: [],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const trends = ir.obtenerPorCategoria('TREND');
  const momentums = ir.obtenerPorCategoria('MOMENTUM');

  assert.equal(trends.length, 1);
  assert.equal(momentums.length, 1);
});

test('ir: lista activos', () => {
  const ir = new IndicatorRegistry();

  ir.registrarIndicador({
    indicatorId: 'IND_A',
    name: 'Active',
    version: '1.0',
    category: 'TREND',
    description: 'Active',
    inputs: [],
    parameters: {},
    output: 'SIGNAL',
    assumptions: [],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  ir.registrarIndicador({
    indicatorId: 'IND_B',
    name: 'Deprecated',
    version: '1.0',
    category: 'TREND',
    description: 'Deprecated',
    inputs: [],
    parameters: {},
    output: 'SIGNAL',
    assumptions: [],
    status: 'DEPRECATED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const activos = ir.listarActivos();
  assert.equal(activos.length, 1);
  assert.equal(activos[0].indicatorId, 'IND_A');
});

test('ir: depreca indicador', () => {
  const ir = new IndicatorRegistry();

  ir.registrarIndicador({
    indicatorId: 'IND_OLD',
    name: 'Old Indicator',
    version: '1.0',
    category: 'TREND',
    description: 'Old',
    inputs: [],
    parameters: {},
    output: 'SIGNAL',
    assumptions: [],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  ir.deprecarIndicador('IND_OLD');

  const ind = ir.obtenerIndicador('IND_OLD');
  assert.equal(ind!.status, 'DEPRECATED');
});

test('ir: estado', () => {
  const ir = new IndicatorRegistry();

  ir.registrarIndicador({
    indicatorId: 'T1',
    name: 'Test 1',
    version: '1.0',
    category: 'TREND',
    description: 'Test',
    inputs: [],
    parameters: {},
    output: 'SIGNAL',
    assumptions: [],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const estado = ir.estado();
  assert.equal(estado.totalIndicadores, 1);
  assert.equal(estado.activos, 1);
  assert.ok(estado.porCategoria['TREND']);
});
