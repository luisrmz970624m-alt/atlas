import { crearEmpresa } from '../empresa-simulator/empresa.ts';
import type { ConfigEmpresa, EstadoEmpresa } from '../empresa-simulator/tipos.ts';
import { observarEmpresa, procesarPropuesta, type BusinessDecisionProposal, type BusinessObservation, type BusinessPolicySegura } from './cerebro.ts';

export type EstadoCampana = 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'STOPPED';
export type EscenarioCampana = 'NORMAL' | 'CRECIMIENTO_RAPIDO' | 'CAIDA_DEMANDA' | 'CRISIS_CAJA' | 'AUMENTO_COSTES' | 'ROTURA_STOCK' | 'PROVEEDOR_RETRASADO' | 'CRECIMIENTO_ESTACIONAL';
export interface Decision { tipo: 'ComprarInventario' | 'ReservarInventario' | 'MantenerEstado'; productoId?: string; cantidad?: number; motivo: string; }
export interface BusinessPolicy extends BusinessPolicySegura {}

export class BaselineBusinessPolicy implements BusinessPolicy {
  readonly policyId = 'baseline-business'; readonly version = 'baseline-v1';
  propose(observation: BusinessObservation): BusinessDecisionProposal {
    const p = observation.inventory[0]; const buy = p && p.stockDisponible < p.stockMinimo;
    return { proposalId: `baseline:${observation.virtualTime}:${p?.id ?? 'hold'}`, policyId: this.policyId, policyVersion: this.version,
      action: buy ? 'BUY_INVENTORY' : 'HOLD', parameters: buy ? { productoId: p.id, cantidad: p.stockMinimo * 2 } : {},
      hypothesis: buy ? 'El stock disponible está bajo el mínimo.' : 'El estado está dentro de límites.', evidence: buy ? [`stock=${p.stockDisponible}`] : [], virtualTimestamp: observation.virtualTime };
  }
  explain(d: BusinessDecisionProposal): string { return d.hypothesis; }
}
export interface BusinessCampaign { campaignId: string; nombre: string; version: string; scenarioSet: EscenarioCampana[]; seedSet: number[]; policy: BusinessPolicy; duracionVirtual: number; configEmpresa: ConfigEmpresa; metricasObjetivo: string[]; createdAt: string; status: EstadoCampana; }
export interface BusinessRun { runId: string; campaignId: string; seed: number; scenario: EscenarioCampana; policyVersion: string; atlasVersion: string; startState: EstadoEmpresa; endState: EstadoEmpresa; decisions: Decision[]; events: string[]; metrics: Record<string, number | boolean>; status: EstadoCampana; error?: string; }
function decisionVisible(p: BusinessDecisionProposal): Decision { return p.action === 'BUY_INVENTORY' ? { tipo: 'ComprarInventario', productoId: String(p.parameters.productoId), cantidad: Number(p.parameters.cantidad), motivo: p.hypothesis } : p.action === 'RESERVE_INVENTORY' ? { tipo: 'ReservarInventario', productoId: String(p.parameters.productoId), cantidad: Number(p.parameters.cantidad), motivo: p.hypothesis } : { tipo: 'MantenerEstado', motivo: p.hypothesis }; }
export class BusinessCampaignRunner {
  private runs = new Map<string, BusinessRun>();
  ejecutar(c: BusinessCampaign): BusinessRun[] {
    if (c.status === 'COMPLETED') return this.resultados(c.campaignId);
    if (!['PENDING', 'PAUSED'].includes(c.status)) throw new Error('Campaña no ejecutable.'); c.status = 'RUNNING';
    for (const seed of c.seedSet) for (const scenario of c.scenarioSet) {
      const id = `${c.campaignId}:${seed}:${scenario}`; if (this.runs.has(id)) continue;
      try { const e = crearEmpresa({ ...c.configEmpresa, seed }); const inicio = e.estado(), decisiones: Decision[] = [];
        for (let dia = 0; dia < c.duracionVirtual; dia += 1) { const observation = observarEmpresa(e, scenario, `T${dia}`); const p = c.policy.propose(observation); if (p instanceof Promise) throw new Error('Una campaña requiere policy síncrona.'); decisiones.push(decisionVisible(p)); const valid = procesarPropuesta(e, p, observation); if (valid.result === 'REJECTED') throw new Error(valid.reasonCode); }
        const fin = e.estado(); this.runs.set(id, { runId: id, campaignId: c.campaignId, seed, scenario, policyVersion: c.policy.version, atlasVersion: '0.1.0', startState: inicio, endState: fin, decisions: decisiones, events: [], metrics: { ingresos: fin.ventas, costes: fin.costos, beneficio: fin.utilidad, caja: fin.caja, inventario: fin.inventarioValorizado, cuentasCobrar: fin.cuentasPorCobrar, cuentasPagar: fin.cuentasPorPagar, simulated: true }, status: 'COMPLETED' });
      } catch (error) { this.runs.set(id, { runId: id, campaignId: c.campaignId, seed, scenario, policyVersion: c.policy.version, atlasVersion: '0.1.0', startState: {} as EstadoEmpresa, endState: {} as EstadoEmpresa, decisions: [], events: [], metrics: { simulated: true }, status: 'FAILED', error: error instanceof Error ? error.message : 'fallo' }); }
    } c.status = 'COMPLETED'; return this.resultados(c.campaignId);
  }
  resultados(id: string): BusinessRun[] { return [...this.runs.values()].filter((r) => r.campaignId === id); }
  resultado(id: string) { const r = this.resultados(id), beneficios = r.map((x) => Number(x.metrics.beneficio ?? 0)); return { runs: r.length, completados: r.filter((x) => x.status === 'COMPLETED').length, fallidos: r.filter((x) => x.status === 'FAILED').length, beneficioMedio: beneficios.reduce((a, b) => a + b, 0) / (beneficios.length || 1), simulated: true }; }
}
export class BusinessExperiment { comparar(policies: BusinessPolicy[], base: Omit<BusinessCampaign, 'policy' | 'campaignId' | 'status' | 'createdAt'>) { return policies.map((policy, i) => { const c: BusinessCampaign = { ...base, campaignId: `exp-${i}`, policy, status: 'PENDING', createdAt: 'simulado' }; const runner = new BusinessCampaignRunner(); runner.ejecutar(c); return { policy: policy.version, result: runner.resultado(c.campaignId), holdout: false }; }); } }
export class CampaignController {
  private readonly runner: BusinessCampaignRunner;
  constructor(runner: BusinessCampaignRunner) { this.runner = runner; }
  pausar(c: BusinessCampaign): void { if (c.status !== 'RUNNING') throw new Error('Transición inválida.'); c.status = 'PAUSED'; }
  reanudar(c: BusinessCampaign): BusinessRun[] { if (c.status !== 'PAUSED') throw new Error('Transición inválida.'); c.status = 'PENDING'; return this.runner.ejecutar(c); }
  detener(c: BusinessCampaign): void { if (!['PENDING', 'RUNNING', 'PAUSED'].includes(c.status)) throw new Error('Transición inválida.'); c.status = 'STOPPED'; }
  progreso(c: BusinessCampaign) { const r = this.runner.resultados(c.campaignId), total = c.seedSet.length * c.scenarioSet.length; return { total, completed: r.filter((x) => x.status === 'COMPLETED').length, failed: r.filter((x) => x.status === 'FAILED').length, pending: Math.max(0, total - r.length), progress: Math.min(1, r.length / (total || 1)) }; }
  checkpoint(c: BusinessCampaign) { return structuredClone({ campaignId: c.campaignId, status: c.status, policyVersion: c.policy.version, runs: this.runner.resultados(c.campaignId) }); }
}
