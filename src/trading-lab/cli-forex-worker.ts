#!/usr/bin/env node
import { inicializarWorker, obtenerWorker, ForexWorker } from './forex-worker.ts';

async function main(): Promise<void> {
  const comando = process.argv[2] || 'lab';

  if (comando === 'lab') {
    // Modo: ejecutar el worker
    console.log('Atlas Forex Worker iniciando...');
    const worker = inicializarWorker(60_000); // 60 segundos entre ciclos
    worker.start();

    // Mostrar estado inicial
    const estado = worker.obtenerEstado();
    console.log(`Status: ${estado.status}`);
    console.log(`Datasource: ${estado.datasource}`);
    console.log(`Uptime: ${estado.uptimeSeconds}s`);

    // Graceful shutdown
    const apagar = (senal: string) => {
      console.log(`\n${senal} recibido: deteniendo Worker…`);
      worker.stop();
      worker.marcarOffline(); // Persiste OFFLINE antes de salir
      console.log('Worker detenido. Adiós.');
      process.exit(0);
    };

    process.on('SIGINT', () => apagar('SIGINT'));
    process.on('SIGTERM', () => apagar('SIGTERM'));

    // Log periódico de estado
    const logInterval = setInterval(() => {
      const est = worker.obtenerEstado();
      if (est.status === 'IDLE' || est.status === 'WAITING_DATA') {
        console.log(`[${new Date().toISOString()}] Status: ${est.status}, Experiments: ${est.totalExperiments}, LastClass: ${est.lastClassification}`);
      }
    }, 30_000);

    process.on('exit', () => clearInterval(logInterval));
  } else if (comando === 'status') {
    // Modo: mostrar estado (read-only)
    const { leerEstadoPersistido } = await import('./forex-worker.ts');
    const estadoPersistido = leerEstadoPersistido();

    if (!estadoPersistido) {
      console.log('Worker no está ejecutándose o nunca fue iniciado.');
      process.exit(1);
    }

    // Detectar si el estado está stale (último update hace más de 5 minutos)
    const ahora = Date.now();
    const actualizado = Date.parse(estadoPersistido.updatedAt);
    const esStale = ahora - actualizado > 5 * 60 * 1000; // 5 minutos

    // Obtener estado del scheduler para completar la información
    const { obtenerScheduler, inicializarScheduler } = await import('./forex-scheduler.ts');
    const scheduler = obtenerScheduler() || inicializarScheduler();
    const estadoScheduler = scheduler.obtenerEstado();

    console.log('\n=== FOREX WORKER STATUS ===\n');
    console.log(`Status:           ${estadoPersistido.status}${esStale ? ' (STALE)' : ''}`);
    console.log(`PID:              ${estadoPersistido.pid}`);
    console.log(`Datasource:       ${estadoPersistido.datasource}`);
    console.log(`Pair:             ${estadoPersistido.pair || 'N/A'}`);
    console.log(`Timeframe:        ${estadoPersistido.timeframe || 'N/A'}`);
    console.log(`Last Cycle:       ${estadoPersistido.lastCycle || 'Never'}`);
    console.log(`Next Cycle:       ${estadoPersistido.nextCycle || 'N/A'}`);
    console.log(`Current Run ID:   ${estadoPersistido.currentRunId || 'None'}`);
    console.log(`Last Classification: ${estadoPersistido.lastClassification || 'None'}`);
    console.log(`Started:          ${estadoPersistido.startedAt}`);
    console.log(`Updated:          ${estadoPersistido.updatedAt}${esStale ? ' ⚠ STALE' : ''}`);
    if (estadoPersistido.lastError) console.log(`Last Error:       ${estadoPersistido.lastError}`);

    console.log('\n=== FOREX SCHEDULER ===\n');
    console.log(`Market Window:       ${estadoScheduler.marketWindow}`);
    console.log(`Current UTC:         ${estadoScheduler.currentUtc}`);
    console.log(`Next Transition:     ${estadoScheduler.nextTransitionUtc || 'None'}`);
    console.log(`Realtime Tasks:      ${estadoScheduler.realtimeTasksAllowed ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Historical Tasks:    ${estadoScheduler.historicalTasksAllowed ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Holiday Calendar:    ${estadoScheduler.holidayCalendar}`);
    console.log('');
  } else {
    console.error(`Comando desconocido: ${comando}`);
    console.error('Uso: forex-worker [lab|status]');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Error fatal:', e);
  process.exit(1);
});
