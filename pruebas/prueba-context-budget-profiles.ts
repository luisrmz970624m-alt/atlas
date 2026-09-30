import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextBudgetPolicies } from '../src/trading-lab/context-budget-profiles.ts';

test('cbp: obtiene SMALL profile', () => {
  const cbp = new ContextBudgetPolicies();
  const perfil = cbp.obtenerPerfil('SMALL');

  assert.equal(perfil.profileType, 'SMALL');
  assert.equal(perfil.maxNodes, 10);
  assert.equal(perfil.maxDocuments, 20);
  assert.equal(perfil.maxChunks, 50);
  assert.equal(perfil.maxContextChars, 10000);
});

test('cbp: obtiene STANDARD profile', () => {
  const cbp = new ContextBudgetPolicies();
  const perfil = cbp.obtenerPerfil('STANDARD');

  assert.equal(perfil.profileType, 'STANDARD');
  assert.equal(perfil.maxNodes, 50);
  assert.equal(perfil.maxDocuments, 100);
  assert.equal(perfil.maxChunks, 200);
  assert.equal(perfil.maxContextChars, 50000);
});

test('cbp: obtiene RESEARCH profile', () => {
  const cbp = new ContextBudgetPolicies();
  const perfil = cbp.obtenerPerfil('RESEARCH');

  assert.equal(perfil.profileType, 'RESEARCH');
  assert.equal(perfil.maxNodes, 100);
  assert.equal(perfil.maxDocuments, 200);
  assert.equal(perfil.maxChunks, 500);
  assert.equal(perfil.maxContextChars, 100000);
});

test('cbp: lista todos los perfiles', () => {
  const cbp = new ContextBudgetPolicies();
  const perfiles = cbp.listarPerfil();

  assert.equal(perfiles.length, 3);
  const tipos = perfiles.map((p) => p.profileType);
  assert.ok(tipos.includes('SMALL'));
  assert.ok(tipos.includes('STANDARD'));
  assert.ok(tipos.includes('RESEARCH'));
});

test('cbp: SMALL < STANDARD < RESEARCH', () => {
  const cbp = new ContextBudgetPolicies();
  const small = cbp.obtenerPerfil('SMALL');
  const standard = cbp.obtenerPerfil('STANDARD');
  const research = cbp.obtenerPerfil('RESEARCH');

  assert.ok(small.maxNodes < standard.maxNodes);
  assert.ok(standard.maxNodes < research.maxNodes);
  assert.ok(small.maxContextChars < standard.maxContextChars);
  assert.ok(standard.maxContextChars < research.maxContextChars);
});
