import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { unlinkSync, existsSync, writeFileSync } from 'node:fs';
import { guardarEstado, cargarEstado } from '../src/persistencia.ts';
import type { EstadoAtlasV08 } from '../src/orquestador-v08.ts';

const RUTA_TEST = 'datos/test-atlas-state.json';

function estadoDeEjemplo(): EstadoAtlasV08 {
  return {
    timestamp: new Date().toISOString(),
    nivel: 3,
    energia_hoy: 70,
    energia_disponible: 70,
    eth_generado_hoy: 0.001,
    dinero_ganado: 50,
    portafolio_usuario: { capital: 10000, ganancia: 100, ganancia_porcentaje: 1, trades: 2, win_rate: 50 },
    portafolio_atlas: { capital: 9500, ganancia: 80, ganancia_porcentaje: 0.8, trades_total: 5, bots_activos: 2, bots: [] },
    competencia: { lider: 'usuario', diferencia: 20, usuario_ganancias_hoy: 100, atlas_ganancias_hoy: 80 },
  };
}

test('persistencia: guardar y cargar estado', () => {
  if (existsSync(RUTA_TEST)) unlinkSync(RUTA_TEST);

  const estado = estadoDeEjemplo();
  guardarEstado(estado, true, 5, RUTA_TEST);

  const cargado = cargarEstado(RUTA_TEST);

  strictEqual(cargado !== null, true);
  strictEqual(cargado!.ejecucion_activa, true);
  strictEqual(cargado!.ciclos_ejecutados, 5);
  strictEqual(cargado!.estado.nivel, 3);
  strictEqual(typeof cargado!.ultima_actualizacion, 'string');

  unlinkSync(RUTA_TEST);
});

test('persistencia: cargar sin archivo devuelve null', () => {
  if (existsSync(RUTA_TEST)) unlinkSync(RUTA_TEST);

  const cargado = cargarEstado(RUTA_TEST);

  strictEqual(cargado, null);
});

test('persistencia: cargar archivo corrupto devuelve null', () => {
  writeFileSync(RUTA_TEST, '{ esto no es json valido ][', 'utf8');

  const cargado = cargarEstado(RUTA_TEST);

  strictEqual(cargado, null);

  unlinkSync(RUTA_TEST);
});

test('persistencia: guardar sobrescribe estado anterior', () => {
  if (existsSync(RUTA_TEST)) unlinkSync(RUTA_TEST);

  guardarEstado(estadoDeEjemplo(), false, 1, RUTA_TEST);
  guardarEstado(estadoDeEjemplo(), true, 2, RUTA_TEST);

  const cargado = cargarEstado(RUTA_TEST);

  strictEqual(cargado!.ciclos_ejecutados, 2);
  strictEqual(cargado!.ejecucion_activa, true);

  unlinkSync(RUTA_TEST);
});
