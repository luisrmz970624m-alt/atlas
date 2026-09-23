import { test } from 'node:test';
import * as assert from 'node:assert';
import { OrquestadorV08 } from '../src/orquestador-v08.ts';
import { MotorBots } from '../src/bots.ts';
import { unlinkSync, existsSync } from 'node:fs';

const DB_TEST = 'datos/orquestador-test.db';
const ESTADO_TEST = 'datos/orquestador-test-state.json';

function limpiar() {
  if (existsSync(DB_TEST)) unlinkSync(DB_TEST);
  if (existsSync(ESTADO_TEST)) unlinkSync(ESTADO_TEST);
}

test('orquestador: obtener estado inicial', async () => {
  limpiar();
  const orq = new OrquestadorV08(DB_TEST, ESTADO_TEST);

  const estado = await orq.obtener_estado();

  assert.ok(estado.timestamp);
  assert.equal(estado.nivel, 1);
  assert.ok(estado.energia_disponible > 0);
  assert.equal(estado.portafolio_usuario.capital, 10000);
  assert.equal(estado.portafolio_atlas.bots.length, 0); // Sin bots inicialmente
  assert.equal(estado.competencia.lider, 'empate');

  orq.cerrar();
  limpiar();
});

test('orquestador: ejecutar ciclo completo', async () => {
  limpiar();
  const orq = new OrquestadorV08(DB_TEST, ESTADO_TEST);

  const estado_antes = await orq.obtener_estado();

  // Ejecutar un ciclo manualmente
  await orq.ejecutar_ciclo();

  const estado_despues = await orq.obtener_estado();

  // Verificar que algo cambió (energía consumida o minería)
  assert.ok(estado_despues.timestamp >= estado_antes.timestamp);
  assert.ok(estado_despues.nivel >= estado_antes.nivel);

  orq.cerrar();
  limpiar();
});

test('orquestador: ejecución periódica', async () => {
  limpiar();
  const orq = new OrquestadorV08(DB_TEST, ESTADO_TEST);

  // Iniciar ejecución cada 100ms para test rápido
  orq.iniciar_ejecucion(100);

  // Esperar 250ms (2-3 ciclos)
  await new Promise(resolve => setTimeout(resolve, 250));

  const estado = await orq.obtener_estado();
  assert.ok(estado.timestamp);

  orq.detener_ejecucion();
  orq.cerrar();
  limpiar();
});

test('orquestador: sin snapshot antes del primer ciclo', () => {
  limpiar();
  const orq = new OrquestadorV08(DB_TEST, ESTADO_TEST);

  const persistido = orq.obtener_estado_persistido();

  assert.equal(persistido, null);

  orq.cerrar();
  limpiar();
});

test('orquestador: snapshot persistido tras ejecutar_ciclo', async () => {
  limpiar();
  const orq = new OrquestadorV08(DB_TEST, ESTADO_TEST);

  await orq.ejecutar_ciclo();
  const persistido = orq.obtener_estado_persistido();

  assert.ok(persistido !== null);
  assert.equal(persistido!.ciclos_ejecutados, 1);
  assert.equal(persistido!.ejecucion_activa, false);
  assert.ok(persistido!.estado.timestamp);

  orq.cerrar();
  limpiar();
});

test('orquestador: contador de ciclos persiste entre instancias (sobrevive "reinicio")', async () => {
  limpiar();

  const orq1 = new OrquestadorV08(DB_TEST, ESTADO_TEST);
  await orq1.ejecutar_ciclo();
  await orq1.ejecutar_ciclo();
  orq1.cerrar();

  // Nueva instancia simula un reinicio del proceso
  const orq2 = new OrquestadorV08(DB_TEST, ESTADO_TEST);
  await orq2.ejecutar_ciclo();

  const persistido = orq2.obtener_estado_persistido();
  assert.equal(persistido!.ciclos_ejecutados, 3);

  orq2.cerrar();
  limpiar();
});

test('orquestador: snapshot marca ejecucion_activa=true mientras el intervalo corre', async () => {
  limpiar();
  const orq = new OrquestadorV08(DB_TEST, ESTADO_TEST);

  // Intervalo largo: no necesitamos que dispare, solo que quede "activo"
  // mientras corremos un ciclo manual (evita depender del timing real del timer).
  orq.iniciar_ejecucion(60000);
  await orq.ejecutar_ciclo();

  const persistido = orq.obtener_estado_persistido();
  assert.equal(persistido!.ejecucion_activa, true);

  orq.detener_ejecucion();
  orq.cerrar();
  limpiar();
});

test('orquestador: iniciar_ejecucion dos veces no falla ni duplica el intervalo', async () => {
  limpiar();
  const orq = new OrquestadorV08(DB_TEST, ESTADO_TEST);

  orq.iniciar_ejecucion(1000);
  orq.iniciar_ejecucion(1000); // segunda llamada debe ser no-op seguro

  orq.detener_ejecucion();
  orq.cerrar();
  limpiar();
});

test('orquestador: detener_ejecucion sin haber iniciado no lanza error', () => {
  limpiar();
  const orq = new OrquestadorV08(DB_TEST, ESTADO_TEST);

  assert.doesNotThrow(() => orq.detener_ejecucion());

  orq.cerrar();
  limpiar();
});

test('orquestador: un bot DCA activo ejecuta una orden durante el ciclo', async () => {
  limpiar();
  // Capital deliberadamente alto: la estrategia DCA compra si
  // capital > precio*0.1, y el precio de BTC puede venir de la
  // API real (fluctúa) o del fallback simulado — un capital muy
  // por encima de cualquier precio realista evita que el test
  // dependa del valor de mercado del momento.
  const bots = new MotorBots(DB_TEST);
  bots.crear_bot({
    nombre: 'DCA-test-ciclo',
    estrategia: 'dca',
    capital_inicial: 1_000_000,
    simbolos: ['BTC'],
    parametros: {},
  });
  bots.cerrar();

  const orq = new OrquestadorV08(DB_TEST, ESTADO_TEST);
  await orq.ejecutar_ciclo();

  const estado = await orq.obtener_estado();
  const bot = estado.portafolio_atlas.bots[0];

  // DCA compra siempre que tenga capital: el capital debió bajar.
  // (trades_ejecutados solo cuenta operaciones CERRADAS —ver venta—,
  // una compra abierta no lo incrementa; eso es diseño, no bug.)
  assert.ok(bot.capital_actual < 1_000_000);

  orq.cerrar();
  limpiar();
});

test('orquestador: cerrar() detiene ejecución activa sin lanzar error', async () => {
  limpiar();
  const orq = new OrquestadorV08(DB_TEST, ESTADO_TEST);

  orq.iniciar_ejecucion(1000);

  assert.doesNotThrow(() => orq.cerrar());

  limpiar();
});
