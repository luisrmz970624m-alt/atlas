import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import { FuenteMT5DEMO } from '../src/trading-lab/mt5-datasource.ts';
import { ClienteMT5SoloLectura } from '../src/mt5-bridge/cliente.ts';
import { FakeMT5ReadOnly } from '../src/mt5-bridge/fake.ts';

const POLITICA_DEMO = { tradingMode: 'DEMO_ONLY', realTrading: 'false', timeoutMs: 1000 };

test('mt5-datasource: sin bridge, desconectado', async () => {
  const fuente = new FuenteMT5DEMO();
  assert.equal(await fuente.conectado(), false);
  assert.equal(fuente.obtenerEstado(), 'desconectado');
});

test('mt5-datasource: con fake bridge DEMO, conectado', async () => {
  const fake = new FakeMT5ReadOnly();
  const client = new ClienteMT5SoloLectura(fake, POLITICA_DEMO);
  const fuente = new FuenteMT5DEMO(client);
  
  assert.equal(await fuente.conectado(), true);
  assert.equal(fuente.obtenerEstado(), 'conectado-demo');
  assert.ok(fuente.obtenerCuenta());
  assert.equal(fuente.obtenerCuenta()?.tipo, 'DEMO');
});

test('mt5-datasource: rechaza cuenta REAL', async () => {
  const fake = new FakeMT5ReadOnly();
  fake.cuenta = { tipo: 'REAL', idSeguro: 'real-001', moneda: 'USD', apalancamiento: 100 };
  
  const client = new ClienteMT5SoloLectura(fake, POLITICA_DEMO);
  const fuente = new FuenteMT5DEMO(client);
  
  const conectado = await fuente.conectado();
  assert.equal(conectado, false);
  assert.equal(fuente.obtenerEstado(), 'error');
  assert.ok(fuente.obtenerError()?.includes('no permitido'));
});

test('mt5-datasource: descubre símbolos desde fake', async () => {
  const fake = new FakeMT5ReadOnly();
  const client = new ClienteMT5SoloLectura(fake, POLITICA_DEMO);
  const fuente = new FuenteMT5DEMO(client);
  
  const simbolos = await fuente.simbolosDisponibles();
  assert.equal(simbolos.length, 1);
  assert.equal(simbolos[0], 'EURUSD');
});

test('mt5-datasource: obtiene OHLC desde fake', async () => {
  const fake = new FakeMT5ReadOnly();
  const client = new ClienteMT5SoloLectura(fake, POLITICA_DEMO);
  const fuente = new FuenteMT5DEMO(client);
  
  const serie = await fuente.obtenerSerie('EURUSD', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '1d');
  assert.ok(serie);
  assert.equal(serie!.velas.length, 1);
  assert.equal(serie!.simbolo, 'EURUSD');
  assert.equal(serie!.intervalo, '1d');
});

test('mt5-datasource: normaliza timestamps OHLC a UTC ISO 8601', async () => {
  const fake = new FakeMT5ReadOnly();
  const client = new ClienteMT5SoloLectura(fake, POLITICA_DEMO);
  const fuente = new FuenteMT5DEMO(client);
  
  const serie = await fuente.obtenerSerie('EURUSD', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '1d');
  assert.ok(serie);
  const vela = serie!.velas[0];
  assert.match(vela.fecha, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('mt5-datasource: obtiene bid/ask/spread desde tick', async () => {
  const fake = new FakeMT5ReadOnly();
  const client = new ClienteMT5SoloLectura(fake, POLITICA_DEMO);
  const fuente = new FuenteMT5DEMO(client);
  
  const tick = await fuente.tick('EURUSD');
  assert.ok(tick);
  assert.equal(tick!.bid, 1.1);
  assert.equal(tick!.ask, 1.1002);
  assert.ok(Math.abs(tick!.spread - 0.0002) < 0.00001);
  assert.match(tick!.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('mt5-datasource: persiste watermark después de obtener OHLC', async () => {
  const ruta = join(tmpdir(), `mt5-watermark-${Date.now()}.json`);
  const fake = new FakeMT5ReadOnly();
  const client = new ClienteMT5SoloLectura(fake, POLITICA_DEMO);
  const fuente = new FuenteMT5DEMO(client, ruta);
  
  await fuente.obtenerSerie('EURUSD', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '1d');
  
  const watermark = fuente.obtenerWatermark('EURUSD', '1d');
  assert.ok(watermark);
  assert.equal(watermark!.simbolo, 'EURUSD');
  assert.match(watermark!.ultimoTimestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  
  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('mt5-datasource: carga watermark persistido', async () => {
  const ruta = join(tmpdir(), `mt5-watermark-${Date.now()}.json`);
  const fake = new FakeMT5ReadOnly();
  const client = new ClienteMT5SoloLectura(fake, POLITICA_DEMO);
  
  const fuente1 = new FuenteMT5DEMO(client, ruta);
  await fuente1.obtenerSerie('EURUSD', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '1d');
  
  const fuente2 = new FuenteMT5DEMO(client, ruta);
  const watermark = fuente2.obtenerWatermark('EURUSD', '1d');
  assert.ok(watermark);
  assert.equal(watermark!.simbolo, 'EURUSD');
  
  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('mt5-datasource: sin velas devuelve null', async () => {
  const fake = new FakeMT5ReadOnly();
  fake.cuenta = { tipo: 'DEMO', idSeguro: 'demo-001', moneda: 'USD', apalancamiento: 100 };
  
  const client = new ClienteMT5SoloLectura(fake, POLITICA_DEMO);
  const fuente = new FuenteMT5DEMO(client);
  
  const serie = await fuente.obtenerSerie('EURUSD', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z');
  assert.ok(serie);
});

test('mt5-datasource: desconexión no hace crash', async () => {
  const fake = new FakeMT5ReadOnly();
  fake.desconectado = true;
  
  const client = new ClienteMT5SoloLectura(fake, POLITICA_DEMO);
  const fuente = new FuenteMT5DEMO(client);
  
  const conectado = await fuente.conectado();
  assert.equal(conectado, false);
  assert.equal(fuente.obtenerEstado(), 'error');
  assert.ok(fuente.obtenerError());
});

test('mt5-datasource: timeout recuperable', async () => {
  const fake = new FakeMT5ReadOnly();
  fake.demorar = true;
  
  const client = new ClienteMT5SoloLectura(fake, POLITICA_DEMO);
  const fuente = new FuenteMT5DEMO(client);
  
  const conectado = await fuente.conectado();
  assert.equal(conectado, false);
  assert.equal(fuente.obtenerEstado(), 'error');
  assert.ok(fuente.obtenerError()?.includes('timeout') || fuente.obtenerError()?.includes('Timeout'));
});

test('mt5-datasource: estado bloqueado-real cuando cuenta es REAL', async () => {
  const fake = new FakeMT5ReadOnly();
  fake.cuenta = { tipo: 'REAL', idSeguro: 'real-001', moneda: 'USD', apalancamiento: 100 };
  
  const client = new ClienteMT5SoloLectura(fake, POLITICA_DEMO);
  const fuente = new FuenteMT5DEMO(client);
  
  const conectado = await fuente.conectado();
  assert.equal(conectado, false);
  assert.equal(fuente.obtenerEstado(), 'error');
  assert.ok(fuente.obtenerError()?.includes('no permitido'));
});

test('mt5-datasource: múltiples timeframes, watermarks independientes', async () => {
  const ruta = join(tmpdir(), `mt5-watermark-${Date.now()}.json`);
  const fake = new FakeMT5ReadOnly();
  const client = new ClienteMT5SoloLectura(fake, POLITICA_DEMO);
  const fuente = new FuenteMT5DEMO(client, ruta);
  
  await fuente.obtenerSerie('EURUSD', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '1d');
  await fuente.obtenerSerie('EURUSD', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '4h');
  
  const w1d = fuente.obtenerWatermark('EURUSD', '1d');
  const w4h = fuente.obtenerWatermark('EURUSD', '4h');
  
  assert.ok(w1d);
  assert.ok(w4h);
  assert.equal(w1d!.timeframe, '1d');
  assert.equal(w4h!.timeframe, '4h');
  
  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('mt5-datasource: sin cuenta REAL devuelto explícitamente', async () => {
  const fake = new FakeMT5ReadOnly();
  const client = new ClienteMT5SoloLectura(fake, POLITICA_DEMO);
  const fuente = new FuenteMT5DEMO(client);
  
  await fuente.conectado();
  const cuenta = fuente.obtenerCuenta();
  assert.ok(cuenta);
  assert.notEqual(cuenta!.tipo, 'REAL');
  assert.ok(cuenta!.tipo.includes('DEMO'));
});
