// Pruebas del ciclo central con ejecución real y comprobación real.
// No necesitan Ollama: se inyecta un generador falso.
// Cada prueba usa su propio laboratorio temporal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LAB = mkdtempSync(join(tmpdir(), 'atlas-lab-'));
process.env.ATLAS_LABORATORIO = LAB;

const { planear, ejecutar, revisar, planearConRevision } = await import('../src/ciclo.ts');
const { extraerJSON } = await import('../src/modelo.ts');
const { auditar, leerEventos } = await import('../src/registro.ts');
const { rutaSegura, FueraDelLaboratorio } = await import('../src/herramientas.ts');

const ruta = () => join(mkdtempSync(join(tmpdir(), 'atlas-')), 'registro.jsonl');
const falso = (json: string) => async () => json;

const PLAN_BUENO = JSON.stringify({
  criterio_final: 'existe la lección con su ejercicio',
  pasos: [
    {
      descripcion: 'crear la lección 1',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'leccion-01.md', contenido: '# Lección 1\n\nTypeScript añade tipos a JavaScript.\n\n## Ejercicio\n\nEscribe una función tipada.\n' },
      verificacion: { tipo: 'contiene', archivo: 'leccion-01.md', valor: '## Ejercicio' },
    },
  ],
});

test('extraerJSON tolera bloques de código y texto alrededor', () => {
  assert.deepEqual(extraerJSON('Claro:\n```json\n{"a":1}\n```\nlisto'), { a: 1 });
});

test('un plan válido se ejecuta de verdad y crea el archivo', async () => {
  const r0 = ruta();
  const plan = await planear('preparar material inicial', falso(PLAN_BUENO));
  const r = ejecutar(r0, plan);

  assert.equal(r.parada, 'objetivo cumplido');
  assert.equal(r.ejecutados, 1);
  assert.ok(existsSync(join(LAB, 'leccion-01.md')), 'el archivo debe existir de verdad');
  assert.match(readFileSync(join(LAB, 'leccion-01.md'), 'utf8'), /## Ejercicio/);
  assert.equal(auditar(r0).estado, 'integra');
});

test('UN PASO QUE NO PASA SU VERIFICACIÓN CUENTA COMO FALLO', async () => {
  const r0 = ruta();
  const plan = await planear('x', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: 'escribir algo incompleto',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'corto.md', contenido: 'hola' },
      verificacion: { tipo: 'contiene', archivo: 'corto.md', valor: '## Ejercicio' },
    }],
  })));

  const r = ejecutar(r0, plan);
  assert.equal(r.ejecutados, 0, 'el paso no debe contar como hecho');
  assert.ok(existsSync(join(LAB, 'corto.md')), 'el archivo sí se escribió…');

  const error = leerEventos(r0).find((e) => e.tipo === 'error');
  assert.ok(error, '…pero debe quedar registrado como fallo');
  assert.match(String(error!.razon), /NO contiene/);
});

// ── Un solo juez del tamaño ────────────────────────────────────────────────

test('UN UMBRAL DE TAMAÑO EN UN PASO SE CONVIERTE EN "EXISTE"', async () => {
  // El fallo real, dos veces: el modelo reparte la meta entre los pasos
  // ("5 líneas, luego 10, luego 15…"), calcula mal porque las líneas en blanco
  // no cuentan, y el ciclo se detiene por tres fallos habiendo hecho el trabajo.
  const plan = await planear('crear una lección', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [
      { descripcion: 'intro', herramienta: 'escribir_archivo', argumentos: { ruta: 'l.md', contenido: '# Título\n\nTexto.' }, verificacion: { tipo: 'min_lineas', archivo: 'l.md', valor: 5 } },
      { descripcion: 'más', herramienta: 'agregar_archivo', argumentos: { ruta: 'l.md', contenido: 'Más texto.' }, verificacion: { tipo: 'min_bytes', archivo: 'l.md', valor: 900 } },
      { descripcion: 'ejercicio', herramienta: 'agregar_archivo', argumentos: { ruta: 'l.md', contenido: '## Ejercicio\n\nPractica.' }, verificacion: { tipo: 'contiene', archivo: 'l.md', valor: '## Ejercicio' } },
    ],
  })));

  assert.equal(plan.pasos[0]!.verificacion!.tipo, 'existe');
  assert.equal(plan.pasos[0]!.ajustada, true);
  assert.equal(plan.pasos[1]!.verificacion!.tipo, 'existe');
  assert.equal(plan.pasos[1]!.ajustada, true);

  // "contiene" es una afirmación sobre lo que ESE paso hizo: se respeta.
  assert.equal(plan.pasos[2]!.verificacion!.tipo, 'contiene');
  assert.equal(plan.pasos[2]!.ajustada, false);
});

test('con la corrección, el plan que fallaba tres veces ahora termina', async () => {
  const r0 = ruta();
  const cuerpo = Array.from({ length: 22 }, (_, i) => `Línea ${i} con contenido real.`).join('\n');
  const plan = await planear('crear una lección', falso(JSON.stringify({
    criterio_final: 'la lección está completa',
    pasos: [
      { descripcion: 'intro', herramienta: 'escribir_archivo', argumentos: { ruta: 'ok.md', contenido: `# Título\n\n${cuerpo}` }, verificacion: { tipo: 'min_lineas', archivo: 'ok.md', valor: 40 } },
      { descripcion: 'código', herramienta: 'agregar_archivo', argumentos: { ruta: 'ok.md', contenido: '```ts\nconst x: number = 1;\n```' }, verificacion: { tipo: 'min_lineas', archivo: 'ok.md', valor: 60 } },
      { descripcion: 'ejercicio', herramienta: 'agregar_archivo', argumentos: { ruta: 'ok.md', contenido: '## Ejercicio\n\nPractica.' }, verificacion: { tipo: 'contiene', archivo: 'ok.md', valor: '## Ejercicio' } },
    ],
  })));

  const r = ejecutar(r0, plan);
  assert.equal(r.parada, 'objetivo cumplido', r.detalle);
  assert.equal(r.ejecutados, 3);
});

test('SALIR DEL LABORATORIO ES RECHAZADO', () => {
  assert.throws(() => rutaSegura('../../etc/passwd'), FueraDelLaboratorio);
  assert.throws(() => rutaSegura('/etc/passwd'), FueraDelLaboratorio);
  assert.ok(rutaSegura('sub/carpeta/x.md').startsWith(LAB));
});

test('un plan que intenta escapar del laboratorio falla al ejecutarse', async () => {
  const r0 = ruta();
  const plan = await planear('x', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: 'guardar una nota',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: '../fuera.md', contenido: 'no debería existir' },
      verificacion: { tipo: 'existe', archivo: '../fuera.md' },
    }],
  })));

  ejecutar(r0, plan);
  assert.ok(!existsSync(join(LAB, '..', 'fuera.md')), 'nada se escribe fuera del laboratorio');
  const error = leerEventos(r0).find((e) => e.tipo === 'error');
  assert.match(String(error!.razon), /RECHAZADO/);
});

test('un paso rojo nunca se ejecuta', async () => {
  const r0 = ruta();
  const plan = await planear('limpiar', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: 'ejecutar sudo rm -rf',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'x.md', contenido: 'x' },
      verificacion: { tipo: 'existe', archivo: 'x.md' },
    }],
  })));

  assert.equal(plan.pasos[0]!.nivel, 'rojo');
  const r = ejecutar(r0, plan);
  assert.equal(r.parada, 'requiere aprobación');
  assert.equal(r.ejecutados, 0);
});

test('el Supervisor mira también los argumentos, no solo la descripción', async () => {
  const plan = await planear('inocente', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: 'guardar una nota',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'nota.md', contenido: 'mi password es 1234' },
      verificacion: { tipo: 'existe', archivo: 'nota.md' },
    }],
  })));
  assert.equal(plan.pasos[0]!.nivel, 'rojo');
});

test('revisar rechaza herramientas inventadas y marcadores', async () => {
  const plan = await planear('x', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [
      { descripcion: 'a', herramienta: 'enviar_correo', argumentos: {}, verificacion: { tipo: 'existe', archivo: 'a.md' } },
      { descripcion: 'b', herramienta: 'escribir_archivo', argumentos: { ruta: 'b.md', contenido: '<aquí el texto>' }, verificacion: { tipo: 'existe', archivo: 'b.md' } },
      { descripcion: 'c', herramienta: 'escribir_archivo', argumentos: { ruta: 'c.md', contenido: 'ok' }, verificacion: 'el archivo existe' },
    ],
  })));

  const problemas = revisar(plan);
  assert.equal(problemas.length, 3);
  assert.match(problemas[0]!.queja, /no existe/);
  assert.match(problemas[1]!.queja, /marcador/);
  assert.match(problemas[2]!.queja, /verificación comprobable/);
});

test('un plan inválido no se ejecuta en absoluto', async () => {
  const r0 = ruta();
  const plan = await planear('x', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{ descripcion: 'a', herramienta: 'volar', argumentos: {}, verificacion: { tipo: 'existe', archivo: 'a.md' } }],
  })));

  const r = ejecutar(r0, plan);
  assert.equal(r.parada, 'plan inválido');
  assert.equal(r.ejecutados, 0);
});

test('un plan flojo se reescribe como versión 2', async () => {
  let n = 0;
  const generador = async () => (++n === 1
    ? JSON.stringify({ criterio_final: 'x', pasos: [{ descripcion: 'a', herramienta: 'volar', argumentos: {}, verificacion: null }] })
    : PLAN_BUENO);

  const { plan, historial, problemas } = await planearConRevision('preparar material inicial', generador);
  assert.equal(plan.version, 2);
  assert.equal(historial.length, 1);
  assert.deepEqual(problemas, []);
});

test('si el modelo insiste en un plan inválido, se avisa en lugar de fingir', async () => {
  const malo = JSON.stringify({ criterio_final: 'x', pasos: [{ descripcion: 'a', herramienta: 'volar', argumentos: {}, verificacion: null }] });
  const { problemas } = await planearConRevision('x', falso(malo));
  assert.ok(problemas.length > 0);
});

test('el registro no guarda volcados enormes de contenido', async () => {
  const r0 = ruta();
  const plan = await planear('x', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: 'escribir mucho',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'largo.md', contenido: 'a'.repeat(3000) },
      verificacion: { tipo: 'min_bytes', archivo: 'largo.md', valor: 100 },
    }],
  })));

  ejecutar(r0, plan);
  const evento = leerEventos(r0).find((e) => e.tipo === 'resultado')!;
  const entrada = evento.entrada as { argumentos: { contenido: string } };
  assert.ok(entrada.argumentos.contenido.length < 200);
  assert.match(entrada.argumentos.contenido, /3000 caracteres/);
});

// ── Estándares: el examen que Atlas no puede negociar ───────────────────────

const { estandarPara } = await import('../src/estandares.ts');

test('un objetivo de lección activa el estándar "leccion"', () => {
  assert.equal(estandarPara('crear una lección de TypeScript')?.tipo, 'leccion');
  assert.equal(estandarPara('haz un resumen del tema')?.tipo, 'resumen');
  assert.equal(estandarPara('ordenar mis archivos'), null);
});

test('UNA LECCIÓN SIN CÓDIGO NI EJERCICIO NO PASA, AUNQUE EL PLAN SE APRUEBE', async () => {
  const r0 = ruta();
  // Igual que hizo qwen2.5-coder: puro índice, y su propia vara en 200 bytes.
  const indice = '# Tipos\n\n' + Array.from({ length: 25 }, (_, i) => `## Tema ${i}\n\nTexto explicativo.\n`).join('\n');
  const plan = await planear('crear una lección de TypeScript', falso(JSON.stringify({
    criterio_final: 'el archivo mide más de 200 bytes',
    pasos: [{
      descripcion: 'crear la lección',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'indice.md', contenido: indice },
      verificacion: { tipo: 'min_bytes', archivo: 'indice.md', valor: 200 },
    }],
  })));

  const r = ejecutar(r0, plan);
  assert.equal(r.parada, 'estándar no cumplido');
  assert.match(r.detalle, /ningún archivo contiene/);
});

test('una lección con código y ejercicio sí pasa el estándar', async () => {
  const r0 = ruta();
  const buena = ['# Tipos básicos', '', 'TypeScript añade tipos a JavaScript.', '', '```ts',
    'const nombre: string = "Luis";', 'const edad: number = 28;', '```', '']
    .concat(Array.from({ length: 14 }, (_, i) => `Detalle ${i}.`))
    .concat(['', '## Ejercicio', '', 'Escribe una función tipada que sume dos números.']).join('\n');

  const plan = await planear('crear una lección de TypeScript', falso(JSON.stringify({
    criterio_final: 'la lección está completa',
    pasos: [{
      descripcion: 'crear la lección',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'buena.md', contenido: buena },
      verificacion: { tipo: 'contiene', archivo: 'buena.md', valor: '## Ejercicio' },
    }],
  })));

  const r = ejecutar(r0, plan);
  assert.equal(r.parada, 'objetivo cumplido');
});

test('el estándar queda registrado, pase o falle', async () => {
  const r0 = ruta();
  const plan = await planear('crear una lección', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: 'crear',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'flojo.md', contenido: 'apenas texto' },
      verificacion: { tipo: 'existe', archivo: 'flojo.md' },
    }],
  })));

  ejecutar(r0, plan);
  const eventos = leerEventos(r0).filter((e) => e.descripcion.startsWith('Estándar'));
  assert.equal(eventos.length, 6);                       // las seis exigencias
  assert.equal(eventos.filter((e) => e.veredicto === 'fallo').length, 3);
  assert.equal(auditar(r0).estado, 'integra');
});

// ── Respuestas cortadas: el tope de salida del modelo local ─────────────────

const { RespuestaIncompleta } = await import('../src/modelo.ts');

test('una respuesta cortada se reintenta pidiendo pasos más cortos', async () => {
  let n = 0;
  const generador = async (_s: string, u: string) => {
    if (++n === 1) throw new RespuestaIncompleta('cortada');
    assert.match(u, /se cortó por ser demasiado larga/);
    return PLAN_BUENO;
  };

  const plan = await planear('preparar material inicial', generador);
  assert.equal(plan.pasos.length, 1);
  assert.equal(n, 2);
});

test('si se corta dos veces, el error sube con mensaje claro', async () => {
  const generador = async () => { throw new RespuestaIncompleta('cortada de nuevo'); };
  await assert.rejects(() => planear('x', generador), RespuestaIncompleta);
});

test('un archivo desmesurado se rechaza antes de escribirse', async () => {
  const plan = await planear('x', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: 'escribir un tocho',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'tocho.md', contenido: 'a'.repeat(9000) },
      verificacion: { tipo: 'existe', archivo: 'tocho.md' },
    }],
  })));
  assert.match(revisar(plan)[0]!.queja, /demasiado largo/);
});

// ── Aprender del rechazo ────────────────────────────────────────────────────

const { perseguir } = await import('../src/ciclo.ts');

const LECCION_FLOJA = JSON.stringify({
  criterio_final: 'existe la lección',
  pasos: [{
    descripcion: 'crear la lección',
    herramienta: 'escribir_archivo',
    argumentos: { ruta: 'l.md', contenido: '# Tipos\n\nHay varios tipos.\n\n## Ejercicio\n\nPractica.' },
    verificacion: { tipo: 'existe', archivo: 'l.md' },
  }],
});

const LECCION_BUENA = JSON.stringify({
  criterio_final: 'la lección está completa',
  pasos: [{
    descripcion: 'crear la lección',
    herramienta: 'escribir_archivo',
    argumentos: {
      ruta: 'l.md',
      contenido: ['# Tipos básicos', '', 'TypeScript añade tipos a JavaScript.', '', '```ts',
        'const nombre: string = "Luis";', 'const edad: number = 28;', 'const activo: boolean = true;', '```', '']
        .concat(Array.from({ length: 12 }, (_, i) => `Nota ${i} sobre los tipos.`))
        .concat(['', '## Ejercicio', '', 'Declara una variable de cada tipo.']).join('\n'),
    },
    verificacion: { tipo: 'contiene', archivo: 'l.md', valor: '## Ejercicio' },
  }],
});

test('UN RECHAZO DEL ESTÁNDAR SE REINTENTA CON LA QUEJA COMO PISTA', async () => {
  const r0 = ruta();
  let n = 0;
  let segundaPeticion = '';
  const generador = async (_s: string, u: string) => {
    n++;
    if (n === 1) return LECCION_FLOJA;
    segundaPeticion = u;
    return LECCION_BUENA;
  };

  const { resultado, intentos } = await perseguir(r0, 'crear una lección de TypeScript', generador);

  assert.equal(resultado.parada, 'objetivo cumplido');
  assert.equal(intentos, 2);
  assert.match(segundaPeticion, /NO pasó el estándar/);
  assert.match(segundaPeticion, /ningún archivo contiene/);      // la queja concreta viaja al modelo
});

test('si el modelo no mejora, se detiene y lo dice sin fingir', async () => {
  const r0 = ruta();
  const { resultado, intentos } = await perseguir(r0, 'crear una lección', async () => LECCION_FLOJA);

  assert.equal(resultado.parada, 'estándar no cumplido');
  assert.equal(intentos, 2);
  assert.equal(auditar(r0).estado, 'integra');
});

test('el rechazo y el reintento quedan en el registro', async () => {
  const r0 = ruta();
  await perseguir(r0, 'crear una lección', async () => LECCION_FLOJA);
  const rechazos = leerEventos(r0).filter((e) => e.descripcion.includes('rechazado por el estándar'));
  assert.equal(rechazos.length, 1);
  assert.equal(rechazos[0]!.veredicto, 'fallo');
});

test('EL ESTÁNDAR MIDE EL CONJUNTO, NO CADA ARCHIVO POR SEPARADO', async () => {
  // El caso real: qwen partió la lección en tres archivos de ~14 líneas.
  // Ninguno llegaba a 20, pero juntos sumaban de sobra.
  const r0 = ruta();
  const trozo = (n: number, extra: string) =>
    ['# Parte ' + n, ''].concat(Array.from({ length: 9 }, (_, i) => `Línea ${i} de la parte ${n}.`)).concat([extra]).join('\n');

  const plan = await planear('crear una lección de TypeScript', falso(JSON.stringify({
    criterio_final: 'la lección está repartida en tres archivos',
    pasos: [1, 2, 3].map((n) => ({
      descripcion: `crear la parte ${n}`,
      herramienta: 'escribir_archivo',
      argumentos: {
        ruta: `parte-0${n}.md`,
        contenido: trozo(n, n === 2 ? '```ts\nconst x: number = 1;\n```' : n === 3 ? '## Ejercicio\n\nPractica.' : ''),
      },
      verificacion: { tipo: 'existe', archivo: `parte-0${n}.md` },
    })),
  })));

  const r = ejecutar(r0, plan);
  assert.equal(r.parada, 'objetivo cumplido', r.detalle);
  assert.equal(r.ejecutados, 3);
});

test('el conjunto sigue fallando si de verdad falta el material', async () => {
  const r0 = ruta();
  const plan = await planear('crear una lección', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: 'crear una nota suelta',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'suelta.md', contenido: '# Nota\n\nDos líneas y nada más.' },
      verificacion: { tipo: 'existe', archivo: 'suelta.md' },
    }],
  })));

  const r = ejecutar(r0, plan);
  assert.equal(r.parada, 'estándar no cumplido');
  assert.match(r.detalle, /suman 2 línea/);
});

// ── Acción frente a dato, y reemplazos accidentales ─────────────────────────

test('UNA LECCIÓN SOBRE CADENAS NO SE CONFUNDE CON ENVIAR UN MENSAJE', async () => {
  // Falso positivo real: el contenido traía `let mensaje: string = "Hola"`
  // y el Supervisor lo clasificó amarillo por la palabra "mensaje".
  const plan = await planear('crear una lección', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: "Escribir una explicación sobre el tipo 'string'.",
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'str.md', contenido: '```ts\nlet mensaje: string = "Hola";\n```\nEnviar y publicar son verbos, no acciones aquí.' },
      verificacion: { tipo: 'existe', archivo: 'str.md' },
    }],
  })));
  assert.equal(plan.pasos[0]!.nivel, 'verde');
});

test('pero un secreto en el contenido sigue siendo rojo', async () => {
  const plan = await planear('x', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: 'guardar una nota',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'n.md', contenido: 'mi password del banco es 1234' },
      verificacion: { tipo: 'existe', archivo: 'n.md' },
    }],
  })));
  assert.equal(plan.pasos[0]!.nivel, 'rojo');
});

test('y una acción peligrosa en la ruta sigue siendo roja', async () => {
  const plan = await planear('x', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: 'guardar',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: '/etc/passwd', contenido: 'hola' },
      verificacion: { tipo: 'existe', archivo: 'x.md' },
    }],
  })));
  assert.notEqual(plan.pasos[0]!.nivel, 'verde');
});

test('DOS PASOS QUE REEMPLAZAN EL MISMO ARCHIVO SE RECHAZAN', async () => {
  // El caso real: ocho pasos, todos escribir_archivo sobre leccion-01.md.
  // Cada uno borraba al anterior y solo sobrevivía el último.
  const plan = await planear('x', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [1, 2, 3].map((n) => ({
      descripcion: `parte ${n}`,
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'l.md', contenido: `Sección ${n}.` },
      verificacion: { tipo: 'existe', archivo: 'l.md' },
    })),
  })));

  const problemas = revisar(plan);
  assert.equal(problemas.length, 2);              // los pasos 2 y 3
  assert.match(problemas[0]!.queja, /ya escribió el paso 1/);
  assert.match(problemas[0]!.queja, /agregar_archivo/);
});

test('escribir y luego agregar al mismo archivo sí es válido y acumula', async () => {
  const r0 = ruta();
  const plan = await planear('x', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [
      { descripcion: 'abrir', herramienta: 'escribir_archivo', argumentos: { ruta: 'acum.md', contenido: '# Título' }, verificacion: { tipo: 'existe', archivo: 'acum.md' } },
      { descripcion: 'añadir', herramienta: 'agregar_archivo', argumentos: { ruta: 'acum.md', contenido: 'Segunda línea.' }, verificacion: { tipo: 'contiene', archivo: 'acum.md', valor: 'Segunda' } },
      { descripcion: 'añadir más', herramienta: 'agregar_archivo', argumentos: { ruta: 'acum.md', contenido: 'Tercera línea.' }, verificacion: { tipo: 'contiene', archivo: 'acum.md', valor: 'Título' } },
    ],
  })));

  assert.deepEqual(revisar(plan), []);
  const r = ejecutar(r0, plan);
  assert.equal(r.ejecutados, 3);

  const texto = readFileSync(join(LAB, 'acum.md'), 'utf8');
  assert.match(texto, /# Título/);        // no se perdió lo primero
  assert.match(texto, /Tercera línea/);
});

// ── Un ejercicio resuelto no es un ejercicio ───────────────────────────────

const { sinSolucion } = await import('../src/verificacion.ts');

test('UNA LECCIÓN QUE REGALA LA SOLUCIÓN NO PASA', () => {
  // El caso real: qwen cerró la lección con "Aquí tienes una solución posible"
  // y el código resuelto debajo.
  const mala = ['# Tema', '', 'Explicación.', '', '## Ejercicio', '',
    'Crea una función que sume.', '',
    'Aquí tienes una solución posible:', '', '```ts', 'const f = (a,b) => a+b;', '```'].join('\n');

  const r = sinSolucion(mala, 'l.md');
  assert.equal(r.paso, false);
  assert.match(r.evidencia, /REGALA la solución/);
});

test('explicar una solución ANTES del ejercicio sí es legítimo', () => {
  const buena = ['# Tema', '', 'La solución de este problema de ejemplo es simple.', '',
    '```ts', 'const x = 1;', '```', '', '## Ejercicio', '', 'Ahora hazlo tú con dos números.'].join('\n');

  assert.equal(sinSolucion(buena, 'l.md').paso, true);
});

test('una lección sin ejercicio no se juzga por esto', () => {
  assert.equal(sinSolucion('# Solo teoría\n\nTexto.', 'l.md').paso, true);
});

test('UNA LECCIÓN QUE MANDA A COMPILAR CON tsc NO PASA', async () => {
  const r0 = ruta();
  const cuerpo = Array.from({ length: 22 }, (_, i) => `Línea ${i} de explicación.`).join('\n');
  const plan = await planear('crear una lección', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: 'crear',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'tsc.md', contenido: `# Tema\n\n${cuerpo}\n\nCompila con \`tsc archivo.ts\`.\n\n\`\`\`ts\nconst x = 1;\n\`\`\`\n\n## Ejercicio\n\nHazlo tú.` },
      verificacion: { tipo: 'existe', archivo: 'tsc.md' },
    }],
  })));

  const r = ejecutar(r0, plan);
  assert.equal(r.parada, 'estándar no cumplido');
  assert.match(r.detalle, /tsc/);
});

test('una lección que usa node directamente sí pasa', async () => {
  const r0 = ruta();
  const cuerpo = Array.from({ length: 22 }, (_, i) => `Línea ${i} de explicación.`).join('\n');
  const plan = await planear('crear una lección', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{
      descripcion: 'crear',
      herramienta: 'escribir_archivo',
      argumentos: { ruta: 'node.md', contenido: `# Tema\n\n${cuerpo}\n\nEjecútalo con \`node --experimental-strip-types archivo.ts\`.\n\n\`\`\`ts\nconst x: number = 1;\n\`\`\`\n\n## Ejercicio\n\nHazlo tú con dos números.` },
      verificacion: { tipo: 'existe', archivo: 'node.md' },
    }],
  })));

  const r = ejecutar(r0, plan);
  assert.equal(r.parada, 'objetivo cumplido', r.detalle);
});
