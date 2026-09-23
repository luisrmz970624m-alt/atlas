import { test } from 'node:test';
import { strictEqual, ok } from 'node:assert';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { respaldarDB, limpiarRespaldosViejos, respaldarTodo, listarRespaldos } from '../src/respaldo.ts';

const DB_TEST = 'datos/test-respaldo.db';
const CARPETA_TEST = 'datos/test-respaldos';

function crearDBDePrueba() {
  rmSync(DB_TEST, { force: true });
  const db = new Database(DB_TEST);
  db.exec('CREATE TABLE ejemplo (id INTEGER PRIMARY KEY, valor TEXT)');
  db.prepare('INSERT INTO ejemplo (valor) VALUES (?)').run('dato de prueba');
  db.close();
}

test('respaldo: crea un archivo de respaldo válido', async () => {
  crearDBDePrueba();
  rmSync(CARPETA_TEST, { recursive: true, force: true });

  const resultado = await respaldarDB(DB_TEST, CARPETA_TEST);

  ok(existsSync(resultado.destino));
  ok(resultado.tamano_bytes > 0);
  strictEqual(resultado.origen, DB_TEST);

  // Verificar que el respaldo tiene los datos reales
  const db = new Database(resultado.destino, { readonly: true });
  const fila = db.prepare('SELECT valor FROM ejemplo').get() as any;
  strictEqual(fila.valor, 'dato de prueba');
  db.close();

  rmSync(CARPETA_TEST, { recursive: true, force: true });
});

test('respaldo: falla si la base de datos origen no existe', async () => {
  await respaldarDB('datos/no-existe-esto.db', CARPETA_TEST)
    .then(() => { throw new Error('Debería haber fallado'); })
    .catch((e) => { ok(e.message.includes('No existe')); });
});

test('respaldo: limpia respaldos viejos manteniendo la retención', async () => {
  crearDBDePrueba();
  rmSync(CARPETA_TEST, { recursive: true, force: true });
  mkdirSync(CARPETA_TEST, { recursive: true });

  // Crear 5 respaldos con timestamps distintos
  for (let i = 0; i < 5; i++) {
    await respaldarDB(DB_TEST, CARPETA_TEST);
    await new Promise((r) => setTimeout(r, 10));
  }

  const eliminados = limpiarRespaldosViejos(DB_TEST, CARPETA_TEST, 2);
  const restantes = listarRespaldos(CARPETA_TEST);

  strictEqual(eliminados.length, 3);
  strictEqual(restantes.length, 2);

  rmSync(CARPETA_TEST, { recursive: true, force: true });
});

test('respaldo: respaldarTodo procesa múltiples bases y omite las inexistentes', async () => {
  crearDBDePrueba();
  rmSync(CARPETA_TEST, { recursive: true, force: true });

  const { respaldos } = await respaldarTodo([DB_TEST, 'datos/no-existe.db'], CARPETA_TEST);

  strictEqual(respaldos.length, 1);

  rmSync(CARPETA_TEST, { recursive: true, force: true });
});

test('respaldo: listarRespaldos devuelve vacío si no hay carpeta', () => {
  rmSync(CARPETA_TEST, { recursive: true, force: true });

  const lista = listarRespaldos(CARPETA_TEST);

  strictEqual(lista.length, 0);
});
