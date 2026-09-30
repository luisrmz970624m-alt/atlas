import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { RepositorioExperimentos, crearExperimentoDesdeBacktest, clasificarExperimento, generarIdDeduplicacion } from '../src/trading-lab/experimentos.ts';
import { ejecutarBacktest } from '../src/trading-lab/backtest.ts';
import { SERIE_PANEL, ESTRATEGIA_PANEL } from '../src/trading-lab/panel-backtest.ts';
import type { ConfiguracionBacktest } from '../src/trading-lab/tipos.ts';

const config: ConfiguracionBacktest = {
  capitalInicial: 1000,
  comisionPorcentaje: 0.001,
  spreadPorcentaje: 0.002,
  slippagePorcentaje: 0.001,
  maxRiesgoPorOperacion: 0.02,
  semilla: 7,
};

const backtest = ejecutarBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, config);

test('experimentos: crear experimento desde backtest genera runId único', () => {
  const exp1 = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, config.capitalInicial, config.comisionPorcentaje);
  const exp2 = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, config.capitalInicial, config.comisionPorcentaje);
  assert.notEqual(exp1.runId, exp2.runId);
  assert.ok(exp1.runId.length > 0);
});

test('experimentos: experimento contiene datos correctos', () => {
  const exp = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, 1000, 0.001);
  assert.equal(exp.instrument.symbol, SERIE_PANEL.simbolo);
  assert.equal(exp.timeframe, SERIE_PANEL.intervalo);
  assert.equal(exp.strategy.id, ESTRATEGIA_PANEL.id);
  assert.equal(exp.capital.initialCapital, 1000);
  assert.ok(Number.isFinite(exp.results.finalEquity));
  assert.ok(exp.results.finalEquity > 0);
});

test('experimentos: generarIdDeduplicacion es determinista', () => {
  const id1 = generarIdDeduplicacion('BTC-USD', '1d', { from: '2025-01-01', to: '2025-01-08' }, 'cruce-demo', 1, 1000, 0.001);
  const id2 = generarIdDeduplicacion('BTC-USD', '1d', { from: '2025-01-01', to: '2025-01-08' }, 'cruce-demo', 1, 1000, 0.001);
  assert.equal(id1, id2);
});

test('experimentos: idDeduplicacion diferente para parámetros distintos', () => {
  const id1 = generarIdDeduplicacion('BTC-USD', '1d', { from: '2025-01-01', to: '2025-01-08' }, 'cruce-demo', 1, 1000, 0.001);
  const id2 = generarIdDeduplicacion('EUR-USD', '1d', { from: '2025-01-01', to: '2025-01-08' }, 'cruce-demo', 1, 1000, 0.001);
  assert.notEqual(id1, id2);
});

test('experimentos: guardarExperimento persiste en disco', () => {
  const ruta = join(tmpdir(), `test-exp-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);
  const exp = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, 1000, 0.001);

  repo.guardarExperimento(exp);

  // Recupera en nueva instancia: valida persistencia real
  const repo2 = new RepositorioExperimentos(ruta);
  const recuperado = repo2.obtenerExperimento(exp.runId);
  assert.ok(recuperado);
  assert.equal(recuperado.runId, exp.runId);
  assert.equal(recuperado.instrument.symbol, exp.instrument.symbol);
});

test('experimentos: obtenerExperimento retorna null si no existe', () => {
  const ruta = join(tmpdir(), `test-exp-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);
  assert.equal(repo.obtenerExperimento('no-existe'), null);
});

test('experimentos: listarExperimentos retorna ordenado por fecha descendente', () => {
  const ruta = join(tmpdir(), `test-exp-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);

  const exp1 = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, 1000, 0.001);
  repo.guardarExperimento(exp1);

  // Pequeña pausa para timestamp distinto
  const exp2 = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, 2000, 0.002);
  repo.guardarExperimento(exp2);

  const lista = repo.listarExperimentos();
  assert.ok(lista.length >= 2);
  assert.equal(new Date(lista[0]!.createdAt).getTime() >= new Date(lista[1]!.createdAt).getTime(), true);
});

test('experimentos: idempotencia: guardar mismo experimento dos veces no duplica', () => {
  const ruta = join(tmpdir(), `test-exp-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);
  const exp = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, 1000, 0.001);

  repo.guardarExperimento(exp);
  const countAhora = repo.contar();

  // Mismo experimento con mismo runId (en práctica sería diferente runId, pero mismo idDedup)
  // Para probar idempotencia, guardamos uno con idDedup idéntico pero diferente runId
  const exp2 = { ...exp, runId: 'otro-id' };
  repo.guardarExperimento(exp2);
  const countDespues = repo.contar();

  // Debe haber reemplazado, no añadido
  assert.equal(countAhora, countDespues);
});

test('experimentos: existeExperimento detecta presencia', () => {
  const ruta = join(tmpdir(), `test-exp-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);
  const exp = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, 1000, 0.001);

  repo.guardarExperimento(exp);

  assert.ok(repo.existeExperimento('BTC-USD-FICTICIO', '1d', exp.period, 'cruce-demo', 1, 1000, 0.001));
  assert.ok(!repo.existeExperimento('EUR-USD', '1d', exp.period, 'cruce-demo', 1, 1000, 0.001));
});

test('experimentos: filtrar por symbol', () => {
  const ruta = join(tmpdir(), `test-exp-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);
  const exp = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, 1000, 0.001);

  repo.guardarExperimento(exp);

  const resultados = repo.filtrar({ symbol: 'BTC-USD-FICTICIO' });
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0]!.runId, exp.runId);
});

test('experimentos: filtrar por strategy', () => {
  const ruta = join(tmpdir(), `test-exp-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);
  const exp = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, 1000, 0.001);

  repo.guardarExperimento(exp);

  const resultados = repo.filtrar({ strategy: 'cruce-demo' });
  assert.equal(resultados.length, 1);
});

test('experimentos: filtrar por classification', () => {
  const ruta = join(tmpdir(), `test-exp-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);
  const exp = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, 1000, 0.001);

  repo.guardarExperimento(exp);

  // backtest aprobado pero sin OOS/WF = INSUFFICIENT_DATA
  assert.equal(exp.classification, 'INSUFFICIENT_DATA');

  const resultados = repo.filtrar({ classification: 'INSUFFICIENT_DATA' });
  assert.ok(resultados.length >= 1);
});

test('experimentos: clasificar INSUFFICIENT_DATA sin OOS/WF', () => {
  const exp = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, 1000, 0.001);
  assert.equal(exp.classification, 'INSUFFICIENT_DATA');
});

test('experimentos: clasificar FAILED si motor rechazó reglas', () => {
  const configRiescoDemasiado = {
    ...config,
    maxRiesgoPorOperacion: 0.001, // Menor que riesgoPorOperacion de estrategia
  };
  const resultadoFallido = ejecutarBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, configRiescoDemasiado);
  assert.equal(resultadoFallido.aprobado, false);

  const exp = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, resultadoFallido, 1000, 0.001);
  assert.equal(exp.classification, 'FAILED');
});

test('experimentos: contexto macro es opcional', () => {
  const exp1 = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, 1000, 0.001);
  assert.equal(exp1.context, undefined);

  const exp2 = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, 1000, 0.001, undefined, undefined, []);
  assert.ok(exp2.context !== undefined);
  assert.equal(exp2.context.events.length, 0);
});

test('experimentos: archivo corrupto recupera limpiamente', () => {
  const ruta = join(tmpdir(), `test-corrupto-${Date.now()}.json`);
  // Escribe JSON inválido
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, 'INVALID JSON {', 'utf8');

  // Debe recuperarse sin tirar
  const repo = new RepositorioExperimentos(ruta);
  assert.equal(repo.contar(), 0);
});

test('experimentos: valores NaN/Infinity en resultados se evitan', () => {
  const exp = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, 1000, 0.001);
  assert.ok(Number.isFinite(exp.results.finalEquity));
  assert.ok(Number.isFinite(exp.results.netPnl));
  assert.ok(Number.isFinite(exp.results.returnPct));
  assert.ok(Number.isFinite(exp.results.maxDrawdownPct));
  if (exp.results.winRate !== null) assert.ok(Number.isFinite(exp.results.winRate));
  if (exp.results.profitFactor !== null) assert.ok(Number.isFinite(exp.results.profitFactor));
});

test('experimentos: limpiar vacía repositorio (testing)', () => {
  const ruta = join(tmpdir(), `test-exp-${Date.now()}.json`);
  const repo = new RepositorioExperimentos(ruta);
  const exp = crearExperimentoDesdeBacktest(SERIE_PANEL, ESTRATEGIA_PANEL, backtest, 1000, 0.001);

  repo.guardarExperimento(exp);
  assert.ok(repo.contar() > 0);

  repo.limpiar();
  assert.equal(repo.contar(), 0);
});
