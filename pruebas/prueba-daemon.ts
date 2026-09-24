import { test } from 'node:test';
import * as assert from 'node:assert';
import { existsSync, unlinkSync } from 'node:fs';
import Database from 'better-sqlite3';
import { OrquestadorV08, DIAS_RETENCION_HISTORICO, type EstadoAtlasV08 } from '../src/orquestador-v08.ts';
import { GestorEnergia } from '../src/energia.ts';
import { MotorMineria } from '../src/mineria.ts';

const DB_TEST = 'datos/daemon-test.db';
const ESTADO_TEST = 'datos/daemon-test-state.json';

function limpiar() {
  if (existsSync(DB_TEST)) unlinkSync(DB_TEST);
  if (existsSync(ESTADO_TEST)) unlinkSync(ESTADO_TEST);
}

/**
 * El envoltorio del intervalo llama a obtener_estado() para escribir el log,
 * y eso sale a la red y consulta SQLite. En las pruebas de temporización eso
 * mantendría el ciclo "en vuelo" durante segundos y falsearía los tiempos,
 * además de hacerlas depender de la red. Aquí se sustituye por un estado fijo.
 */
function estadoInstantaneo(orq: OrquestadorV08) {
  const vacio: EstadoAtlasV08 = {
    timestamp: new Date().toISOString(),
    nivel: 1,
    energia_hoy: 0,
    energia_disponible: 0,
    eth_generado_hoy: 0,
    dinero_ganado: 0,
    portafolio_usuario: { capital: 0, ganancia: 0, ganancia_porcentaje: 0, trades: 0, win_rate: 0 },
    portafolio_atlas: { capital: 0, ganancia: 0, ganancia_porcentaje: 0, trades_total: 0, bots_activos: 0, bots: [] },
    competencia: { lider: 'empate', diferencia: 0, usuario_ganancias_hoy: 0, atlas_ganancias_hoy: 0 },
  };
  orq.obtener_estado = async () => ({ ...vacio, timestamp: new Date().toISOString() });
}

/**
 * Corre el cuerpo garantizando que el orquestador quede detenido y cerrado
 * aunque un assert falle. Sin esto, un fallo deja vivo el setInterval y el
 * runner de pruebas se cuelga sin terminar nunca.
 */
async function conOrquestador(cuerpo: (orq: OrquestadorV08) => Promise<void>) {
  limpiar();
  const orq = new OrquestadorV08(DB_TEST, ESTADO_TEST);
  try {
    await cuerpo(orq);
  } finally {
    await orq.detener_y_esperar().catch(() => {});
    orq.cerrar();
    limpiar();
  }
}

test('daemon: no solapa ciclos si uno tarda más que el intervalo', async () => {
  await conOrquestador(async (orq) => {
    estadoInstantaneo(orq);

    let ciclos_iniciados = 0;
    let concurrentes = 0;
    let max_concurrentes = 0;

    orq.ejecutar_ciclo = async () => {
      ciclos_iniciados++;
      concurrentes++;
      max_concurrentes = Math.max(max_concurrentes, concurrentes);
      await new Promise((r) => setTimeout(r, 60));
      concurrentes--;
    };

    orq.iniciar_ejecucion(20);
    await new Promise((r) => setTimeout(r, 400));

    // >= 2 y no >= 1: con un solo ciclo, este test también pasaría si la
    // guarda se quedara trabada para siempre, que es el peor fallo posible.
    assert.ok(ciclos_iniciados >= 2, `solo se ejecutaron ${ciclos_iniciados} ciclo(s): la guarda podría estar trabada`);
    assert.equal(max_concurrentes, 1, `hubo ${max_concurrentes} ciclos en paralelo`);
  });
});

test('daemon: cuenta los turnos saltados por un ciclo atascado', async () => {
  await conOrquestador(async (orq) => {
    estadoInstantaneo(orq);

    let liberar: (() => void) | null = null;
    orq.ejecutar_ciclo = async () => {
      await new Promise<void>((r) => { liberar = r; });
    };

    orq.iniciar_ejecucion(20);
    await new Promise((r) => setTimeout(r, 150));

    // El ciclo sigue colgado: los turnos siguientes cuentan como saltos, que
    // es la señal que usa el vigilante de `correr` para reiniciar el servicio.
    assert.ok(orq.obtener_saltos_consecutivos() >= 2, `saltos: ${orq.obtener_saltos_consecutivos()}`);

    liberar!();
  });
});

test('daemon: el contador de saltos se reinicia cuando un ciclo vuelve a correr', async () => {
  await conOrquestador(async (orq) => {
    estadoInstantaneo(orq);

    let liberar: (() => void) | null = null;
    let lento = true;
    orq.ejecutar_ciclo = async () => {
      if (lento) await new Promise<void>((r) => { liberar = r; });
    };

    orq.iniciar_ejecucion(20);
    await new Promise((r) => setTimeout(r, 120));
    assert.ok(orq.obtener_saltos_consecutivos() >= 1);

    lento = false;
    liberar!();
    await new Promise((r) => setTimeout(r, 120));

    assert.equal(orq.obtener_saltos_consecutivos(), 0);
  });
});

test('daemon: detener_y_esperar aguarda el ciclo en vuelo antes de volver', async () => {
  await conOrquestador(async (orq) => {
    estadoInstantaneo(orq);

    let termino = false;
    orq.ejecutar_ciclo = async () => {
      await new Promise((r) => setTimeout(r, 200));
      termino = true;
    };

    orq.iniciar_ejecucion(20);
    await new Promise((r) => setTimeout(r, 50)); // deja arrancar un ciclo
    await orq.detener_y_esperar();

    // Si no esperara, aquí `termino` seguiría en false y cerrar() reventaría
    // la base de datos a mitad de escritura.
    assert.equal(termino, true);
  });
});

test('daemon: al apagar, el snapshot queda marcado como no activo', async () => {
  await conOrquestador(async (orq) => {
    orq.iniciar_ejecucion(60000);
    await orq.ejecutar_ciclo(); // guarda snapshot con ejecucion_activa=true

    assert.equal(orq.obtener_estado_persistido()!.ejecucion_activa, true);

    await orq.detener_y_esperar();

    assert.equal(orq.obtener_estado_persistido()!.ejecucion_activa, false);
  });
});

test('daemon: detener_y_esperar sin ejecución activa no falla', async () => {
  await conOrquestador(async (orq) => {
    await orq.detener_y_esperar();
  });
});

test('daemon: un error en un ciclo no detiene la ejecución periódica', async () => {
  await conOrquestador(async (orq) => {
    estadoInstantaneo(orq);

    let intentos = 0;
    orq.ejecutar_ciclo = async () => {
      intentos++;
      throw new Error('fallo simulado del ciclo');
    };

    orq.iniciar_ejecucion(20);
    await new Promise((r) => setTimeout(r, 150));

    // Varios intentos: el primer error no mató el intervalo.
    assert.ok(intentos >= 2, `solo hubo ${intentos} intento(s)`);
  });
});

test('daemon: sobrevive al cambio de día (crea la fila del día bajo demanda)', () => {
  limpiar();

  const energia = new GestorEnergia(DB_TEST);
  const mineria = new MotorMineria(DB_TEST);

  try {
    assert.ok(energia.obtener_estado_hoy());
    assert.ok(mineria.obtener_estado_hoy());

    // Se borra la fila de hoy para simular que el proceso cruzó la medianoche
    // y "hoy" es una fecha para la que nadie creó fila.
    const db = new Database(DB_TEST);
    db.prepare('DELETE FROM energia_estado').run();
    db.prepare('DELETE FROM mineria_estado').run();
    db.close();

    // Antes esto lanzaba "No hay estado de energía para hoy" en cada ciclo y
    // el daemon quedaba vivo pero sin trabajar, para siempre.
    assert.doesNotThrow(() => energia.obtener_estado_hoy());
    assert.doesNotThrow(() => mineria.obtener_estado_hoy());

    // Y el día nuevo arranca limpio.
    assert.equal(energia.obtener_estado_hoy().energia_usada, 0);
    assert.equal(mineria.obtener_estado_hoy().dificultad, 1.0);
  } finally {
    energia.cerrar();
    mineria.cerrar();
    limpiar();
  }
});

test('daemon: poda los históricos viejos y conserva los recientes', async () => {
  await conOrquestador(async (orq) => {
    await orq.ejecutar_ciclo();

    const db = new Database(DB_TEST);
    const viejo = new Date(Date.now() - (DIAS_RETENCION_HISTORICO + 5) * 86400000).toISOString();
    db.prepare(`
      INSERT INTO competencia_snapshots
      (id, timestamp, usuario_capital, usuario_ganancia, usuario_porcentaje, usuario_trades, usuario_win_rate,
       atlas_capital, atlas_ganancia, atlas_porcentaje, atlas_trades, atlas_bots_activos, atlas_win_rate, lider)
      VALUES ('viejo-1', ?, 0,0,0,0,0,0,0,0,0,0,0,'empate')
    `).run(viejo);
    db.close();

    await orq.ejecutar_ciclo();

    const db2 = new Database(DB_TEST);
    const quedan = db2.prepare("SELECT COUNT(*) as n FROM competencia_snapshots WHERE id = 'viejo-1'").get() as any;
    const recientes = db2.prepare('SELECT COUNT(*) as n FROM competencia_snapshots').get() as any;
    db2.close();

    assert.equal(quedan.n, 0, 'el snapshot viejo debió podarse');
    assert.ok(recientes.n > 0, 'los snapshots recientes deben conservarse');
  });
});
