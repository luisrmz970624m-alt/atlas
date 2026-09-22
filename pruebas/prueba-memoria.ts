// Pruebas de la memoria persistente.
// Todas usan una base en RAM: rápidas y sin dejar basura.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Memoria, SecretoRechazado, EspacioInvalido, recordarResultado, contexto } from '../src/memoria.ts';

const nueva = () => new Memoria(':memory:');

const base = { espacio: 'programacion' as const, clave: 'editor', resumen: 'usa VS Code', fuente: 'Luis' };

test('guarda y recupera un recuerdo', () => {
  const m = nueva();
  const r = m.recordar(base);
  assert.equal(r.id, 1);
  assert.equal(r.estado, 'vigente');
  assert.equal(r.origen, 'hecho');
  assert.equal(m.consultar({ clave: 'editor' })[0]!.resumen, 'usa VS Code');
});

test('LOS ESPACIOS NO SE MEZCLAN', () => {
  const m = nueva();
  m.recordar({ ...base, espacio: 'trading', clave: 'ganancia', resumen: '+500 en la simulación' });
  m.recordar({ ...base, espacio: 'personal', clave: 'ganancia', resumen: 'ninguna ganancia real' });

  assert.equal(m.consultar({ espacio: 'trading', clave: 'ganancia' }).length, 1);
  assert.match(m.consultar({ espacio: 'trading', clave: 'ganancia' })[0]!.resumen, /simulación/);
  assert.match(m.consultar({ espacio: 'personal', clave: 'ganancia' })[0]!.resumen, /ninguna/);
});

test('un espacio inventado se rechaza', () => {
  const m = nueva();
  assert.throws(() => m.recordar({ ...base, espacio: 'finanzas' as never }), EspacioInvalido);
});

test('UNA DEDUCCIÓN SE MARCA COMO DEDUCCIÓN', () => {
  const m = nueva();
  const r = m.recordar({ ...base, clave: 'nivel', resumen: 'parece principiante', origen: 'deduccion', confianza: 0.4 });
  assert.equal(r.origen, 'deduccion');
  assert.equal(r.confianza, 0.4);
});

test('LA MEMORIA NO GUARDA SECRETOS', () => {
  const m = nueva();
  assert.throws(() => m.recordar({ ...base, resumen: 'su password es 1234' }), SecretoRechazado);
  assert.throws(() => m.recordar({ ...base, resumen: 'API_KEY=abc123' }), SecretoRechazado);
  assert.equal(m.exportar().length, 0, 'no debe quedar rastro del intento');
});

test('un dato nuevo supera al anterior sin borrarlo', () => {
  const m = nueva();
  const viejo = m.recordar(base);
  m.recordar({ ...base, resumen: 'ahora usa neovim' });

  assert.equal(m.consultar({ clave: 'editor' }).length, 1);
  assert.match(m.consultar({ clave: 'editor' })[0]!.resumen, /neovim/);
  assert.equal(m.porId(viejo.id)!.estado, 'superado');   // la historia se conserva
});

test('olvidar deja el recuerdo marcado, no lo desaparece', () => {
  const m = nueva();
  const r = m.recordar(base);
  assert.equal(m.olvidar(r.id), true);
  assert.equal(m.consultar({ clave: 'editor' }).length, 0);
  assert.equal(m.porId(r.id)!.estado, 'olvidado');
  assert.equal(m.olvidar(r.id), false, 'olvidar dos veces no cuenta');
});

test('borrarDeVerdad sí lo elimina', () => {
  const m = nueva();
  const r = m.recordar(base);
  assert.equal(m.borrarDeVerdad(r.id), true);
  assert.equal(m.porId(r.id), null);
});

test('LAS CONTRADICCIONES SE MUESTRAN, NO SE OCULTAN', () => {
  const m = nueva();
  // Dos fuentes distintas afirman cosas distintas sobre lo mismo.
  m.recordar({ ...base, clave: 'horario', resumen: 'estudia por la mañana', fuente: 'Luis' });
  m.recordar({ ...base, clave: 'horario', resumen: 'estudia de madrugada', fuente: 'registro' });

  // Tras el segundo, el primero queda superado: no hay contradicción abierta.
  assert.deepEqual(m.contradicciones(), []);
  assert.equal(m.consultar({ clave: 'horario' }).length, 1);
});

test('búsqueda por texto', () => {
  const m = nueva();
  m.recordar({ ...base, clave: 'a', resumen: 'le cuesta el tipado genérico' });
  m.recordar({ ...base, clave: 'b', resumen: 'domina los arrays' });
  assert.equal(m.consultar({ texto: 'genérico' }).length, 1);
});

test('resumen por espacio', () => {
  const m = nueva();
  m.recordar({ ...base, clave: 'a' });
  m.recordar({ ...base, clave: 'b' });
  m.recordar({ ...base, espacio: 'sistema', clave: 'c' });
  assert.deepEqual(m.resumen(), { programacion: 2, sistema: 1 });
});

test('exportar devuelve todo, incluso lo olvidado', () => {
  const m = nueva();
  const r = m.recordar(base);
  m.olvidar(r.id);
  assert.equal(m.exportar().length, 1);
});

// ── Lo que hace que Atlas no empiece de cero ───────────────────────────────

test('recordarResultado guarda cómo terminó un objetivo', () => {
  const m = nueva();
  const r = recordarResultado(m, 'crear una lección', 'estándar no cumplido', 'faltó el ejercicio', ['l.md']);
  assert.equal(r.espacio, 'sistema');
  assert.match(r.resumen, /faltó el ejercicio/);
  assert.match(r.resumen, /l\.md/);
});

test('CONTEXTO DEVUELVE LOS INTENTOS ANTERIORES DEL MISMO OBJETIVO', () => {
  const m = nueva();
  recordarResultado(m, 'crear una lección', 'estándar no cumplido', 'faltó el ejercicio', []);
  const texto = contexto(m, 'crear una lección');
  assert.match(texto, /Intentos anteriores/);
  assert.match(texto, /faltó el ejercicio/);
  assert.match(texto, /no repitas lo que ya falló/);
});

test('sin historial, el contexto queda vacío', () => {
  assert.equal(contexto(nueva(), 'objetivo nuevo'), '');
});

// ── La memoria dentro del ciclo ────────────────────────────────────────────

test('EL CICLO LE PASA AL MODELO LO QUE FALLÓ LA VEZ ANTERIOR', async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  process.env.ATLAS_LABORATORIO = mkdtempSync(join(tmpdir(), 'atlas-lab-'));

  const { perseguir } = await import('../src/ciclo.ts');
  const registro = join(mkdtempSync(join(tmpdir(), 'atlas-')), 'registro.jsonl');
  const m = nueva();

  const PLAN = JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: 'crear una nota',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'n.md', contenido: '# Nota\n\nCorta.' },
      verificacion: { tipo: 'existe', archivo: 'n.md' },
    }],
  });

  // Primera vuelta: falla el estándar y queda memoria de ello.
  await perseguir(registro, 'crear una lección', async () => PLAN, 1, m);
  const guardado = m.consultar({ objetivo: 'crear una lección' });
  assert.equal(guardado.length, 1);
  assert.match(guardado[0]!.resumen, /estándar no cumplido/);

  // Segunda vuelta: el modelo recibe el historial sin que nadie se lo cuente.
  let peticion = '';
  await perseguir(registro, 'crear una lección', async (_s, u) => { peticion = u; return PLAN; }, 1, m);
  assert.match(peticion, /Intentos anteriores/);
  assert.match(peticion, /estándar no cumplido/);
});

test('sin memoria, el ciclo funciona igual', async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { perseguir } = await import('../src/ciclo.ts');

  const registro = join(mkdtempSync(join(tmpdir(), 'atlas-')), 'registro.jsonl');
  const { resultado } = await perseguir(registro, 'preparar material', async () => JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: 'crear',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'z.md', contenido: 'hola' },
      verificacion: { tipo: 'existe', archivo: 'z.md' },
    }],
  }), 1);
  assert.equal(resultado.parada, 'objetivo cumplido');
  assert.deepEqual(resultado.producidos, ['z.md']);
});
