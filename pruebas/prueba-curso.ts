// Pruebas del profesor de programación.
// La más importante es la primera: generar material no es aprender.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Memoria } from '../src/memoria.ts';
import {
  TEMARIO, tema, avanceDe, registrarMaterial, registrarPractica,
  repasosPendientes, disponible, siguiente, progreso, ESPACIADO,
} from '../src/curso.ts';

const nueva = () => new Memoria(':memory:');

test('el temario respeta sus propios requisitos', () => {
  const ids = new Set(TEMARIO.map((t) => t.id));
  for (const t of TEMARIO) {
    for (const r of t.requiere) {
      assert.ok(ids.has(r), `${t.id} requiere ${r}, que no existe`);
      const antes = TEMARIO.findIndex((x) => x.id === r);
      const yo = TEMARIO.findIndex((x) => x.id === t.id);
      assert.ok(antes < yo, `${r} debe venir antes que ${t.id}`);
    }
  }
});

test('GENERAR MATERIAL NO CUENTA COMO APRENDER', () => {
  const m = nueva();
  registrarMaterial(m, 'variables', ['leccion-01.md']);

  const a = avanceDe(m, 'variables');
  assert.equal(a.estado, 'material');
  assert.deepEqual(a.practicas, [], 'Atlas escribió la lección; Luis no ha hecho nada');
  assert.equal(a.repaso, null, 'no se programa repaso de algo que no se practicó');
});

test('una práctica cuenta, pero no basta para dominar', () => {
  const m = nueva();
  registrarPractica(m, 'variables', '2026-09-22');

  const a = avanceDe(m, 'variables');
  assert.equal(a.estado, 'practicado');
  assert.deepEqual(a.practicas, ['2026-09-22']);
  assert.equal(a.repaso, '2026-09-23', 'primer repaso al día siguiente');
});

test('DOS PRÁCTICAS EL MISMO DÍA NO SON DOMINIO', () => {
  const m = nueva();
  registrarPractica(m, 'variables', '2026-09-22');
  registrarPractica(m, 'variables', '2026-09-22');

  assert.equal(avanceDe(m, 'variables').estado, 'practicado');
  assert.equal(avanceDe(m, 'variables').practicas.length, 1, 'el mismo día cuenta una vez');
});

test('dos prácticas en días distintos sí son dominio', () => {
  const m = nueva();
  registrarPractica(m, 'variables', '2026-09-22');
  registrarPractica(m, 'variables', '2026-09-25');

  const a = avanceDe(m, 'variables');
  assert.equal(a.estado, 'dominado');
  assert.equal(a.repaso, '2026-09-28', 'segundo repaso a los 3 días');
});

test('el espaciado avanza 1, 3, 7, 14, 30 y se queda ahí', () => {
  const m = nueva();
  const dias = ['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-12', '2026-01-26', '2026-02-25', '2026-04-01'];
  const esperados = ['2026-01-02', '2026-01-05', '2026-01-12', '2026-01-26', '2026-02-25', '2026-03-27', '2026-05-01'];

  dias.forEach((d, i) => {
    const a = registrarPractica(m, 'bucles', d);
    assert.equal(a.repaso, esperados[i], `práctica ${i + 1}`);
  });
  assert.equal(ESPACIADO.at(-1), 30);
});

test('un repaso vencido aparece; uno futuro no', () => {
  const m = nueva();
  registrarPractica(m, 'variables', '2026-09-22');   // repaso el 23

  assert.equal(repasosPendientes(m, '2026-09-22').length, 0);
  assert.equal(repasosPendientes(m, '2026-09-23').length, 1);
  assert.equal(repasosPendientes(m, '2026-10-01').length, 1);
});

test('UN TEMA NO SE ABRE SIN SUS REQUISITOS', () => {
  const m = nueva();
  assert.equal(disponible(m, tema('arrays')!), false);

  registrarPractica(m, 'variables');
  registrarPractica(m, 'condiciones');
  registrarPractica(m, 'bucles');
  assert.equal(disponible(m, tema('arrays')!), false, 'aún falta funciones');

  registrarPractica(m, 'funciones');
  assert.equal(disponible(m, tema('arrays')!), true);
});

test('tener material no desbloquea lo que depende de él', () => {
  const m = nueva();
  registrarMaterial(m, 'variables', ['l.md']);
  assert.equal(disponible(m, tema('condiciones')!), false, 'material no es práctica');
});

test('siguiente() empieza por el primer tema sin requisitos', () => {
  const s = siguiente(nueva())!;
  assert.equal(s.tema.id, 'terminal');
  assert.equal(s.motivo, 'nuevo');
});

test('EL REPASO VENCIDO GANA AL TEMA NUEVO', () => {
  const m = nueva();
  registrarPractica(m, 'terminal', '2026-09-22');
  registrarPractica(m, 'variables', '2026-09-22');

  const s = siguiente(m, '2026-09-25')!;
  assert.equal(s.motivo, 'repaso');
  assert.ok(['terminal', 'variables'].includes(s.tema.id));
});

test('terminar lo empezado gana al tema nuevo', () => {
  const m = nueva();
  registrarMaterial(m, 'terminal', ['l.md']);

  const s = siguiente(m)!;
  assert.equal(s.tema.id, 'terminal');
  assert.equal(s.motivo, 'continuar');
});

test('sin nada por hacer, siguiente() devuelve null', () => {
  const m = nueva();
  const lejos = '2026-01-01';
  for (const t of TEMARIO) registrarPractica(m, t.id, lejos);
  // Todos practicados hace mucho: hay repasos, así que hay algo que hacer.
  assert.ok(siguiente(m, '2026-06-01') !== null);

  // En el mismo día de la práctica no hay repasos vencidos ni temas libres.
  assert.equal(siguiente(m, lejos), null);
});

test('el progreso cuenta cada estado por separado', () => {
  const m = nueva();
  registrarMaterial(m, 'terminal', ['a.md']);
  registrarPractica(m, 'variables', '2026-09-22');
  registrarPractica(m, 'condiciones', '2026-09-22');
  registrarPractica(m, 'condiciones', '2026-09-24');

  const p = progreso(m, '2026-09-24');
  assert.equal(p.conMaterial, 1);
  assert.equal(p.practicados, 1);
  assert.equal(p.dominados, 1);
  assert.equal(p.pendientes, TEMARIO.length - 3);
  assert.equal(p.repasosHoy, 1, 'solo variables vence; condiciones se repasa el 27');
});

test('el avance sobrevive a cerrar y reabrir la memoria', async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const ruta = join(mkdtempSync(join(tmpdir(), 'atlas-mem-')), 'memoria.db');

  const m1 = new Memoria(ruta);
  registrarPractica(m1, 'funciones', '2026-09-22');
  m1.cerrar();

  const m2 = new Memoria(ruta);
  const a = avanceDe(m2, 'funciones');
  assert.equal(a.estado, 'practicado');
  assert.deepEqual(a.practicas, ['2026-09-22']);
  m2.cerrar();
});

test('CADA TEMA TRAE SU PROPIO OBJETIVO, Y NINGUNO MENCIONA COMPILAR', () => {
  for (const t of TEMARIO) {
    assert.ok(t.objetivo.length > 20, `${t.id} sin objetivo útil`);
    assert.match(t.objetivo, /lecci[oó]n/i, `${t.id} debe activar el estándar de lección`);
    assert.doesNotMatch(t.objetivo, /\btsc\b|compilar|instalar/i, `${t.id} no debe empujar a compilar`);
  }
});
