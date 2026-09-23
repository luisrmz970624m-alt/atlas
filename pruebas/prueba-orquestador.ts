import { test } from 'node:test';
import * as assert from 'node:assert';
import { OrquestadorV08 } from '../src/orquestador-v08.ts';
import { unlinkSync, existsSync } from 'node:fs';

const DB_TEST = 'datos/orquestador-test.db';

function limpiar() {
  if (existsSync(DB_TEST)) unlinkSync(DB_TEST);
}

test('orquestador: obtener estado inicial', async () => {
  limpiar();
  const orq = new OrquestadorV08(DB_TEST);

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
  const orq = new OrquestadorV08(DB_TEST);

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
  const orq = new OrquestadorV08(DB_TEST);

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
