/** Cerebro empresarial local: propuestas declarativas, supervisadas y simuladas. */
import { evaluar } from '../supervisor.ts';
import { sanearRegistro } from '../registro.ts';
import type { Generador } from '../modelo.ts';
import type { EmpresaSimulada } from '../empresa-simulator/empresa.ts';
import { MemoriaEmpresarial } from '../empresa-simulator/memoria.ts';

export type AccionEmpresarial = 'BUY_INVENTORY' | 'RESERVE_INVENTORY' | 'RELEASE_RESERVATION' | 'HOLD'
  | 'CHANGE_SUPPLIER' | 'RAISE_PRICE' | 'LOWER_PRICE' | 'CREATE_PROMOTION' | 'HIRE_EMPLOYEE' | 'REDUCE_EXPENSES' | 'PAY_SIMULATED_INVOICE';
export type AccionDisponible = Extract<AccionEmpresarial, 'BUY_INVENTORY' | 'RESERVE_INVENTORY' | 'RELEASE_RESERVATION' | 'HOLD'>;
export type ResultadoDecision = 'APPROVED' | 'REJECTED';
export type EstadoAgent = 'PENDING' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'COMPLETED' | 'FAILED';

export interface InventarioObservado { id: string; stockFisico: number; stockReservado: number; stockDisponible: number; stockMinimo: number; }
export interface BusinessObservation {
  readonly virtualTime: string;
  readonly scenario: string;
  readonly cash: number;
  readonly revenue: number;
  readonly expenses: number;
  readonly profit: number;
  readonly inventory: readonly InventarioObservado[];
  readonly suppliers: readonly string[];
  readonly employees: number;
  readonly accountsReceivable: number;
  readonly accountsPayable: number;
  readonly alerts: readonly string[];
  readonly recentEvents: readonly string[];
  readonly metrics: Readonly<Record<string, number>>;
}
export interface BusinessDecisionProposal {
  proposalId: string;
  policyId: string;
  policyVersion: string;
  action: AccionEmpresarial | string;
  parameters: Record<string, unknown>;
  hypothesis: string;
  evidence: string[];
  virtualTimestamp: string;
}
export interface ResultadoSupervisor { result: ResultadoDecision; reasonCode: string; safeExplanation: string; }
export interface EventoAuditoriaBusiness { proposalId: string; policyId: string; action: string; validator: ResultadoDecision; supervisor: ResultadoDecision; execution: ResultadoDecision; virtualTimestamp: string; }
export interface BusinessPolicySegura { policyId: string; version: string; propose(observation: BusinessObservation): BusinessDecisionProposal | Promise<BusinessDecisionProposal>; explain(proposal: BusinessDecisionProposal): string; }

function congelar<T>(value: T): T { if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) congelar(child); } return value; }
export function observarEmpresa(empresa: EmpresaSimulada, scenario = 'NORMAL', virtualTime = 'T0'): BusinessObservation {
  const estado = empresa.estado();
  const inventory = [...empresa.productos.values()].map((p) => ({ id: p.id, ...empresa.inventario(p.id), stockMinimo: p.stockMinimo }));
  return congelar({ virtualTime, scenario, cash: estado.caja, revenue: estado.ventas, expenses: estado.costos + estado.gastosNomina,
    profit: estado.utilidad, inventory, suppliers: empresa.proveedores.map((p) => p.id), employees: empresa.empleados.length,
    accountsReceivable: estado.cuentasPorCobrar, accountsPayable: estado.cuentasPorPagar, alerts: [], recentEvents: [],
    metrics: { caja: estado.caja, ventas: estado.ventas, costos: estado.costos, utilidad: estado.utilidad, inventario: estado.inventarioValorizado } });
}
function esTexto(v: unknown): v is string { return typeof v === 'string' && v.trim().length > 0; }
function cantidad(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v) && v > 0 && Number.isInteger(v) && v <= 1_000_000; }
export function validarPropuesta(proposal: unknown, observation: BusinessObservation): ResultadoSupervisor {
  if (!proposal || typeof proposal !== 'object') return { result: 'REJECTED', reasonCode: 'INVALID_PROPOSAL', safeExplanation: 'La propuesta no tiene estructura válida.' };
  const p = proposal as Partial<BusinessDecisionProposal>;
  if (!esTexto(p.proposalId) || !esTexto(p.policyId) || !esTexto(p.policyVersion) || !esTexto(p.hypothesis) || !Array.isArray(p.evidence) || !esTexto(p.virtualTimestamp) || !p.parameters || typeof p.parameters !== 'object') return { result: 'REJECTED', reasonCode: 'INVALID_PROPOSAL', safeExplanation: 'Faltan campos obligatorios seguros.' };
  if (!['BUY_INVENTORY', 'RESERVE_INVENTORY', 'RELEASE_RESERVATION', 'HOLD'].includes(String(p.action))) return { result: 'REJECTED', reasonCode: 'UNAVAILABLE', safeExplanation: 'La acción no está disponible en el simulador.' };
  if (p.action === 'HOLD') return { result: 'APPROVED', reasonCode: 'VALID', safeExplanation: 'Propuesta válida sin mutación.' };
  const params = p.parameters as Record<string, unknown>;
  if (p.action === 'RELEASE_RESERVATION') return esTexto(params.reservaId) ? { result: 'APPROVED', reasonCode: 'VALID', safeExplanation: 'Liberación válida.' } : { result: 'REJECTED', reasonCode: 'INVALID_PARAMETERS', safeExplanation: 'Falta el identificador de reserva.' };
  if (!esTexto(params.productoId) || !cantidad(params.cantidad)) return { result: 'REJECTED', reasonCode: 'INVALID_PARAMETERS', safeExplanation: 'Producto o cantidad inválidos.' };
  const producto = observation.inventory.find((i) => i.id === params.productoId);
  if (!producto) return { result: 'REJECTED', reasonCode: 'UNKNOWN_ENTITY', safeExplanation: 'El producto no existe.' };
  if (p.action === 'RESERVE_INVENTORY' && Number(params.cantidad) > producto.stockDisponible) return { result: 'REJECTED', reasonCode: 'INVALID_PARAMETERS', safeExplanation: 'No hay stock disponible suficiente.' };
  return { result: 'APPROVED', reasonCode: 'VALID', safeExplanation: 'Propuesta válida.' };
}
export class BusinessSupervisorAdapter {
  private readonly reglaAdicional: (proposal: BusinessDecisionProposal, observation: BusinessObservation) => boolean;
  constructor(reglaAdicional: (proposal: BusinessDecisionProposal, observation: BusinessObservation) => boolean = () => true) { this.reglaAdicional = reglaAdicional; }
  decidir(proposal: BusinessDecisionProposal, observation: BusinessObservation): ResultadoSupervisor {
    const base = evaluar(`business simulation ${proposal.action}`);
    if (!base.permitido) return { result: 'REJECTED', reasonCode: 'SUPERVISOR_REJECTED', safeExplanation: base.motivo };
    if (!this.reglaAdicional(proposal, observation)) return { result: 'REJECTED', reasonCode: 'SUPERVISOR_REJECTED', safeExplanation: 'La regla empresarial rechaza la propuesta.' };
    return { result: 'APPROVED', reasonCode: 'SUPERVISOR_APPROVED', safeExplanation: base.motivo };
  }
}
/** Única frontera pública para aplicar una propuesta a la empresa simulada. */
export function procesarPropuesta(empresa: EmpresaSimulada, proposal: BusinessDecisionProposal, observation: BusinessObservation, supervisor = new BusinessSupervisorAdapter()): ResultadoSupervisor {
  const validacion = validarPropuesta(proposal, observation);
  if (validacion.result === 'REJECTED') return validacion;
  const decision = supervisor.decidir(proposal, observation);
  return decision.result === 'REJECTED' ? decision : ejecutarPropuesta(empresa, proposal);
}
function ejecutarPropuesta(empresa: EmpresaSimulada, proposal: BusinessDecisionProposal): ResultadoSupervisor {
  try {
    const p = proposal.parameters;
    if (proposal.action === 'HOLD') return { result: 'APPROVED', reasonCode: 'EXECUTED_HOLD', safeExplanation: 'Se mantuvo el estado.' };
    if (proposal.action === 'BUY_INVENTORY') empresa.comprar(String(p.productoId), Number(p.cantidad), undefined, true, `agent:${proposal.proposalId}`);
    else if (proposal.action === 'RESERVE_INVENTORY') empresa.reservarStock(String(p.productoId), Number(p.cantidad), `agent:${proposal.proposalId}`);
    else if (proposal.action === 'RELEASE_RESERVATION') empresa.liberarReserva(String(p.reservaId), `agent:${proposal.proposalId}`);
    else return { result: 'REJECTED', reasonCode: 'UNAVAILABLE', safeExplanation: 'No hay handler disponible.' };
    return { result: 'APPROVED', reasonCode: 'EXECUTED', safeExplanation: 'Acción simulada ejecutada.' };
  } catch { return { result: 'REJECTED', reasonCode: 'EXECUTION_FAILED', safeExplanation: 'La acción no pudo ejecutarse sin cambiar el estado válido.' }; }
}
export class VorticeBusinessPolicy implements BusinessPolicySegura {
  readonly policyId = 'vortice-business'; readonly version = 'v1';
  private readonly generador: Generador;
  constructor(generador: Generador) { this.generador = generador; }
  async propose(observation: BusinessObservation): Promise<BusinessDecisionProposal> {
    const raw = await this.generador('Devuelve solamente JSON de una propuesta empresarial declarativa.', JSON.stringify({ inventory: observation.inventory, cash: observation.cash, scenario: observation.scenario }));
    try { return JSON.parse(raw) as BusinessDecisionProposal; } catch { throw new Error('GENERATOR_OUTPUT_INVALID'); }
  }
  explain(proposal: BusinessDecisionProposal): string { return proposal.hypothesis; }
}
export class BusinessAgentLoop {
  private state: EstadoAgent = 'PENDING'; private sequence = 0; readonly audit: EventoAuditoriaBusiness[] = [];
  private readonly empresa: EmpresaSimulada; private readonly policy: BusinessPolicySegura; private readonly memoria: MemoriaEmpresarial; private readonly supervisor: BusinessSupervisorAdapter; private readonly scenario: string;
  constructor(empresa: EmpresaSimulada, policy: BusinessPolicySegura, memoria: MemoriaEmpresarial, supervisor = new BusinessSupervisorAdapter(), scenario = 'NORMAL') { this.empresa = empresa; this.policy = policy; this.memoria = memoria; this.supervisor = supervisor; this.scenario = scenario; }
  status(): EstadoAgent { return this.state; }
  pause(): void { if (this.state !== 'RUNNING') throw new Error('Transición inválida.'); this.state = 'PAUSED'; }
  resume(): void { if (this.state !== 'PAUSED') throw new Error('Transición inválida.'); this.state = 'RUNNING'; }
  stop(): void { if (!['PENDING', 'RUNNING', 'PAUSED'].includes(this.state)) throw new Error('Transición inválida.'); this.state = 'STOPPED'; }
  async tick(): Promise<ResultadoSupervisor> {
    if (this.state === 'PENDING') this.state = 'RUNNING';
    if (this.state !== 'RUNNING') throw new Error('El loop no está ejecutable.');
    const before = observarEmpresa(this.empresa, this.scenario, `T${this.sequence}`); let proposal: BusinessDecisionProposal;
    try { proposal = await this.policy.propose(before); } catch { return this.registrarRechazo(before, { proposalId: `failed-${this.sequence}`, policyId: this.policy.policyId, policyVersion: this.policy.version, action: 'HOLD', parameters: {}, hypothesis: 'Salida no válida.', evidence: [], virtualTimestamp: before.virtualTime }, 'GENERATOR_OUTPUT_INVALID'); }
    const validacion = validarPropuesta(proposal, before);
    if (validacion.result === 'REJECTED') return this.registrarRechazo(before, proposal, validacion.reasonCode);
    const decision = this.supervisor.decidir(proposal, before);
    if (decision.result === 'REJECTED') return this.registrarRechazo(before, proposal, decision.reasonCode);
    const execution = ejecutarPropuesta(this.empresa, proposal); const after = observarEmpresa(this.empresa, this.scenario, `T${this.sequence}`);
    this.guardar(before, after, proposal, execution, execution.result === 'REJECTED' ? [execution.reasonCode] : []);
    this.auditar({ proposalId: proposal.proposalId, policyId: proposal.policyId, action: proposal.action, validator: 'APPROVED', supervisor: decision.result, execution: execution.result, virtualTimestamp: before.virtualTime }); this.sequence += 1;
    return execution;
  }
  async runTicks(n: number): Promise<ResultadoSupervisor[]> { if (!Number.isInteger(n) || n < 0) throw new Error('Ticks inválidos.'); const out: ResultadoSupervisor[] = []; for (let i = 0; i < n && this.state !== 'STOPPED'; i += 1) out.push(await this.tick()); this.state = this.state === 'RUNNING' ? 'COMPLETED' : this.state; return out; }
  private registrarRechazo(before: BusinessObservation, proposal: BusinessDecisionProposal, reason: string): ResultadoSupervisor { const result = { result: 'REJECTED' as const, reasonCode: reason, safeExplanation: 'La propuesta fue rechazada de forma segura.' }; this.guardar(before, before, proposal, result, [reason]); this.auditar({ proposalId: proposal.proposalId, policyId: proposal.policyId, action: String(proposal.action), validator: 'REJECTED', supervisor: 'REJECTED', execution: 'REJECTED', virtualTimestamp: before.virtualTime }); this.sequence += 1; return result; }
  private auditar(evento: EventoAuditoriaBusiness): void { this.audit.push(sanearRegistro(evento) as EventoAuditoriaBusiness); }
  private guardar(before: BusinessObservation, after: BusinessObservation, proposal: BusinessDecisionProposal, result: ResultadoSupervisor, reglasRotas: string[]): void { this.memoria.observar({ escenario: this.scenario, seed: 0, contexto: JSON.stringify({ cash: before.cash, inventory: before.inventory.length }), hipotesis: proposal.hypothesis, decision: proposal.action, metricasAntes: { caja: before.cash, utilidad: before.profit }, metricasDespues: { caja: after.cash, utilidad: after.profit }, resultadoFinanciero: after.profit - before.profit, reglasCumplidas: reglasRotas.length ? [] : ['SUPERVISOR'], reglasRotas, eventosExternos: [], evidencia: JSON.stringify({ proposalId: proposal.proposalId, result: result.reasonCode }), evaluacion: result.safeExplanation, confianza: reglasRotas.length ? 0 : .5 }); }
}
