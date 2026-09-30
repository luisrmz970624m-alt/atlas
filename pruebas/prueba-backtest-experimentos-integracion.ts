import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RepositorioExperimentos } from '../src/trading-lab/experimentos.ts';
import { ejecutarBacktestPanel, asignarRepositorioExperimentos } from '../src/trading-lab/panel-backtest.ts';

test('integracion: ejecutarBacktestPanel guarda y devuelve runId', async () => {
  const ruta = join(tmpdir(), `test-integracion-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);
  asignarRepositorioExperimentos(repo);

  const resultado = await ejecutarBacktestPanel({
    instrumento: 'ficticia-btc-1d-v1',
    estrategia: 'cruce-demo',
    capitalInicial: 1000,
    comisionPorcentaje: 0.001,
  });

  assert.ok(resultado.runId);
  assert.ok(resultado.runId.length > 0);

  // Verifica que fue guardado
  const experimento = repo.obtenerExperimento(resultado.runId);
  assert.ok(experimento);
  assert.equal(experimento.runId, resultado.runId);
  assert.equal(experimento.instrument.symbol, 'BTC-USD-FICTICIO');
  assert.equal(experimento.capital.initialCapital, 1000);

  // Limpia
  asignarRepositorioExperimentos(null);
});

test('integracion: experimento persistido puede recuperarse en nueva sesión', async () => {
  const ruta = join(tmpdir(), `test-sesion-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);
  asignarRepositorioExperimentos(repo);

  // Primera sesión: ejecuta y guarda
  const resultado1 = await ejecutarBacktestPanel({
    instrumento: 'ficticia-btc-1d-v1',
    estrategia: 'cruce-demo',
    capitalInicial: 1000,
    comisionPorcentaje: 0.001,
  });
  const runId = resultado1.runId;

  // Simula nueva sesión: nuevo repositorio apuntando a mismo archivo
  const repo2 = new RepositorioExperimentos(ruta);
  const experimento = repo2.obtenerExperimento(runId);

  assert.ok(experimento);
  assert.equal(experimento.runId, runId);
  assert.equal(experimento.instrument.symbol, 'BTC-USD-FICTICIO');

  asignarRepositorioExperimentos(null);
});

test('integracion: múltiples backtests con mismo parámetro reemplaza (idempotencia)', async () => {
  const ruta = join(tmpdir(), `test-idempo-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);
  asignarRepositorioExperimentos(repo);

  // Mismo parámetro dos veces
  const resultado1 = await ejecutarBacktestPanel({
    instrumento: 'ficticia-btc-1d-v1',
    estrategia: 'cruce-demo',
    capitalInicial: 1000,
    comisionPorcentaje: 0.001,
  });

  const resultado2 = await ejecutarBacktestPanel({
    instrumento: 'ficticia-btc-1d-v1',
    estrategia: 'cruce-demo',
    capitalInicial: 1000,
    comisionPorcentaje: 0.001,
  });

  // Tienen runId distintos
  assert.notEqual(resultado1.runId, resultado2.runId);

  // Pero el idDedup es igual, así que uno reemplaza al otro
  const countFinal = repo.listarExperimentos().filter(
    (e) =>
      e.instrument.symbol === 'BTC-USD-FICTICIO' &&
      e.capital.initialCapital === 1000 &&
      e.capital.commissionPct === 0.001
  ).length;

  // Solo debe haber uno (el más reciente)
  assert.equal(countFinal, 1);

  asignarRepositorioExperimentos(null);
});

test('integracion: clasificación reflejada en persistencia', async () => {
  const ruta = join(tmpdir(), `test-clasif-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);
  asignarRepositorioExperimentos(repo);

  const resultado = await ejecutarBacktestPanel({
    instrumento: 'ficticia-btc-1d-v1',
    estrategia: 'cruce-demo',
    capitalInicial: 1000,
    comisionPorcentaje: 0.001,
  });

  const experimento = repo.obtenerExperimento(resultado.runId);
  assert.ok(experimento);
  // Sin OOS/WF = INSUFFICIENT_DATA
  assert.equal(experimento.classification, 'INSUFFICIENT_DATA');

  asignarRepositorioExperimentos(null);
});

test('integracion: resultados numéricos coherentes entre backtest y experimento', async () => {
  const ruta = join(tmpdir(), `test-numeros-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);
  asignarRepositorioExperimentos(repo);

  const resultado = await ejecutarBacktestPanel({
    instrumento: 'ficticia-btc-1d-v1',
    estrategia: 'cruce-demo',
    capitalInicial: 1000,
    comisionPorcentaje: 0.001,
  });

  const experimento = repo.obtenerExperimento(resultado.runId);
  assert.ok(experimento);

  // Resumen del backtest
  const resumen = resultado.resumen;

  // Todos deben coincidir
  assert.ok(Math.abs(experimento.results.finalEquity - resumen.finalEquity) < 1e-5);
  assert.ok(Math.abs(experimento.results.netPnl - resumen.netPnl) < 1e-5);
  assert.ok(Math.abs(experimento.results.returnPct - resumen.retorno) < 1e-5);
  assert.ok(Math.abs(experimento.results.maxDrawdownPct - resumen.maxDrawdown) < 1e-5);
  assert.equal(experimento.results.trades, resumen.operaciones);
  assert.equal(experimento.results.wins, resumen.wins);
  assert.equal(experimento.results.losses, resumen.losses);

  asignarRepositorioExperimentos(null);
});
