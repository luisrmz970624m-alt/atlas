// Pruebas de la revisión del plan.
// El caso real que las motivó: qwen2.5-coder devolvió ocho pasos cuyas
// verificaciones eran "verificar que <el paso>". Eso no verifica nada.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { planear, revisar, planearConRevision } from '../src/ciclo.ts';

const falso = (json: string) => async () => json;

const CIRCULAR = JSON.stringify({
  criterio_final: 'haber estudiado 30 minutos',
  pasos: [
    { descripcion: 'Abrir un editor de código', verificacion: 'verificar que el editor de código está abierto' },
    { descripcion: 'Iniciar un temporizador', verificacion: 'verificar que el temporizador está en marcha' },
  ],
});

const BUENO = JSON.stringify({
  criterio_final: 'existe leccion-01.md con el ejercicio resuelto',
  pasos: [
    { descripcion: 'crear leccion-01.md con la explicación', verificacion: 'el archivo mide más de 200 bytes' },
    { descripcion: 'generar un ejercicio al final', verificacion: 'el texto contiene la sección "## Ejercicio"' },
  ],
});

test('detecta una verificación que empieza con "verificar que"', async () => {
  const plan = await planear('estudiar', falso(CIRCULAR));
  const problemas = revisar(plan);
  assert.equal(problemas.length, 2);
  assert.match(problemas[0]!.queja, /solo repite el paso/);
});

test('detecta una verificación que repite las palabras del paso', async () => {
  const plan = await planear('x', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{ descripcion: 'crear el archivo de notas', verificacion: 'el archivo de notas creado' }],
  })));
  assert.equal(revisar(plan).length, 1);
});

test('detecta una verificación vacía', async () => {
  const plan = await planear('x', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{ descripcion: 'hacer algo', verificacion: '' }],
  })));
  assert.match(revisar(plan)[0]!.queja, /no declara cómo verificarse/);
});

test('un plan con evidencia observable pasa la revisión', async () => {
  const plan = await planear('estudiar', falso(BUENO));
  assert.deepEqual(revisar(plan), []);
});

test('un plan flojo se reescribe como versión 2', async () => {
  let llamada = 0;
  const generador = async () => (++llamada === 1 ? CIRCULAR : BUENO);

  const { plan, historial, problemas } = await planearConRevision('estudiar', generador);
  assert.equal(plan.version, 2);
  assert.equal(historial.length, 1);
  assert.equal(historial[0]!.version, 1);   // el plan viejo se conserva
  assert.deepEqual(problemas, []);
});

test('si el modelo insiste en un plan flojo, se avisa en lugar de fingir', async () => {
  const { plan, problemas } = await planearConRevision('estudiar', falso(CIRCULAR));
  assert.equal(plan.version, 2);
  assert.equal(problemas.length, 2);        // se reporta, no se esconde
});
