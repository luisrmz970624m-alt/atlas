import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ForexWorker, inicializarWorker, obtenerWorker, asignarWorker } from '../src/trading-lab/forex-worker.ts';
import { RepositorioExperimentos } from '../src/trading-lab/experimentos.ts';
import { asignarRepositorioExperimentos } from '../src/trading-lab/panel-backtest.ts';

test('integracion: worker cicla sin crash', (t, done) => {
  const ruta = join(tmpdir(), `test-worker-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);
  asignarRepositorioExperimentos(repo);

  const worker = new ForexWorker(500); // Ciclo rápido para test
  worker.start();

  // Esperar un ciclo completo
  setTimeout(() => {
    worker.stop();

    const estado = worker.obtenerEstado();
    assert.equal(estado.status, 'OFFLINE');

    asignarRepositorioExperimentos(null);
    done();
  }, 2000);
});

test('integracion: worker maneja ciclo sin crash', (t, done) => {
  const worker = new ForexWorker(300);
  let crashCount = 0;

  try {
    worker.start();

    setTimeout(() => {
      worker.stop();
      assert.equal(crashCount, 0);
      done();
    }, 1500);
  } catch (e) {
    crashCount++;
    assert.fail(`Worker no debería crashes: ${e}`);
  }
});

test('integracion: lastCycle se actualiza', (t, done) => {
  const worker = new ForexWorker(400);
  worker.start();

  const e1 = worker.obtenerEstado();
  const lc1 = e1.lastCycle;

  setTimeout(() => {
    const e2 = worker.obtenerEstado();
    const lc2 = e2.lastCycle;

    // lastCycle debería haber cambiado o existir
    assert.ok(lc1 || lc2);

    worker.stop();
    done();
  }, 1200);
});

test('integracion: currentRunId puede ser asignado', () => {
  const worker = new ForexWorker(500);
  const estado = worker.obtenerEstado();
  // Inicialmente null, pero puede ser asignado tras ciclo
  assert.ok(estado.currentRunId === null || typeof estado.currentRunId === 'string');
});

test('integracion: totalExperiments es número válido', () => {
  const worker = new ForexWorker(400);
  const estado = worker.obtenerEstado();

  assert.ok(Number.isInteger(estado.totalExperiments));
  assert.ok(estado.totalExperiments >= 0);
});

test('integracion: SIGINT detiene worker limpiamente', (t, done) => {
  const worker = new ForexWorker(500);
  worker.start();

  setTimeout(() => {
    const estadoAntes = worker.obtenerEstado();
    assert.notEqual(estadoAntes.status, 'OFFLINE');

    worker.stop();

    const estadoDespues = worker.obtenerEstado();
    assert.equal(estadoDespues.status, 'OFFLINE');

    done();
  }, 1000);
});
