import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EURUSD_H1_BASELINE_CONFIG, verifyDatasetHash } from '../src/trading-lab/historical-baseline.ts';

const leer = (f: string) => readFileSync(new URL(`../src/panel-vortice/${f}`, import.meta.url), 'utf8');
const html = leer('index.html');
const css = leer('app.css') + leer('premium.css');
const js = leer('app.js');

test('Phase A: Canonical Vortex SVG component exists with correct IDs, classes and viewBox', () => {
  assert.ok(html.includes('id="canonical-vortex"'), 'debe tener id canonical-vortex');
  assert.ok(html.includes('class="vortice-neural vortice-canonical vortex-art"'), 'debe tener clases canónicas');
  assert.ok(html.includes('viewBox="0 0 600 900"'), 'viewBox vertical canónico 600x900');
  assert.ok(html.includes('aria-label="ATLAS Canonical Vortex Core"'), 'accesibilidad semántica');
});

test('Phase A: Layer 1 — Central Axis and traveling light pulses exist', () => {
  assert.ok(html.includes('class="vortex-layer-axis"'), 'capa eje central');
  assert.ok(html.includes('class="v-axis-node"'), 'nodos de pulso vertical');
  assert.ok(css.includes('@keyframes v-axis-travel'), 'animación viaje eje');
});

test('Phase A: Layer 2 & 3 — Primary (Cyan) and Secondary (Magenta) Helices and stacked coils', () => {
  assert.ok(html.includes('class="vortex-layer-helices"'), 'capa helices y bobinas');
  assert.ok(html.includes('class="v-helix-cyan"'), 'hélice cian primaria');
  assert.ok(html.includes('class="v-helix-magenta"'), 'hélice magenta secundaria');
  assert.ok(html.includes('class="v-coils"'), 'grupo de bobinas resonadoras');
  assert.ok(html.includes('class="v-coil"'), 'bobinas elípticas apiladas');
  assert.ok(html.includes('class="v-cross-spark"'), 'destellos de cruce helicoidal');
  assert.ok(css.includes('@keyframes v-helix-drift'), 'animación deriva hélice');
  assert.ok(css.includes('@keyframes v-coil-pulse'), 'animación pulso bobina');
});

test('Phase A: Layer 4 — Containment Sphere with celestial wireframe arcs', () => {
  assert.ok(html.includes('class="vortex-layer-containment"'), 'capa esfera de contención');
  assert.ok(html.includes('class="v-sphere-rim"'), 'anillo silueta esférica');
  assert.ok(html.includes('class="v-globe-arc"'), 'arcos meridianos celestiales');
  assert.ok(css.includes('@keyframes v-arc-breathe'), 'animación respiración arcos');
});

test('Phase A: Layer 5 — Angled and horizontal Orbital Rings', () => {
  assert.ok(html.includes('class="vortex-layer-orbits"'), 'capa anillos orbitales');
  assert.ok(html.includes('class="v-orbit v-orbit-cyan"'), 'órbita cian inclinada');
  assert.ok(html.includes('class="v-orbit v-orbit-magenta"'), 'órbita magenta inclinada');
  assert.ok(html.includes('class="v-orbit v-orbit-outer"'), 'órbita exterior');
  assert.ok(css.includes('@keyframes v-orbit-a'), 'animación orbital A');
  assert.ok(css.includes('@keyframes v-orbit-b'), 'animación orbital B');
});

test('Phase A: Layer 6 & 7 — Satellite Nodes and Major Planetary Orbs', () => {
  assert.ok(html.includes('class="vortex-layer-satellite-nodes"'), 'capa nodos satelitales');
  assert.ok(html.includes('class="v-sat-node"'), 'nodos satelitales en órbitas');
  assert.ok(html.includes('class="vortex-layer-major-orbs"'), 'capa orbes planetarios');
  assert.ok(html.includes('class="v-major-orb v-orb-magenta"'), 'planeta magenta izquierdo');
  assert.ok(html.includes('class="v-major-orb v-orb-cyan"'), 'planeta cian derecho');
  assert.ok(html.includes('class="v-major-orb v-orb-blue"'), 'satélite azul');
  assert.ok(html.includes('class="v-major-orb v-orb-pink"'), 'satélite rosa');
  assert.ok(css.includes('@keyframes v-orb-hover'), 'animación levitación orbes');
});

test('Phase A: Layer 8 — Particle Field and 4-pointed diamond glints', () => {
  assert.ok(html.includes('class="vortex-layer-particles"'), 'capa partículas');
  assert.ok(html.includes('class="v-star'), 'partículas estelares');
  assert.ok(html.includes('class="v-sparkle'), 'destellos de diamante 4 puntas');
  assert.ok(css.includes('@keyframes v-sparkle'), 'animación destellos diamante');
});

test('Phase A: Layer 9 — Core Light, Equator Heart, and Apex Flares', () => {
  assert.ok(html.includes('class="vortex-layer-core-light"'), 'capa núcleo de luz');
  assert.ok(html.includes('class="v-core-heart"'), 'corazón ecuatorial');
  assert.ok(html.includes('class="v-apex-flare-top"'), 'fulgor ápice superior');
  assert.ok(html.includes('class="v-apex-flare-bottom"'), 'fulgor ápice inferior');
  assert.ok(html.includes('class="v-equatorial-beam"'), 'plano horizontal de energía ecuatorial');
  assert.ok(html.includes('class="vortex-layer-axis"'), 'eje vertical de energía');
});

test('Phase A: Interactive States, Speeds, Hover and Reduced Motion', () => {
  assert.ok(css.includes('.vortice-canonical:hover'), 'estado hover interactivo');
  assert.ok(css.includes('var(--vortex-speed'), 'control de velocidad por variable');
  assert.ok(css.includes('data-vortex-state=error'), 'estado error');
  assert.ok(css.includes('data-vortex-state=paused'), 'estado pausado');
  assert.ok(css.includes('data-vortex-state=offline'), 'estado desconectado');
  assert.ok(css.includes('prefers-reduced-motion:reduce'), 'respeto a reducción de movimiento');
});

test('Phase 1: dormant entry is vortex-only with restrained ATLAS branding', () => {
  assert.ok(html.includes('class="vortex-entry-brand"'), 'dormant entry includes minimal ATLAS branding');
  assert.ok(html.includes('ACTIVATE CORE'), 'dormant entry includes a minimal activation cue');
  assert.ok(css.includes('body.vortex-entry-intro .sidebar,'), 'dormant entry hides the sidebar');
  assert.ok(css.includes('body.vortex-entry-intro .board>:not(#vortex-core){display:none}'), 'dormant entry hides dashboard panels');
  assert.ok(css.includes('height:clamp(440px,64dvh,590px)'), 'mobile dormant Vortex keeps a dominant viewport scale');
  assert.ok(css.includes('safe-area-inset-top'), 'dormant ATLAS branding respects the viewport safe area');
  assert.ok(css.includes('safe-area-inset-bottom'), 'activation cue respects the viewport safe area');
  assert.ok(css.includes('.hero-stage::before'), 'dormant entry includes a restrained containment-depth layer');
  assert.ok(css.includes('body.vortex-entry-intro .operational-vortex,'), 'operational Vortex content is hidden during dormant entry');
  assert.ok(css.includes('height:100dvh'), 'dormant entry fills the dynamic viewport');
  assert.ok(css.includes('overflow:hidden'), 'dormant entry prevents accidental scrolling');
});

test('Phase A: Zero forbidden trading words in uppercase in UI markup and scripts', () => {
  for (const forbidden of ['BUY', 'SELL', 'ORDER', 'EXECUTE', 'CLOSE TRADE']) {
    assert.equal(html.includes(forbidden) || js.includes(forbidden), false, `no debe contener "${forbidden}"`);
  }
});

test('Phase A: Canonical dataset SHA256 integrity preserved', () => {
  const verified = verifyDatasetHash(EURUSD_H1_BASELINE_CONFIG.csvPath, EURUSD_H1_BASELINE_CONFIG.expectedSHA256);
  assert.equal(verified, true, 'SHA256 canónico verificado');
});

test('Phase 3 V5: foreground reactor uses a manual vertical profile without replacing the native Vortex', () => {
  assert.ok(html.includes('class="vortex-v5-reactor"'), 'V5 foreground reactor layer exists');
  assert.ok(html.includes('class="v5-main-toroids"'), 'manual main-reactor toroids exist');
  assert.ok(html.includes('rx="270"'), 'main reactor reaches its widest manual profile at the center');
  assert.ok(html.includes('rx="55"') && html.includes('rx="60"'), 'top and bottom resonators contract independently');
  assert.ok(html.includes('class="v5-helix cyan"') && html.includes('class="v5-helix magenta"') && html.includes('class="v5-helix white"'), 'three distinct helix systems exist');
  assert.equal((html.match(/class="v5-hubs/g) || []).length, 1, 'V5 hub group is present');
  assert.ok(css.includes('.vortex-layer-helices{opacity:.38}'), 'legacy globe shell is visually subordinate');
  assert.ok(css.includes('@keyframes v5-helix-flow'), 'V5 helix motion is asynchronous');
});
