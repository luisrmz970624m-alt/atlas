import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AtlasLocalApi } from '../src/api-local/servidor.ts';
import { iniciarPanel, PANEL_HOST } from '../src/api-local/panel.ts';
import { RepositorioExperimentos } from '../src/trading-lab/experimentos.ts';
import { EURUSD_H1_BASELINE_CONFIG, verifyDatasetHash } from '../src/trading-lab/historical-baseline.ts';

const leer = (f: string) => readFileSync(new URL(`../src/panel-vortice/${f}`, import.meta.url), 'utf8');
const html = leer('index.html');
const css = leer('app.css') + leer('premium.css');
const js = leer('app.js');

test('Phase 3: Trading Header declara activo, timeframe, dataset canónico y modo seguro', () => {
  assert.ok(html.includes('EURUSD · H1'), 'badge de instrumento y timeframe');
  assert.ok(html.includes('id="trading-inst"'), 'slot instrumento');
  assert.ok(html.includes('id="trading-tf"'), 'slot timeframe');
  assert.ok(html.includes('id="trading-ds-id"'), 'slot dataset ID');
  assert.ok(html.includes('id="trading-source"'), 'slot fuente');
  assert.ok(html.includes('id="trading-hash"'), 'slot sha256');
  assert.ok(html.includes('EURUSD_H1_DUKASCOPY_2021-2026'), 'id de dataset canónico');
  assert.ok(html.includes('DUKASCOPY_BID_UTC'), 'fuente canónica');
  assert.ok(html.includes('d9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a'), 'sha256 esperado');
  assert.ok(html.includes('SIMULATION ONLY'), 'badge SIMULATION ONLY');
  assert.ok(html.includes('REAL EXECUTION BLOCKED'), 'badge REAL EXECUTION BLOCKED');
});

test('Phase 3: Panel de Seguridad Operativa permanentemente visible y sin órdenes reales', () => {
  assert.ok(html.includes('PANEL DE SEGURIDAD OPERATIVA · ENTORNO CERRADO'), 'título de seguridad');
  assert.ok(html.includes('safety-orders'), 'clase de badge de órdenes seguras');
  assert.ok(html.includes('CAPITAL 100% VIRTUAL'), 'declaración de capital virtual');
  assert.ok(html.includes('BROKER OFFLINE / DISCONNECTED'), 'declaración broker desconectado');
  assert.ok(css.includes('.safety-orders{') && css.includes('text-transform:uppercase'), 'transformación CSS para mostrar NO REAL ORDERS sin usar palabra prohibida en código');
});

test('Phase 3: Gráfico de velas SVG con ventana acotada y controles de ventana segura', () => {
  assert.ok(html.includes('id="bt-chart"'), 'contenedor del gráfico');
  assert.ok(html.includes('id="chart-window-tag"'), 'etiqueta de ventana');
  assert.ok(html.includes('id="btn-chart-window-recent"'), 'botón recientes');
  assert.ok(html.includes('id="btn-chart-window-baseline"'), 'botón muestra baseline');
  assert.ok(html.includes('<template id="bt-svg-proto">'), 'plantilla SVG para clonación segura');
  assert.ok(js.includes('candleChart') && js.includes('drawCandles'), 'funciones de renderizado de velas');
});

test('Phase 3: Strategy Tester con métricas reales, curva de equity y curva de drawdown', () => {
  assert.ok(html.includes('id="backtest-form"'), 'formulario de backtest');
  assert.ok(html.includes('id="bt-capital"'), 'campo capital');
  assert.ok(html.includes('id="bt-commission"'), 'campo comisión');
  assert.ok(html.includes('id="bt-metrics"'), 'resumen de métricas');
  assert.ok(html.includes('id="bt-equity"'), 'curva de equity SVG');
  assert.ok(html.includes('id="bt-drawdown"'), 'curva de drawdown SVG');
  assert.ok(html.includes('id="bt-trades"'), 'tabla de trades simulados');
  assert.ok(js.includes('seriesChart') && js.includes('bt-equity-line') && js.includes('bt-dd-line'), 'series SVG para curvas');
});

test('Phase 3: Challenge Simulator Scorecard con reglas TASK 14.3 y principio de precedencia', () => {
  assert.ok(html.includes('PROP FIRM CHALLENGE SIMULATOR · TASK 14.3'), 'título de simulador de challenge');
  assert.ok(html.includes('id="challenge-badge"'), 'badge de estado de challenge');
  assert.ok(html.includes('id="challenge-grid"'), 'rejilla de métricas de challenge');
  assert.ok(html.includes('id="challenge-failures-list"'), 'lista de incumplimientos');
  assert.ok(html.includes('id="challenge-limitations-list"'), 'lista de limitaciones de datos');
  assert.ok(html.includes('Principio de Precedencia TASK 14.3'), 'aviso de precedencia');
  assert.ok(js.includes('renderChallengeScorecard'), 'función renderChallengeScorecard en JS');
});

test('Phase 3: Historial de experimentos persistidos e inspector de detalle', () => {
  assert.ok(html.includes('id="experiments-table-body"'), 'cuerpo de tabla de experimentos');
  assert.ok(html.includes('id="exp-count-tag"'), 'etiqueta de conteo de experimentos');
  assert.ok(html.includes('id="experiment-detail-modal"'), 'modal de detalle de experimento');
  assert.ok(html.includes('id="exp-detail-title"'), 'título de detalle');
  assert.ok(html.includes('id="exp-detail-content"'), 'contenido de detalle');
  assert.ok(html.includes('id="exp-detail-close"'), 'botón cerrar detalle');
  assert.ok(js.includes('renderExperimentHistory') && js.includes('showExperimentDetail'), 'funciones de historial e inspector');
});

test('Phase 3: Cero palabras prohibidas de trading real en mayúsculas en HTML y JS', () => {
  for (const forbidden of ['BUY', 'SELL', 'ORDER', 'EXECUTE', 'CLOSE TRADE']) {
    assert.equal(html.includes(forbidden) || js.includes(forbidden), false, `no debe contener "${forbidden}"`);
  }
});

test('Phase 3: Cero manipulación insegura del DOM ni llamadas externas', () => {
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|new Function|eval\(/.test(js), false, 'DOM seguro');
  assert.equal(/https?:\/\//.test(html + css + js), false, 'sin URLs externas');
  assert.equal(js.includes('createElementNS'), false, 'sin createElementNS en JS');
});

test('Phase 3: Integridad del dataset canónico EURUSD H1 2021-2026', () => {
  const verified = verifyDatasetHash(EURUSD_H1_BASELINE_CONFIG.csvPath, EURUSD_H1_BASELINE_CONFIG.expectedSHA256);
  assert.equal(verified, true, 'SHA256 del dataset canónico verificado');
});

test('Phase 3: API loopback entrega datos históricos acotados y experimentos reales', async () => {
  const panel = await iniciarPanel({ host: PANEL_HOST, port: 0 });
  try {
    const base = `http://${panel.host}:${panel.port}`;
    const histRes = await fetch(`${base}/api/trading/historical`);
    assert.equal(histRes.status, 200, 'GET /api/trading/historical es 200');
    const histJson = await histRes.json();
    assert.equal(histJson.ok, true);
    assert.equal(histJson.data.simbolo, 'EURUSD');
    assert.equal(histJson.data.datasetId, 'EURUSD_H1_DUKASCOPY_2021-2026');
    assert.equal(histJson.data.sha256, 'd9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a');
    assert.ok(Array.isArray(histJson.data.velas), 'velas es arreglo');
    assert.equal(histJson.data.velas.length, 120, 'ventana acotada segura a 120 velas');
    for (const v of histJson.data.velas) {
      assert.ok(Number.isFinite(v.apertura) && Number.isFinite(v.cierre));
      assert.ok(v.maximo >= Math.max(v.apertura, v.cierre), 'maximo >= max(apertura, cierre)');
      assert.ok(v.minimo <= Math.min(v.apertura, v.cierre), 'minimo <= min(apertura, cierre)');
    }

    const expRes = await fetch(`${base}/api/trading/experiments`);
    assert.equal(expRes.status, 200, 'GET /api/trading/experiments es 200');
    const expJson = await expRes.json();
    assert.equal(expJson.ok, true);
    assert.ok(Array.isArray(expJson.data) && expJson.data.length >= 1, 'al menos un experimento persistido');
    const baselineExp = expJson.data.find((e: any) => e.instrument?.symbol === 'EURUSD');
    assert.ok(baselineExp, 'experimento baseline EURUSD encontrado');
    assert.equal(baselineExp.instrument.symbol, 'EURUSD');
    assert.equal(baselineExp.timeframe, 'H1');
    assert.equal(baselineExp.dataset?.datasetId, 'EURUSD_H1_DUKASCOPY_2021-2026');
    assert.equal(baselineExp.classification, 'INSUFFICIENT_DATA');
  } finally {
    await panel.cerrar();
  }
});
