import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEmpresa } from '../src/empresa-simulator/empresa.ts';
import { MemoriaEmpresarial } from '../src/empresa-simulator/memoria.ts';
import { BaselineBusinessPolicy } from '../src/business-lab/lab.ts';
import { BusinessAgentLoop, BusinessSupervisorAdapter, VorticeBusinessPolicy, observarEmpresa, validarPropuesta, type BusinessDecisionProposal } from '../src/business-lab/cerebro.ts';

const config = { seed: 7, nombre: 'Empresa Sintética', moneda: 'MXN', capitalInicial: 1000, empleados: 1, productos: [{ id: 'p', nombre: 'Producto', precio: 10, costo: 4, stockInicial: 1, stockMinimo: 2 }] };
function propuesta(action: string, parameters: Record<string, unknown> = {}): BusinessDecisionProposal { return { proposalId: `p-${action}`, policyId: 'test', policyVersion: '1', action, parameters, hypothesis: 'prueba local', evidence: ['sintética'], virtualTimestamp: 'T0' }; }

test('N: BusinessObservation es copia defensiva y no expone empresa mutable', () => {
  const empresa = crearEmpresa(config); const before = empresa.estado(); const o = observarEmpresa(empresa);
  assert.throws(() => (o.inventory as { stockFisico: number }[])[0]!.stockFisico = 999, TypeError);
  assert.deepEqual(empresa.estado(), before); assert.equal(o.inventory[0]!.stockDisponible, 1);
});
test('N: validador rechaza schema, acciones no disponibles, entidades y números inseguros sin mutar', () => {
  const empresa = crearEmpresa(config); const before = empresa.snapshot(), o = observarEmpresa(empresa);
  for (const p of [null, propuesta('BUY_INVENTORY', { productoId: 'no', cantidad: 1 }), propuesta('BUY_INVENTORY', { productoId: 'p', cantidad: -1 }), propuesta('BUY_INVENTORY', { productoId: 'p', cantidad: NaN }), propuesta('BUY_INVENTORY', { productoId: 'p', cantidad: Infinity }), propuesta('CHANGE_SUPPLIER', {})]) assert.equal(validarPropuesta(p, o).result, 'REJECTED');
  assert.deepEqual(empresa.snapshot(), before);
});
test('N: Supervisor central aprueba y regla empresarial puede rechazar sin mutación', () => {
  const empresa = crearEmpresa(config), o = observarEmpresa(empresa), p = propuesta('HOLD');
  assert.equal(new BusinessSupervisorAdapter().decidir(p, o).result, 'APPROVED');
  assert.equal(new BusinessSupervisorAdapter(() => false).decidir(p, o).reasonCode, 'SUPERVISOR_REJECTED');
  assert.equal(empresa.estado().caja, 1000);
});
test('N: Baseline y loop pasan por validación, supervisor, memoria y auditoría', async () => {
  const empresa = crearEmpresa(config), memoria = new MemoriaEmpresarial(':memory:'), loop = new BusinessAgentLoop(empresa, new BaselineBusinessPolicy(), memoria);
  const r = await loop.tick(); assert.equal(r.result, 'APPROVED'); assert.equal(empresa.inventario('p').stockFisico, 5); assert.equal(memoria.listar().length, 1); assert.equal(loop.audit.length, 1); assert.equal(loop.audit[0]!.supervisor, 'APPROVED'); memoria.cerrar();
});
test('N: rechazo y fallo de handler no dejan estado parcial; VALIDADA directa continúa bloqueada', async () => {
  const empresa = crearEmpresa(config), memoria = new MemoriaEmpresarial(':memory:'), before = empresa.snapshot();
  const mala = { policyId: 'maliciosa', version: '1', propose: () => propuesta('RELEASE_RESERVATION', { reservaId: 'ausente' }), explain: () => '' };
  const loop = new BusinessAgentLoop(empresa, mala, memoria); assert.equal((await loop.tick()).result, 'REJECTED'); assert.deepEqual(empresa.snapshot(), before);
  assert.throws(() => (memoria as unknown as { guardar: (x: unknown) => void }).guardar({ estado: 'VALIDADA' })); memoria.cerrar();
});
test('N: VorticeBusinessPolicy acepta Generador fake y rechaza JSON corrupto sin red', async () => {
  const empresa = crearEmpresa(config), o = observarEmpresa(empresa);
  const fake = async () => JSON.stringify(propuesta('HOLD')); const policy = new VorticeBusinessPolicy(fake); assert.equal((await policy.propose(o)).action, 'HOLD');
  const corrupta = new VorticeBusinessPolicy(async () => '{'); await assert.rejects(() => corrupta.propose(o), /GENERATOR_OUTPUT_INVALID/);
});
test('N: loop soporta pause, resume, stop y transiciones inválidas', async () => {
  const empresa = crearEmpresa(config), memoria = new MemoriaEmpresarial(':memory:');
  const lenta = { policyId: 'lenta', version: '1', propose: async () => propuesta('HOLD'), explain: () => '' };
  const loop = new BusinessAgentLoop(empresa, lenta, memoria); const tick = loop.tick(); loop.pause(); await tick; assert.equal(loop.status(), 'PAUSED'); loop.resume(); assert.equal((await loop.tick()).result, 'APPROVED'); loop.stop(); assert.equal(loop.status(), 'STOPPED'); assert.throws(() => loop.resume()); memoria.cerrar();
});
