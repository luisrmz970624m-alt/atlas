import test from 'node:test';
import assert from 'node:assert/strict';
import { ForexScheduler, inicializarScheduler, obtenerScheduler, asignarScheduler } from '../src/trading-lab/forex-scheduler.ts';

/**
 * Helper: crea fecha UTC en día específico.
 * dayOfWeek: 0=domingo, 1=lunes, ..., 6=sábado
 */
function crearFechaUtc(dayOfWeek: number): Date {
  const hoy = new Date();
  const diaActual = hoy.getUTCDay();
  const diff = dayOfWeek - diaActual;
  const fecha = new Date(hoy);
  fecha.setUTCDate(fecha.getUTCDate() + diff);
  fecha.setUTCHours(12, 0, 0, 0); // Mediodía UTC
  return fecha;
}

test('forex-scheduler: lunes es ACTIVE', () => {
  const scheduler = new ForexScheduler();
  const lunes = crearFechaUtc(1);
  const estado = scheduler.obtenerEstado(lunes);
  assert.equal(estado.marketWindow, 'ACTIVE');
  assert.equal(estado.realtimeTasksAllowed, true);
});

test('forex-scheduler: martes es ACTIVE', () => {
  const scheduler = new ForexScheduler();
  const martes = crearFechaUtc(2);
  const estado = scheduler.obtenerEstado(martes);
  assert.equal(estado.marketWindow, 'ACTIVE');
});

test('forex-scheduler: miércoles es ACTIVE', () => {
  const scheduler = new ForexScheduler();
  const miercoles = crearFechaUtc(3);
  const estado = scheduler.obtenerEstado(miercoles);
  assert.equal(estado.marketWindow, 'ACTIVE');
});

test('forex-scheduler: jueves es ACTIVE', () => {
  const scheduler = new ForexScheduler();
  const jueves = crearFechaUtc(4);
  const estado = scheduler.obtenerEstado(jueves);
  assert.equal(estado.marketWindow, 'ACTIVE');
});

test('forex-scheduler: viernes es ACTIVE', () => {
  const scheduler = new ForexScheduler();
  const viernes = crearFechaUtc(5);
  const estado = scheduler.obtenerEstado(viernes);
  assert.equal(estado.marketWindow, 'ACTIVE');
});

test('forex-scheduler: sábado es WEEKEND_CLOSED', () => {
  const scheduler = new ForexScheduler();
  const sabado = crearFechaUtc(6);
  const estado = scheduler.obtenerEstado(sabado);
  assert.equal(estado.marketWindow, 'WEEKEND_CLOSED');
  assert.equal(estado.realtimeTasksAllowed, false);
});

test('forex-scheduler: domingo es WEEKEND_CLOSED', () => {
  const scheduler = new ForexScheduler();
  const domingo = crearFechaUtc(0);
  const estado = scheduler.obtenerEstado(domingo);
  assert.equal(estado.marketWindow, 'WEEKEND_CLOSED');
});

test('forex-scheduler: tareas históricas permitidas siempre', () => {
  const scheduler = new ForexScheduler();
  const sabado = crearFechaUtc(6);
  const estado = scheduler.obtenerEstado(sabado);
  assert.equal(estado.historicalTasksAllowed, true);
});

test('forex-scheduler: nextTransition viernes → sábado', () => {
  const scheduler = new ForexScheduler();
  const viernes = crearFechaUtc(5);
  const estado = scheduler.obtenerEstado(viernes);
  assert.ok(estado.nextTransitionUtc);

  // Próxima transición debería ser sábado 00:00 UTC
  const transicion = new Date(estado.nextTransitionUtc!);
  assert.equal(transicion.getUTCDay(), 6); // Sábado
  assert.equal(transicion.getUTCHours(), 0);
  assert.equal(transicion.getUTCMinutes(), 0);
});

test('forex-scheduler: nextTransition sábado → lunes', () => {
  const scheduler = new ForexScheduler();
  const sabado = crearFechaUtc(6);
  const estado = scheduler.obtenerEstado(sabado);
  assert.ok(estado.nextTransitionUtc);

  // Próxima transición debería ser lunes 00:00 UTC (2 días después)
  const transicion = new Date(estado.nextTransitionUtc!);
  assert.equal(transicion.getUTCDay(), 1); // Lunes
});

test('forex-scheduler: currentUtc es ISO 8601', () => {
  const scheduler = new ForexScheduler();
  const estado = scheduler.obtenerEstado();
  assert.ok(estado.currentUtc.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/));
});

test('forex-scheduler: no depende de timezone local', () => {
  const scheduler = new ForexScheduler();
  const lunes = crearFechaUtc(1);
  const estado = scheduler.obtenerEstado(lunes);

  // Asegurarse de que usa día UTC, no local
  assert.equal(estado.marketWindow, 'ACTIVE');
  assert.equal(lunes.getUTCDay(), 1); // Confirmar que es lunes UTC
});

test('forex-scheduler: rechaza intervalo inválido (cero)', () => {
  assert.throws(() => new ForexScheduler(0, 60_000));
});

test('forex-scheduler: rechaza intervalo inválido (negativo)', () => {
  assert.throws(() => new ForexScheduler(-1000, 60_000));
});

test('forex-scheduler: rechaza intervalo > 1 hora', () => {
  assert.throws(() => new ForexScheduler(3600_001, 60_000));
});

test('forex-scheduler: intervaloRecomendado en ACTIVE', () => {
  const scheduler = new ForexScheduler(60_000, 120_000);
  const lunes = crearFechaUtc(1);
  const estado = scheduler.obtenerEstado(lunes);
  const intervalo = scheduler.obtenerIntervaloRecomendado(estado);
  assert.equal(intervalo, 60_000);
});

test('forex-scheduler: intervaloRecomendado en WEEKEND_CLOSED', () => {
  const scheduler = new ForexScheduler(60_000, 120_000);
  const sabado = crearFechaUtc(6);
  const estado = scheduler.obtenerEstado(sabado);
  const intervalo = scheduler.obtenerIntervaloRecomendado(estado);
  assert.equal(intervalo, 120_000);
});

test('forex-scheduler: singleton inicializar/obtener', () => {
  asignarScheduler(null);
  assert.equal(obtenerScheduler(), null);

  const s1 = inicializarScheduler(60_000, 120_000);
  const s2 = obtenerScheduler();
  assert.ok(s1 === s2);

  asignarScheduler(null);
});

test('forex-scheduler: holidayCalendar = NOT_IMPLEMENTED', () => {
  const scheduler = new ForexScheduler();
  const estado = scheduler.obtenerEstado();
  assert.equal(estado.holidayCalendar, 'NOT_IMPLEMENTED');
});
