// Pruebas de la evaluación de ejercicios.
// Estas SÍ ejecutan código de verdad: es el punto del módulo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { existsSync, mkdtempSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LAB = mkdtempSync(join(tmpdir(), 'atlas-eval-'));
process.env.ATLAS_LABORATORIO = LAB;

const { enunciado, ejecutar, revisar, evaluar, plantilla, LIMITE_MS, comprobarSandbox } = await import('../src/evaluacion.ts');
const sandboxDisponible = comprobarSandbox().disponible;
const pruebaConSandbox = (nombre: string, fn: () => void | Promise<void>) => test(nombre, { skip: !sandboxDisponible }, fn);

const escribir = (nombre: string, contenido: string) => {
  writeFileSync(join(LAB, nombre), contenido, 'utf8');
  return nombre;
};

const LECCION = `# Funciones

Las funciones agrupan código.

\`\`\`ts
function suma(a: number, b: number): number { return a + b; }
\`\`\`

## Ejercicio

1. Define una función \`multiplicar\` que acepte dos números.
2. Imprime el resultado de multiplicar 3 por 4.
`;

const falso = (r: object) => async () => JSON.stringify(r);

// ── El enunciado ───────────────────────────────────────────────────────────

test('extrae el enunciado del ejercicio', () => {
  const e = enunciado(LECCION)!;
  assert.match(e, /multiplicar/);
  assert.doesNotMatch(e, /Las funciones agrupan/, 'no debe arrastrar la explicación');
});

test('una lección sin ejercicio devuelve null', () => {
  assert.equal(enunciado('# Solo teoría\n\nTexto.'), null);
});

test('un ejercicio vacío también es null', () => {
  assert.equal(enunciado('# T\n\n## Ejercicio\n\n## Otra cosa\n'), null);
});

// ── La ejecución: el hecho duro ────────────────────────────────────────────

pruebaConSandbox('UN CÓDIGO QUE CORRE SE REPORTA COMO QUE CORRE', () => {
  const r = ejecutar(escribir('ok.ts', 'const x: number = 2;\nconsole.log("hola", x);\n'));
  assert.equal(r.corrio, true);
  assert.match(r.salida, /hola 2/);
});

pruebaConSandbox('UN CÓDIGO QUE REVIENTA SE REPORTA COMO QUE REVIENTA', () => {
  const r = ejecutar(escribir('malo.ts', 'throw new Error("me rompí");\n'));
  assert.equal(r.corrio, false);
  assert.match(r.error, /me rompí/);
});

pruebaConSandbox('un error de sintaxis no pasa por bueno', () => {
  const r = ejecutar(escribir('roto.ts', 'function {{{ sin sentido\n'));
  assert.equal(r.corrio, false);
});

pruebaConSandbox('UN BUCLE SIN FIN SE CORTA, NO CUELGA ATLAS', () => {
  const r = ejecutar(escribir('infinito.ts', 'while (true) {}\n'));
  assert.equal(r.corrio, false);
  assert.match(r.error, /segundos/);
  assert.ok(r.ms < LIMITE_MS + 5000, `tardó ${r.ms}ms`);
});

pruebaConSandbox('el código ejecutado no puede escribir fuera del laboratorio', () => {
  const nombre = `atlas-escape-${randomUUID()}`;
  const fuera = join(tmpdir(), nombre);
  const source = `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(fuera)}, 'escape');`;
  const r = ejecutar(escribir('intento-escape.ts', source));
  try {
    assert.equal(r.corrio, true, r.error);
    assert.equal(existsSync(fuera), false);
  } finally {
    if (existsSync(fuera)) unlinkSync(fuera);
  }
});

pruebaConSandbox('el código ejecutado no hereda variables de entorno del host', () => {
  process.env.ATLAS_EVAL_TEST_SECRET = 'no-debe-heredarse';
  try {
    const r = ejecutar(escribir('entorno.ts', 'console.log(process.env.ATLAS_EVAL_TEST_SECRET ?? "LIMPIO");'));
    assert.equal(r.corrio, true, r.error);
    assert.match(r.salida, /LIMPIO/);
    assert.doesNotMatch(r.salida, /no-debe-heredarse/);
  } finally {
    delete process.env.ATLAS_EVAL_TEST_SECRET;
  }
});

pruebaConSandbox('el código ejecutado no puede conectarse a la red del host', async () => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const source = `import { createConnection } from 'node:net'; const s=createConnection({host:'127.0.0.1',port:${address.port}}); s.setTimeout(500,()=>{console.log('BLOCKED');s.destroy()}); s.on('connect',()=>{console.log('CONNECTED');process.exitCode=1;s.destroy()}); s.on('error',()=>console.log('BLOCKED'));`;
    const r = ejecutar(escribir('red.ts', source));
    assert.equal(r.corrio, true, r.error);
    assert.match(r.salida, /BLOCKED/);
    assert.doesNotMatch(r.salida, /CONNECTED/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('un archivo que no existe no revienta la evaluación', () => {
  const r = ejecutar('fantasma.ts');
  assert.equal(r.corrio, false);
  assert.match(r.error, /No existe/);
});

test('salir del laboratorio se rechaza también al ejecutar', () => {
  assert.throws(() => ejecutar('../../etc/hosts'));
});

// ── La revisión: opinión, no hecho ─────────────────────────────────────────

test('la revisión normaliza lo que devuelve el modelo', async () => {
  const r = await revisar('enunciado', 'respuesta',
    { corrio: true, salida: '12', error: '', ms: 5 },
    falso({ cumple: true, aciertos: ['definió multiplicar'], faltantes: [], pista: 'bien' }));

  assert.equal(r.cumple, true);
  assert.deepEqual(r.aciertos, ['definió multiplicar']);
});

test('una respuesta rara del modelo no aprueba por accidente', async () => {
  const r = await revisar('e', 'r', { corrio: true, salida: '', error: '', ms: 0 },
    falso({ cumple: 'sí', pista: 42 }));

  assert.equal(r.cumple, false, 'solo true exacto aprueba');
  assert.deepEqual(r.aciertos, []);
  assert.equal(r.pista, '42');
});

test('la revisión ve si el código corrió o no', async () => {
  let recibido = '';
  await revisar('e', 'r', { corrio: false, salida: '', error: 'ReferenceError: x', ms: 1 },
    async (_s, u) => { recibido = u; return JSON.stringify({ cumple: false, pista: 'x' }); });

  assert.match(recibido, /NO se ejecutó/);
  assert.match(recibido, /ReferenceError/);
});

// ── El veredicto completo ──────────────────────────────────────────────────

pruebaConSandbox('EL CÓDIGO QUE NO CORRE NO APRUEBA, DIGA LO QUE DIGA EL MODELO', async () => {
  escribir('l1.md', LECCION);
  escribir('r1.ts', 'multiplicar(3, 4);\n');   // función nunca definida

  const r = await evaluar('l1.md', 'r1.ts', falso({ cumple: true, aciertos: ['perfecto'], faltantes: [], pista: '' }));

  assert.equal(r.aprobado, false, 'el hecho duro manda sobre la opinión');
  assert.equal(r.motivo, 'no ejecuta');
  assert.match(r.detalle, /multiplicar/);
});

pruebaConSandbox('el código que corre pero no resuelve tampoco aprueba', async () => {
  escribir('l2.md', LECCION);
  escribir('r2.ts', 'console.log("hola");\n');

  const r = await evaluar('l2.md', 'r2.ts',
    falso({ cumple: false, aciertos: [], faltantes: ['no definió multiplicar'], pista: 'empieza por function' }));

  assert.equal(r.aprobado, false);
  assert.equal(r.motivo, 'incompleto');
  assert.match(r.detalle, /no definió multiplicar/);
  assert.equal(r.ejecucion!.corrio, true, 'corrió, pero no basta');
});

pruebaConSandbox('corre Y resuelve: aprobado', async () => {
  escribir('l3.md', LECCION);
  escribir('r3.ts', 'function multiplicar(a: number, b: number): number { return a * b; }\nconsole.log(multiplicar(3, 4));\n');

  const r = await evaluar('l3.md', 'r3.ts',
    falso({ cumple: true, aciertos: ['definió multiplicar', 'imprimió 12'], faltantes: [], pista: '' }));

  assert.equal(r.aprobado, true);
  assert.equal(r.motivo, 'aprobado');
  assert.match(r.ejecucion!.salida, /12/);
});

test('sin respuesta escrita, se dice claramente', async () => {
  escribir('l4.md', LECCION);
  const r = await evaluar('l4.md', 'no-existe.ts', falso({ cumple: true }));

  assert.equal(r.motivo, 'sin respuesta');
  assert.equal(r.revision, null, 'no se molesta al modelo si no hay nada que revisar');
});

test('sin enunciado en la lección, se dice claramente', async () => {
  escribir('l5.md', '# Teoría\n\nSin ejercicio.');
  escribir('r5.ts', 'console.log(1);');
  const r = await evaluar('l5.md', 'r5.ts', falso({ cumple: true }));

  assert.equal(r.motivo, 'sin enunciado');
});

test('una respuesta en markdown se revisa sin ejecutarse', async () => {
  escribir('l6.md', LECCION);
  escribir('r6.md', 'Mi respuesta en prosa.');

  const r = await evaluar('l6.md', 'r6.md', falso({ cumple: true, aciertos: ['ok'], faltantes: [], pista: '' }));
  assert.equal(r.aprobado, true);
  assert.equal(r.ejecucion, null, 'el markdown no se ejecuta');
});

test('la plantilla incluye el enunciado comentado', () => {
  const p = plantilla('funciones', enunciado(LECCION)!);
  assert.match(p, /\/\/ 1\. Define una función/);
  assert.match(p, /funciones/);
});
