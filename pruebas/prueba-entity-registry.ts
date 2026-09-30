import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import {
  EntityRegistry,
  inicializarER,
  obtenerER,
  asignarER,
  type Entity,
} from '../src/trading-lab/entity-registry.ts';

test('entity-registry: registra entidad nueva', () => {
  const ruta = join(tmpdir(), `er-reg-${Date.now()}.json`);
  const er = new EntityRegistry(ruta);

  const entity = er.registrarEntidad({
    canonicalName: 'Federal Reserve',
    aliases: ['Fed', 'Federal Reserve System'],
    entityType: 'CENTRAL_BANK',
    domain: 'TRADING',
    source: 'knowledge-base',
  });

  assert.equal(entity.canonicalName, 'Federal Reserve');
  assert.equal(entity.entityType, 'CENTRAL_BANK');
  assert.equal(entity.aliases.length, 2);
  assert.equal(entity.status, 'ACTIVE');

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('entity-registry: obtiene por nombre', () => {
  const ruta = join(tmpdir(), `er-get-${Date.now()}.json`);
  const er = new EntityRegistry(ruta);

  er.registrarEntidad({
    canonicalName: 'EURUSD',
    aliases: ['EUR/USD'],
    entityType: 'INSTRUMENT',
    source: 'knowledge-base',
  });

  const entity = er.obtenerPorNombre('EURUSD');
  assert.ok(entity);
  assert.equal(entity!.canonicalName, 'EURUSD');

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('entity-registry: obtiene por alias', () => {
  const ruta = join(tmpdir(), `er-alias-${Date.now()}.json`);
  const er = new EntityRegistry(ruta);

  er.registrarEntidad({
    canonicalName: 'Federal Reserve',
    aliases: ['Fed'],
    entityType: 'CENTRAL_BANK',
    source: 'knowledge-base',
  });

  const entity = er.obtenerPorNombre('Fed');
  assert.ok(entity);
  assert.equal(entity!.canonicalName, 'Federal Reserve');

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('entity-registry: obtiene por tipo', () => {
  const ruta = join(tmpdir(), `er-type-${Date.now()}.json`);
  const er = new EntityRegistry(ruta);

  er.registrarEntidad({
    canonicalName: 'EURUSD',
    entityType: 'INSTRUMENT',
    source: 'kb',
  });

  er.registrarEntidad({
    canonicalName: 'GBPUSD',
    entityType: 'INSTRUMENT',
    source: 'kb',
  });

  er.registrarEntidad({
    canonicalName: 'Federal Reserve',
    entityType: 'CENTRAL_BANK',
    source: 'kb',
  });

  const instrumentos = er.obtenerPorTipo('INSTRUMENT');
  assert.equal(instrumentos.length, 2);

  const bancos = er.obtenerPorTipo('CENTRAL_BANK');
  assert.equal(bancos.length, 1);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('entity-registry: verifica existencia', () => {
  const ruta = join(tmpdir(), `er-exist-${Date.now()}.json`);
  const er = new EntityRegistry(ruta);

  er.registrarEntidad({
    canonicalName: 'EURUSD',
    entityType: 'INSTRUMENT',
    source: 'kb',
  });

  assert.ok(er.existe('EURUSD'));
  assert.ok(!er.existe('USDJPY'));

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('entity-registry: NO duplica canonical names', () => {
  const ruta = join(tmpdir(), `er-nodup-${Date.now()}.json`);
  const er = new EntityRegistry(ruta);

  er.registrarEntidad({
    canonicalName: 'EURUSD',
    entityType: 'INSTRUMENT',
    source: 'kb',
  });

  assert.throws(() => {
    er.registrarEntidad({
      canonicalName: 'EURUSD',
      entityType: 'INSTRUMENT',
      source: 'kb',
    });
  });

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('entity-registry: NO duplica aliases', () => {
  const ruta = join(tmpdir(), `er-nodup-alias-${Date.now()}.json`);
  const er = new EntityRegistry(ruta);

  er.registrarEntidad({
    canonicalName: 'Federal Reserve',
    aliases: ['Fed'],
    entityType: 'CENTRAL_BANK',
    source: 'kb',
  });

  assert.throws(() => {
    er.registrarEntidad({
      canonicalName: 'FRB',
      aliases: ['Fed'], // Alias duplicado
      entityType: 'CENTRAL_BANK',
      source: 'kb',
    });
  });

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('entity-registry: marca supersedida', () => {
  const ruta = join(tmpdir(), `er-supersede-${Date.now()}.json`);
  const er = new EntityRegistry(ruta);

  const e1 = er.registrarEntidad({
    canonicalName: 'Old Name',
    entityType: 'CONCEPT',
    source: 'kb',
  });

  const e2 = er.registrarEntidad({
    canonicalName: 'New Name',
    entityType: 'CONCEPT',
    source: 'kb',
  });

  er.marcarSupersedida(e1.entityId, e2.entityId);

  const recuperado = er.obtenerPorId(e1.entityId);
  assert.equal(recuperado!.status, 'SUPERSEDED');
  assert.equal(recuperado!.supersededBy, e2.entityId);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('entity-registry: agrega alias a entidad existente', () => {
  const ruta = join(tmpdir(), `er-add-alias-${Date.now()}.json`);
  const er = new EntityRegistry(ruta);

  const entity = er.registrarEntidad({
    canonicalName: 'Federal Reserve',
    aliases: ['Fed'],
    entityType: 'CENTRAL_BANK',
    source: 'kb',
  });

  er.agregarAlias(entity.entityId, 'FRB');

  const recuperado = er.obtenerPorNombre('FRB');
  assert.ok(recuperado);
  assert.equal(recuperado!.canonicalName, 'Federal Reserve');

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('entity-registry: relaciona dos entidades', () => {
  const ruta = join(tmpdir(), `er-relate-${Date.now()}.json`);
  const er = new EntityRegistry(ruta);

  const fed = er.registrarEntidad({
    canonicalName: 'Federal Reserve',
    entityType: 'CENTRAL_BANK',
    source: 'kb',
  });

  const usd = er.registrarEntidad({
    canonicalName: 'US Dollar',
    entityType: 'CURRENCY',
    source: 'kb',
  });

  er.relacionar(fed.entityId, usd.entityId);

  const fedRecuperado = er.obtenerPorId(fed.entityId);
  assert.ok(fedRecuperado!.relatedEntityIds.includes(usd.entityId));

  const usdRecuperado = er.obtenerPorId(usd.entityId);
  assert.ok(usdRecuperado!.relatedEntityIds.includes(fed.entityId));

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('entity-registry: lista activas', () => {
  const ruta = join(tmpdir(), `er-active-${Date.now()}.json`);
  const er = new EntityRegistry(ruta);

  const e1 = er.registrarEntidad({
    canonicalName: 'Entity 1',
    entityType: 'CONCEPT',
    source: 'kb',
  });

  const e2 = er.registrarEntidad({
    canonicalName: 'Entity 2',
    entityType: 'CONCEPT',
    source: 'kb',
  });

  er.marcarSupersedida(e1.entityId, e2.entityId);

  const activas = er.listarActivas();
  assert.equal(activas.length, 1);
  assert.equal(activas[0].entityId, e2.entityId);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('entity-registry: persistencia', () => {
  const ruta = join(tmpdir(), `er-persist-${Date.now()}.json`);

  const er1 = new EntityRegistry(ruta);
  er1.registrarEntidad({
    canonicalName: 'EURUSD',
    entityType: 'INSTRUMENT',
    source: 'kb',
  });

  const er2 = new EntityRegistry(ruta);
  const recuperado = er2.obtenerPorNombre('EURUSD');
  assert.ok(recuperado);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('entity-registry: estado', () => {
  const ruta = join(tmpdir(), `er-state-${Date.now()}.json`);
  const er = new EntityRegistry(ruta);

  er.registrarEntidad({
    canonicalName: 'EURUSD',
    entityType: 'INSTRUMENT',
    source: 'kb',
  });

  er.registrarEntidad({
    canonicalName: 'Fed',
    entityType: 'CENTRAL_BANK',
    source: 'kb',
  });

  const estado = er.obtenerEstado();
  assert.equal(estado.totalEntidades, 2);
  assert.equal(estado.activas, 2);
  assert.ok(estado.porTipo['INSTRUMENT']);
  assert.ok(estado.porTipo['CENTRAL_BANK']);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('entity-registry: singleton', () => {
  asignarER(null);
  assert.equal(obtenerER(), null);

  const ruta = join(tmpdir(), `er-sing-${Date.now()}.json`);
  const er = inicializarER(ruta);
  assert.equal(obtenerER(), er);

  asignarER(null);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});
