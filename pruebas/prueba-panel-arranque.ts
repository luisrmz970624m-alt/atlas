import test from 'node:test'; import assert from 'node:assert/strict'; import { existsSync, readFileSync } from 'node:fs'; import { spawn } from 'node:child_process'; import { connect } from 'node:net'; import { fileURLToPath } from 'node:url';
import { configPanel, iniciarPanel, urlPanel, PANEL_HOST, PANEL_PUERTO_DEFAULT } from '../src/api-local/panel.ts';

const entrypoint = fileURLToPath(new URL('../src/api-local/panel.ts', import.meta.url));
const paquete = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const escuchando = (port: number) => new Promise<boolean>((resolve) => { const s = connect(port, PANEL_HOST); s.once('connect', () => { s.destroy(); resolve(true); }); s.once('error', () => resolve(false)); });

/** Lanza el entrypoint real (sin shell) y espera a que reporte su URL. */
function lanzar(env: Record<string, string>) {
  const hijo = spawn(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', entrypoint], { env: { ...process.env, ATLAS_SIN_RED: 'true', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let salida = '', errores = '';
  hijo.stdout.on('data', (c) => { salida += c; }); hijo.stderr.on('data', (c) => { errores += c; });
  const fin = new Promise<number | null>((resolve) => hijo.once('exit', (code) => resolve(code)));
  const url = new Promise<string>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`sin ATLAS_PANEL_URL. stdout=${salida} stderr=${errores}`)), 15000);
    hijo.stdout.on('data', () => { const m = salida.match(/ATLAS_PANEL_URL=(\S+)/); if (m) { clearTimeout(t); resolve(m[1]!); } });
    void fin.then(() => { clearTimeout(t); reject(new Error(`terminó antes de reportar URL. stderr=${errores}`)); });
  });
  return { hijo, url, fin, salida: () => salida, errores: () => errores };
}

test('S panel: entrypoint permanente existe en el repositorio', () => assert.ok(existsSync(entrypoint), entrypoint));
test('S panel: package.json declara npm run panel sobre el entrypoint', () => { assert.equal(typeof paquete.scripts?.panel, 'string'); assert.ok(paquete.scripts.panel.includes('src/api-local/panel.ts'), paquete.scripts.panel); });
test('S panel: host por defecto es 127.0.0.1', () => assert.equal(configPanel({}).host, '127.0.0.1'));
test('S panel: puerto por defecto es 4317', () => { assert.equal(PANEL_PUERTO_DEFAULT, 4317); assert.equal(configPanel({}).port, 4317); });
test('S panel: ATLAS_PANEL_PORT configura el puerto y rechaza valores inválidos', () => {
  assert.equal(configPanel({ ATLAS_PANEL_PORT: '4318' }).port, 4318);
  assert.equal(configPanel({ ATLAS_PANEL_PORT: '0' }).port, 0);
  for (const malo of ['abc', '70000', '-1', '43.5', '4318x']) assert.throws(() => configPanel({ ATLAS_PANEL_PORT: malo }), /ATLAS_PANEL_PORT/, malo);
});
test('S panel: bind 0.0.0.0 no está permitido', () => assert.throws(() => configPanel({ ATLAS_PANEL_HOST: '0.0.0.0' }), /solo escucha en 127\.0\.0\.1/));
test('S panel: bind :: no está permitido', () => { for (const h of ['::', '[::]', 'localhost']) assert.throws(() => configPanel({ ATLAS_PANEL_HOST: h }), /no está permitido/, h); });
test('S panel: reporta la URL del panel en loopback', () => assert.equal(urlPanel(4317), 'http://127.0.0.1:4317/panel-vortice/'));

test('S panel: GET /api/status y /panel-vortice/ responden y cerrar libera el listener', async () => {
  const panel = await iniciarPanel({ host: PANEL_HOST, port: 0 });
  try {
    assert.equal(panel.host, '127.0.0.1');
    assert.match(panel.url, /^http:\/\/127\.0\.0\.1:\d+\/panel-vortice\/$/);
    const status = await fetch(panel.apiUrl); assert.equal(status.status, 200);
    const json = await status.json(); assert.equal(json.ok, true); assert.equal(json.data.offline, true); assert.equal(json.data.mt5Real, 'PENDIENTE');
    const html = await fetch(panel.url); assert.equal(html.status, 200); assert.ok(html.headers.get('content-type')?.includes('text/html')); assert.ok((await html.text()).includes('EL VÓRTICE'));
    assert.equal(html.headers.get('access-control-allow-origin'), null);
  } finally { await panel.cerrar(); }
  assert.equal(await escuchando(panel.port), false);
  await panel.cerrar();
});

test('S panel: puerto ocupado da error claro y no afecta al proceso existente', async () => {
  const primero = await iniciarPanel({ host: PANEL_HOST, port: 0 });
  try {
    await assert.rejects(() => iniciarPanel({ host: PANEL_HOST, port: primero.port }), (e: Error) => e.message.includes(`${primero.port} ya está en uso`) && e.message.includes('no detiene procesos ajenos'));
    assert.equal((await fetch(primero.apiUrl)).status, 200);
  } finally { await primero.cerrar(); }
});

for (const senal of ['SIGINT', 'SIGTERM'] as const) test(`S panel: ${senal} cierra el proceso y el listener sin huérfanos`, async () => {
  const p = lanzar({ ATLAS_PANEL_PORT: '0' });
  const url = await p.url; const port = Number(new URL(url).port);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/status`)).status, 200);
  p.hijo.kill(senal);
  assert.equal(await p.fin, 0, p.errores());
  assert.ok(p.salida().includes('ATLAS_PANEL_CERRADO=true'), p.salida());
  assert.equal(await escuchando(port), false);
});

test('S panel: el proceso real informa puerto ocupado y sale con código 1', async () => {
  const ocupado = await iniciarPanel({ host: PANEL_HOST, port: 0 });
  try {
    const p = lanzar({ ATLAS_PANEL_PORT: String(ocupado.port) });
    await assert.rejects(p.url);
    assert.equal(await p.fin, 1);
    assert.match(p.errores(), /ATLAS_PANEL_ERROR=El puerto \d+ ya está en uso/);
    assert.equal((await fetch(ocupado.apiUrl)).status, 200);
  } finally { await ocupado.cerrar(); }
});

test('S panel: el proceso real rechaza bind público antes de escuchar', async () => {
  const p = lanzar({ ATLAS_PANEL_HOST: '0.0.0.0' });
  await assert.rejects(p.url);
  assert.equal(await p.fin, 1);
  assert.match(p.errores(), /ATLAS_PANEL_ERROR=ATLAS_PANEL_HOST=0\.0\.0\.0 no está permitido/);
});

test('S panel: arranque offline, sin red externa, shell ni proveedores remotos', () => {
  const fuente = readFileSync(entrypoint, 'utf8');
  assert.equal(/https?:\/\/(?!\$\{PANEL_HOST\}|127\.0\.0\.1)/.test(fuente), false);
  assert.equal(/child_process|node:fs|fetch\(|proveedores|anthropic|openai|mt5/i.test(fuente), false);
  assert.ok(fuente.includes("new MemoriaEmpresarial()"), 'memoria SQLite solo en memoria');
});
