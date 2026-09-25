export type DominioSimulacion = 'trading' | 'empresa';
export type EstadoSimulacion = 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'STOPPED';
export type PrioridadSimulacion = 'LOW' | 'NORMAL' | 'HIGH';
export type PerfilSimulacion = 'INTERACTIVE' | 'NIGHT';

export interface ResultadoSimulacion { [metrica: string]: number | string | boolean; }
export interface SnapshotWorker {
  id: string; tipo: string; dominio: DominioSimulacion; estado: EstadoSimulacion;
  prioridad: PrioridadSimulacion; seed: number; version: string; config: Record<string, unknown>;
  createdAt: string; startedAt?: string; completedAt?: string; progress: number;
  metrics: ResultadoSimulacion; error?: string;
}
export interface EventoSimulacion { tipo: `simulation.${string}`; worker: SnapshotWorker; timestamp: string; }
export interface LimitesSimulacion { maxConcurrentWorkers: number; maxTradingWorkers: number; maxBusinessWorkers: number; }
export class ErrorTransicionSimulacion extends Error {}

const peso: Record<PrioridadSimulacion, number> = { HIGH: 3, NORMAL: 2, LOW: 1 };
const ahora = () => new Date().toISOString();
const clonar = <T>(valor: T): T => structuredClone(valor);

export class SimulationWorker {
  private datos: SnapshotWorker;
  private ejecutar: () => Promise<ResultadoSimulacion>;
  constructor(datos: Omit<SnapshotWorker, 'estado' | 'createdAt' | 'progress' | 'metrics'>, ejecutar: () => Promise<ResultadoSimulacion>) {
    this.datos = { ...clonar(datos), estado: 'PENDING', createdAt: ahora(), progress: 0, metrics: {} };
    this.ejecutar = ejecutar;
  }
  estado(): SnapshotWorker { return clonar(this.datos); }
  iniciar(): void { if (this.datos.estado !== 'PENDING') throw new ErrorTransicionSimulacion('Solo un worker pendiente puede iniciar.'); this.datos.estado = 'RUNNING'; this.datos.startedAt = ahora(); }
  pausar(): void { if (this.datos.estado !== 'RUNNING') throw new ErrorTransicionSimulacion('Solo un worker activo puede pausarse.'); this.datos.estado = 'PAUSED'; }
  reanudar(): void { if (this.datos.estado !== 'PAUSED') throw new ErrorTransicionSimulacion('Solo un worker pausado puede reanudarse.'); this.datos.estado = 'RUNNING'; }
  detener(): void { if (!['PENDING', 'RUNNING', 'PAUSED'].includes(this.datos.estado)) throw new ErrorTransicionSimulacion('El worker terminado no puede detenerse.'); this.datos.estado = 'STOPPED'; this.datos.completedAt = ahora(); }
  progreso(valor: number): void { if (this.datos.estado !== 'RUNNING' || !Number.isFinite(valor) || valor < this.datos.progress || valor > 100) throw new ErrorTransicionSimulacion('Progreso inválido.'); this.datos.progress = valor; }
  async correr(): Promise<void> {
    if (this.datos.estado !== 'RUNNING') return;
    try { this.datos.metrics = clonar(await this.ejecutar()); if (this.datos.estado === 'RUNNING') { this.datos.progress = 100; this.datos.estado = 'COMPLETED'; this.datos.completedAt = ahora(); } }
    catch (error) { if (this.datos.estado === 'RUNNING') { this.datos.error = error instanceof Error ? error.message : 'Fallo desconocido'; this.datos.estado = 'FAILED'; this.datos.completedAt = ahora(); } }
  }
}

export class TradingSimulationWorker extends SimulationWorker {
  constructor(datos: Omit<SnapshotWorker, 'estado' | 'createdAt' | 'progress' | 'metrics' | 'dominio'>, ejecutar: () => Promise<ResultadoSimulacion>) { super({ ...datos, dominio: 'trading', config: clonar(datos.config) }, ejecutar); }
}
export class BusinessSimulationWorker extends SimulationWorker {
  constructor(datos: Omit<SnapshotWorker, 'estado' | 'createdAt' | 'progress' | 'metrics' | 'dominio'>, ejecutar: () => Promise<ResultadoSimulacion>) { super({ ...datos, dominio: 'empresa', config: clonar(datos.config) }, ejecutar); }
}

export class SimulationScheduler {
  private workers = new Map<string, SimulationWorker>(); private eventos: EventoSimulacion[] = []; private oyentes: ((e: EventoSimulacion) => void)[] = [];
  readonly limites: LimitesSimulacion; readonly perfil: PerfilSimulacion; readonly seguridadTrading = Object.freeze({ TRADING_MODE: 'DEMO_ONLY', REAL_TRADING: false });
  constructor(limites: LimitesSimulacion, perfil: PerfilSimulacion = 'INTERACTIVE') {
    if (Object.values(limites).some((n) => !Number.isInteger(n) || n < 1)) throw new Error('Límites de simulación inválidos.');
    this.limites = { ...limites }; this.perfil = perfil;
  }
  suscribir(oyente: (e: EventoSimulacion) => void): () => void { this.oyentes.push(oyente); return () => { this.oyentes = this.oyentes.filter((x) => x !== oyente); }; }
  private emitir(tipo: EventoSimulacion['tipo'], worker: SimulationWorker): void { const evento = { tipo, worker: worker.estado(), timestamp: ahora() } as EventoSimulacion; this.eventos.push(evento); this.oyentes.forEach((o) => o(evento)); }
  encolar(worker: SimulationWorker): void { const s = worker.estado(); if (this.workers.has(s.id)) throw new Error('simulationId duplicado.'); this.workers.set(s.id, worker); this.emitir('simulation.queued', worker); }
  obtener(id: string): SnapshotWorker | null { return this.workers.get(id)?.estado() ?? null; }
  lista(): SnapshotWorker[] { return [...this.workers.values()].map((w) => w.estado()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  private enEjecucion(dominio?: DominioSimulacion): number { return this.lista().filter((w) => w.estado === 'RUNNING' && (!dominio || w.dominio === dominio)).length; }
  private capacidad(worker: SimulationWorker): boolean { const s = worker.estado(); return this.enEjecucion() < this.limites.maxConcurrentWorkers && this.enEjecucion(s.dominio) < (s.dominio === 'trading' ? this.limites.maxTradingWorkers : this.limites.maxBusinessWorkers); }
  async ejecutarPendientes(): Promise<void> {
    const pendientes = [...this.workers.values()].filter((w) => w.estado().estado === 'PENDING').sort((a, b) => peso[b.estado().prioridad] - peso[a.estado().prioridad]);
    const activos: Promise<void>[] = [];
    for (const worker of pendientes) { if (!this.capacidad(worker)) continue; worker.iniciar(); this.emitir('simulation.started', worker); activos.push(worker.correr().then(() => { const estado = worker.estado().estado; if (estado === 'FAILED') this.emitir('simulation.failed', worker); else if (estado === 'COMPLETED') this.emitir('simulation.completed', worker); })); }
    await Promise.all(activos);
  }
  pausar(id: string): void { const w = this.worker(id); w.pausar(); this.emitir('simulation.paused', w); }
  reanudar(id: string): void { const w = this.worker(id); w.reanudar(); this.emitir('simulation.resumed', w); }
  detener(id: string): void { const w = this.worker(id); w.detener(); this.emitir('simulation.stopped', w); }
  actualizarProgreso(id: string, valor: number): void { const w = this.worker(id); w.progreso(valor); this.emitir('simulation.progress', w); }
  private worker(id: string): SimulationWorker { const w = this.workers.get(id); if (!w) throw new Error('Worker inexistente.'); return w; }
  resumen(): { totalWorkers: number; running: number; paused: number; completed: number; failed: number; trading: number; empresa: number } { const todos = this.lista(); return { totalWorkers: todos.length, running: todos.filter((w) => w.estado === 'RUNNING').length, paused: todos.filter((w) => w.estado === 'PAUSED').length, completed: todos.filter((w) => w.estado === 'COMPLETED').length, failed: todos.filter((w) => w.estado === 'FAILED').length, trading: todos.filter((w) => w.dominio === 'trading').length, empresa: todos.filter((w) => w.dominio === 'empresa').length }; }
  historialEventos(): EventoSimulacion[] { return clonar(this.eventos); }
}
