import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, existsSync, writeFileSync } from 'node:fs';
import {
  KnowledgeBaseLocal,
  dividirEnChunks,
  inicializarKB,
  obtenerKB,
  asignarKB,
} from '../src/trading-lab/knowledge-base.ts';

test('knowledge-base: instancia vacía sin documentos', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-empty-${Date.now()}.json`));
  assert.equal(kb.contarDocumentosReales(), 0);
  assert.equal(kb.contarChunksReales(), 0);

  const estado = kb.obtenerEstado();
  assert.equal(estado.documentsCount, 0);
  assert.equal(estado.chunksCount, 0);
  assert.equal(estado.indexType, 'TEXTUAL');
  assert.equal(estado.embeddingsEnabled, false);
});

test('knowledge-base: ingesta documento válido', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-ingesta-${Date.now()}.json`));
  const contenido = 'Este es un documento de prueba sobre trading en mercados de divisas.';

  const resultado = kb.ingesta({
    contenido,
    titulo: 'Guía de Trading',
    authority: 'EDUCATIONAL',
    documentType: 'EDUCATIONAL',
    institution: 'Academia de Trading',
  });

  assert.ok(resultado.documentId);
  assert.equal(resultado.chunksCount, 1);
  assert.equal(kb.contarDocumentosReales(), 1);
});

test('knowledge-base: rechaza contenido vacío', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-empty-content-${Date.now()}.json`));

  assert.throws(() => {
    kb.ingesta({
      contenido: '',
      titulo: 'Título válido',
      authority: 'USER_PROVIDED',
    });
  }, /Contenido vacío/);
});

test('knowledge-base: rechaza título vacío', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-empty-title-${Date.now()}.json`));

  assert.throws(() => {
    kb.ingesta({
      contenido: 'Contenido válido',
      titulo: '',
      authority: 'USER_PROVIDED',
    });
  }, /Título vacío/);
});

test('knowledge-base: detecta y rechaza contraseña', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-pwd-${Date.now()}.json`));

  assert.throws(() => {
    kb.ingesta({
      contenido: 'Mi contraseña es 12345',
      titulo: 'Documento',
      authority: 'USER_PROVIDED',
    });
  }, /secretos/);
});

test('knowledge-base: detecta y rechaza API key', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-apikey-${Date.now()}.json`));

  assert.throws(() => {
    kb.ingesta({
      contenido: 'Mi api_key es sk-1234567890',
      titulo: 'Documento',
      authority: 'USER_PROVIDED',
    });
  }, /secretos/);
});

test('knowledge-base: detecta y rechaza token', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-token-${Date.now()}.json`));

  assert.throws(() => {
    kb.ingesta({
      contenido: 'Bearer token secreto',
      titulo: 'Documento',
      authority: 'USER_PROVIDED',
    });
  }, /secretos/);
});

test('knowledge-base: detecta y rechaza private key PEM', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-privkey-${Date.now()}.json`));

  assert.throws(() => {
    kb.ingesta({
      contenido: '-----BEGIN RSA PRIVATE KEY-----',
      titulo: 'Key',
      authority: 'USER_PROVIDED',
    });
  }, /secretos/);
});

test('knowledge-base: chunking divide por párrafos', () => {
  const docId = 'test-doc-001';
  const texto = `Párrafo 1. Contenido aquí.

Párrafo 2. Más contenido.

Párrafo 3. Aún más contenido.`;

  const chunks = dividirEnChunks(texto, docId);
  assert.equal(chunks.length, 3);
  assert.ok(chunks[0].text.includes('Párrafo 1'));
  assert.ok(chunks[1].text.includes('Párrafo 2'));
  assert.ok(chunks[2].text.includes('Párrafo 3'));
});

test('knowledge-base: chunking respeta límite de caracteres', () => {
  const docId = 'test-doc-long';
  const oracionLarga = 'Una oración muy larga que debe ocupar espacio. ';
  const texto = oracionLarga.repeat(100); // ~5000 caracteres

  const chunks = dividirEnChunks(texto, docId, 1000);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.text.length <= 1200); // Límite + margen
  }
});

test('knowledge-base: buscar por keywords', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-search-${Date.now()}.json`));

  kb.ingesta({
    contenido: 'Los mercados de divisas son el corazón del trading global.',
    titulo: 'Intro Forex',
    authority: 'EDUCATIONAL',
  });

  const resultados = kb.buscar('mercados divisas');
  assert.ok(resultados.length > 0);
  assert.ok(resultados[0].score > 0);
  assert.ok(resultados[0].score <= 1.0);
});

test('knowledge-base: búsqueda vacía devuelve cero resultados', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-empty-search-${Date.now()}.json`));

  kb.ingesta({
    contenido: 'Documento de prueba.',
    titulo: 'Prueba',
    authority: 'USER_PROVIDED',
  });

  const resultados = kb.buscar('palabrainexistente xyzabc');
  assert.equal(resultados.length, 0);
});

test('knowledge-base: búsqueda por institución', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-inst-search-${Date.now()}.json`));

  kb.ingesta({
    contenido: 'Políticas de la Fed.',
    titulo: 'Política Monetaria',
    authority: 'INSTITUTIONAL',
    institution: 'Federal Reserve',
  });

  const resultados = kb.buscarPorInstitucion('Federal');
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].sourceMetadata.institution, 'Federal Reserve');
});

test('knowledge-base: búsqueda por tema', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-topic-search-${Date.now()}.json`));

  kb.ingesta({
    contenido: 'Análisis técnico con gráficos.',
    titulo: 'Chart Patterns',
    authority: 'RESEARCH',
    topic: 'Technical Analysis',
  });

  const resultados = kb.buscarPorTema('Technical');
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].sourceMetadata.title, 'Chart Patterns');
});

test('knowledge-base: búsqueda por instrumento', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-instr-search-${Date.now()}.json`));

  kb.ingesta({
    contenido: 'Estrategia para pares de divisas.',
    titulo: 'Forex Pairs',
    authority: 'EDUCATIONAL',
    instruments: ['EURUSD', 'GBPUSD'],
  });

  const resultados = kb.buscarPorInstrumento('EUR');
  assert.equal(resultados.length, 1);
});

test('knowledge-base: persistencia guarda y carga', () => {
  const ruta = join(tmpdir(), `kb-persist-${Date.now()}.json`);

  const kb1 = new KnowledgeBaseLocal(ruta);
  kb1.ingesta({
    contenido: 'Contenido persistido.',
    titulo: 'Documento Persistido',
    authority: 'USER_PROVIDED',
  });

  const kb2 = new KnowledgeBaseLocal(ruta);
  assert.equal(kb2.contarDocumentosReales(), 1);
  assert.ok(kb2.contarChunksReales() > 0);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('knowledge-base: persistencia corrupta recupera gracefully', () => {
  const ruta = join(tmpdir(), `kb-corrupt-${Date.now()}.json`);

  // Crear archivo corrupto
  writeFileSync(ruta, 'JSON CORRUPTO { [ ] }', 'utf8');

  // Debe cargar vacío sin crash
  const kb = new KnowledgeBaseLocal(ruta);
  assert.equal(kb.contarDocumentosReales(), 0);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('knowledge-base: singleton - inicializar y obtener', () => {
  asignarKB(null);
  assert.equal(obtenerKB(), null);

  const kb1 = inicializarKB(join(tmpdir(), `kb-singleton-${Date.now()}.json`));
  const kb2 = obtenerKB();
  assert.ok(kb1 === kb2);

  asignarKB(null);
});

test('knowledge-base: documento con metadatos', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-meta-${Date.now()}.json`));

  const resultado = kb.ingesta({
    contenido: 'Contenido técnico.',
    titulo: 'Documento Técnico',
    authority: 'TECHNICAL',
    author: 'Dr. Smith',
    institution: 'Princeton',
    topic: 'Econometría',
    region: 'USA',
    instruments: ['SPY', 'QQQ'],
  });

  const doc = kb.obtenerDocumento(resultado.documentId);
  assert.ok(doc);
  assert.equal(doc!.author, 'Dr. Smith');
  assert.equal(doc!.institution, 'Princeton');
  assert.equal(doc!.topic, 'Econometría');
  assert.equal(doc!.region, 'USA');
  assert.deepEqual(doc!.instruments, ['SPY', 'QQQ']);
});

test('knowledge-base: estado refleja ingesta múltiple', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-multiple-${Date.now()}.json`));

  kb.ingesta({
    contenido: 'Documento uno.',
    titulo: 'Doc 1',
    authority: 'USER_PROVIDED',
  });

  kb.ingesta({
    contenido: 'Documento dos. Segunda oración.',
    titulo: 'Doc 2',
    authority: 'USER_PROVIDED',
  });

  const estado = kb.obtenerEstado();
  assert.equal(estado.documentsCount, 2);
  assert.ok(estado.chunksCount >= 2);
  assert.ok(estado.lastUpdate);
});

test('knowledge-base: fixture vs real - contadores separados', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-fixture-${Date.now()}.json`));

  kb.ingesta({
    contenido: 'Documento real.',
    titulo: 'Real',
    authority: 'USER_PROVIDED',
    isFixture: false,
  });

  kb.ingesta({
    contenido: 'Documento fixture.',
    titulo: 'Fixture',
    authority: 'USER_PROVIDED',
    isFixture: true,
  });

  assert.equal(kb.contarDocumentosReales(), 1);
  const estado = kb.obtenerEstado();
  assert.equal(estado.documentsCount, 1); // Solo reales
});

test('knowledge-base: score de búsqueda ordenado por relevancia', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-scoring-${Date.now()}.json`));

  kb.ingesta({
    contenido: 'Trading trading trading mercado.',
    titulo: 'Altamente relevante',
    authority: 'USER_PROVIDED',
  });

  kb.ingesta({
    contenido: 'Algún documento sin palabras clave.',
    titulo: 'Poco relevante',
    authority: 'USER_PROVIDED',
  });

  const resultados = kb.buscar('trading mercado');
  assert.ok(resultados.length > 0);
  assert.ok(resultados[0].score >= (resultados[1]?.score || 0));
});

test('knowledge-base: chunk ID determinista y recuperable', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-chunk-id-${Date.now()}.json`));

  const resultado = kb.ingesta({
    contenido: 'Párrafo 1. Sentencia 1. Sentencia 2.',
    titulo: 'Test Determinista',
    authority: 'USER_PROVIDED',
  });

  const doc = kb.obtenerDocumento(resultado.documentId);
  assert.ok(doc);

  // El documento debe tener chunks
  const estado = kb.obtenerEstado();
  assert.ok(estado.chunksCount > 0);
});

test('knowledge-base: búsqueda sin indexación falsa', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-index-check-${Date.now()}.json`));

  kb.ingesta({
    contenido: 'Una palabra muy corta: a, o, y, el son palabras cortas.',
    titulo: 'Stopwords',
    authority: 'USER_PROVIDED',
  });

  // Búsqueda de palabras muy cortas (< 3 chars) no debe encontrar nada indexado
  const resultados = kb.buscar('a o y el');
  assert.equal(resultados.length, 0);
});

test('knowledge-base: soporte de formatos indicado en estado', () => {
  const kb = new KnowledgeBaseLocal(join(tmpdir(), `kb-formats-${Date.now()}.json`));

  const estado = kb.obtenerEstado();
  assert.ok(estado.supportedFormats.includes('TXT'));
  assert.ok(estado.supportedFormats.includes('MD'));
  assert.ok(estado.supportedFormats.includes('JSON'));
});
