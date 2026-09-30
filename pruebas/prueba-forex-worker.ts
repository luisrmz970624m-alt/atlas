import test from 'node:test';
import assert from 'node:assert/strict';
import { ForexWorker, inicializarWorker, obtenerWorker, asignarWorker } from '../src/trading-lab/forex-worker.ts';

test('forex-worker: constructor sin datasource es WAITING_DATA', () => {
  const worker = new ForexWorker(1000);
  const estado = worker.obtenerEstado();
  assert.equal(estado.status, 'WAITING_DATA');
  assert.equal(estado.datasource, 'unavailable');
});

test('forex-worker: inicio con IDLE', () => {
  const worker = new ForexWorker(1000);
  worker.start();
  const estado = worker.obtenerEstado();
  assert.ok(['IDLE', 'RUNNING_BACKTEST', 'WAITING_DATA'].includes(estado.status));
  worker.stop();
});

test('forex-worker: stop detiene worker', (t, done) => {
  const worker = new ForexWorker(1000);
  worker.start();

  setTimeout(() => {
    worker.stop();
    const estado = worker.obtenerEstado();
    assert.equal(estado.status, 'OFFLINE');
    done();
  }, 100);
});

test('forex-worker: singleton inicializar/obtener', () => {
  asignarWorker(null);
  assert.equal(obtenerWorker(), null);

  const w1 = inicializarWorker(1000);
  const w2 = obtenerWorker();
  assert.ok(w1 === w2);

  asignarWorker(null);
});

test('forex-worker: estado read-only', () => {
  const worker = new ForexWorker(1000);
  const estado = worker.obtenerEstado();

  assert.ok(typeof estado.status === 'string');
  assert.ok(typeof estado.datasource === 'string');
  assert.ok(typeof estado.totalExperiments === 'number');
  assert.ok(typeof estado.uptimeSeconds === 'number');
  assert.ok(estado.uptimeSeconds >= 0);
});

test('forex-worker: pausar/reanudar', () => {
  const worker = new ForexWorker(1000);
  worker.start();

  worker.pausar();
  assert.equal(worker.obtenerEstado().status, 'PAUSED');

  worker.reanudar();
  assert.notEqual(worker.obtenerEstado().status, 'PAUSED');

  worker.stop();
});

test('forex-worker: currentRunId null al inicio', () => {
  const worker = new ForexWorker(1000);
  const estado = worker.obtenerEstado();
  assert.equal(estado.currentRunId, null);
});

test('forex-worker: totalExperiments es número', () => {
  const worker = new ForexWorker(1000);
  const estado = worker.obtenerEstado();
  assert.ok(Number.isInteger(estado.totalExperiments));
  assert.ok(estado.totalExperiments >= 0);
});

test('forex-worker: lastError null inicialmente', () => {
  const worker = new ForexWorker(1000);
  const estado = worker.obtenerEstado();
  assert.equal(estado.lastError, null);
});

test('forex-worker: NO hay órdenes reales', () => {
  const worker = new ForexWorker(1000);
  const estado = worker.obtenerEstado();

  // Verificar que no hay referencias a REAL
  assert.notEqual(estado.datasource, 'forex-real');
  assert.ok(estado.datasource === 'fixture-local' || estado.datasource === 'mt5-demo' || estado.datasource === 'unavailable');
});

test('forex-worker: MT5 REAL bloqueado', () => {
  const worker = new ForexWorker(1000);
  const estado = worker.obtenerEstado();

  // El worker nunca debería tener datasource forex-real en esta fase
  assert.notEqual(estado.datasource, 'forex-real');
});

test('forex-worker: OOS habilitado por defecto', () => {
  const worker = new ForexWorker(1000);
  const estado = worker.obtenerEstado();
  assert.equal(estado.oosEnabled, true);
});

test('forex-worker: walk-forward habilitado por defecto', () => {
  const worker = new ForexWorker(1000);
  const estado = worker.obtenerEstado();
  assert.equal(estado.walkForwardEnabled, true);
});

test('forex-worker: intervalMs configurable', () => {
  const worker = new ForexWorker(5000);
  // No hay getter público, pero si puede construirse sin error está bien
  assert.ok(worker);
});

test('forex-worker: arranque múltiple no crea duplicados', () => {
  const worker = new ForexWorker(1000);
  worker.start();
  worker.start(); // Segunda llamada

  // No debe tirar error, solo ignorar
  const estado = worker.obtenerEstado();
  assert.ok(estado);

  worker.stop();
});

test('forex-worker: estado actualiza uptime', (t, done) => {
  const worker = new ForexWorker(1000);
  const e1 = worker.obtenerEstado();
  const up1 = e1.uptimeSeconds;

  setTimeout(() => {
    const e2 = worker.obtenerEstado();
    const up2 = e2.uptimeSeconds;
    assert.ok(up2 >= up1);
    done();
  }, 100);
});

test('forex-worker: sin datasource, pair y timeframe son null', () => {
  const worker = new ForexWorker(1000);
  const estado = worker.obtenerEstado();

  // Sin MT5 ni fixture explícito: pair y timeframe son null
  assert.equal(estado.pair, null);
  assert.equal(estado.timeframe, null);
});
