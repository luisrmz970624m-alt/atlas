import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(new URL(`../src/panel-vortice/${file}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('premium.css');
const svg = html.slice(html.indexOf('id="canonical-vortex"'), html.indexOf('</svg>', html.indexOf('id="canonical-vortex"')));

test('Vortex convergence has an equatorial cyan-magenta plane with a white-hot center', () => {
  const beam = svg.slice(svg.indexOf('class="v-equatorial-beam"'), svg.indexOf('</g>', svg.indexOf('class="v-equatorial-beam"')));
  assert.ok(beam.includes('M0 450') && beam.includes('600 450'), 'beam spans left through center to right');
  assert.ok(beam.includes('fill="#25D9FF"') && beam.includes('fill="#F22BFF"') && beam.includes('fill="#FFFFFF"'), 'beam uses cyan, magenta and white');
  assert.ok(beam.includes('class="equatorial-disc"') && beam.includes('cx="300" cy="450"'), 'thin disc converges at the core center');
  assert.ok(beam.includes('r="7" fill="#FFFFFF"'), 'white-hot point is the central intersection');
});

test('Vortex has exactly eight independent prismatic anchor nodes', () => {
  const anchors = [...svg.matchAll(/<path class="v-prism-anchor[^"]*"/g)];
  assert.equal(anchors.length, 8);
  for (const position of ['pole top', 'upper-left', 'upper-right', 'equatorial-left', 'equatorial-right', 'lower-left', 'lower-right', 'pole bottom']) {
    assert.ok(svg.includes(`v-prism-anchor ${position}`), `anchor ${position} exists`);
  }
});

test('Dense reactor uses at least 45 tapered magnetic coil lines', () => {
  const groups = ['v5-resonators', 'v5-main-toroids', 'v5-micro-coils'].map((name) => {
    const start = svg.indexOf(`class="${name}"`);
    const end = svg.indexOf('</g>', start);
    return svg.slice(start, end);
  });
  const coils = groups.reduce((count, group) => count + (group.match(/<ellipse\b/g)?.length ?? 0), 0);
  assert.equal(coils, 53);
  assert.equal((svg.match(/class="v5-helix (?:cyan|magenta|white|violet)"/g) ?? []).length, 24);
  assert.equal((svg.match(/class="v5-front-coils"[\s\S]*?<\/g>/)?.[0].match(/<ellipse\b/g) ?? []).length, 10);
  assert.equal((svg.match(/class="v5-core-contour (?:cyan|magenta)"/g) ?? []).length, 4);
  const orbitStart = svg.indexOf('class="v5-orbital-fields"');
  const orbitEnd = svg.indexOf('</g>', orbitStart);
  const orbitals = svg.slice(orbitStart, orbitEnd);
  assert.equal((orbitals.match(/<(?:ellipse|path)\b/g) ?? []).length, 20);
  assert.equal((svg.match(/<ellipse\b[^>]*transform="rotate\(/g) ?? []).length, 34);
  assert.match(svg, /<ellipse cx="300" cy="105" rx="55"/, 'top rings start compressed');
  assert.match(svg, /<ellipse cx="304" cy="452" rx="270"/, 'equatorial rings reach their widest point');
  assert.match(svg, /<ellipse cx="300" cy="764" rx="60"/, 'bottom rings taper back toward the pole');
});

test('Plasma axis, convergences and orbital satellites follow the reference hierarchy', () => {
  const axis = svg.slice(svg.indexOf('class="v5-particle-axis"'), svg.indexOf('</g>', svg.indexOf('class="v5-particle-axis"')));
  assert.equal((axis.match(/class="axis-(?:magenta-bloom|cyan-core|white-points)"/g) ?? []).length, 3);
  assert.equal((axis.match(/class="axis-convergence"/g) ?? []).length, 3);
  assert.match(axis, /x1="300" y1="0" x2="300" y2="900"/);

  const hubsStart = svg.indexOf('class="v5-hubs"');
  const hubs = svg.slice(hubsStart, svg.indexOf('class="v5-front-arcs"', hubsStart));
  assert.equal((hubs.match(/class="hub-(?:cyan|magenta)"/g) ?? []).length, 6);
  assert.ok(hubs.includes('hub-cyan') && hubs.includes('hub-magenta'));
});

test('Geometry modes are independent from operational states', () => {
  assert.match(svg, /data-geometry-mode="standard"/);
  assert.match(svg, /data-operational-state="DORMANT"/);
  for (const mode of ['compact', 'standard', 'expanded']) {
    assert.ok(css.includes(`data-geometry-mode="${mode}"`), `${mode} geometry is styled independently`);
    assert.ok(html.includes(`data-geometry-choice="${mode}"`), `${mode} can be selected in settings`);
  }
  for (const state of ['DORMANT', 'IDLE', 'ACTIVE', 'PROCESSING', 'WARNING', 'ERROR', 'OFFLINE']) {
    assert.ok(css.includes(`data-operational-state="${state}"`) || html.includes(`data-operational-state="${state}"`), `${state} operational state is supported`);
  }
  assert.match(read('app.js'), /window\.atlasVortex=Object\.freeze\(\{setGeometryMode,setOperationalState\}\)/);
});

test('Compact mode reduces detail; expanded mode restores containment and orbital layers', () => {
  assert.match(css, /data-geometry-mode="compact"[^}]*transform:scale\(\.32\)/);
  assert.match(css, /data-geometry-mode="compact"[^}]*vortex-layer-particles>\.v-star:not\(:nth-child\(4n\)\)/);
  assert.match(css, /data-geometry-mode="standard"[^}]*transform:scale\(1\.26,1\.12\)/);
  assert.match(css, /data-geometry-mode="standard"\] \.vortex-v5-reactor\{transform:scale\(\.78,1\.04\)/);
  assert.match(css, /data-geometry-mode="standard"\] \.v5-helix-system\{transform:scaleX\(1\.9\)/);
  assert.match(css, /data-geometry-mode="standard"\] \.v5-micro-coils\{display:block\}/);
  assert.match(css, /data-geometry-mode="standard"\] \.v-prism-anchor\{scale:\.92/);
  assert.match(css, /data-geometry-mode="standard"\] \.v-equatorial-beam\{transform:scaleX\(1\.15\)/);
  assert.match(css, /data-geometry-mode="standard"\] \.vortex-layer-helices\{display:none\}/);
  assert.match(css, /data-geometry-mode="standard"\] \.vortex-core-geometry>ellipse:first-of-type,[\s\S]*?\.vortex-back\{display:none\}/);
  assert.match(css, /data-geometry-mode="standard"\] \.vortex-layer-core-light \.v-heart-ambient\{display:none\}/);
  assert.match(css, /vortex-entry-intro:not\(\.vortex-visual-validation\) \.hero-stage::before\{display:none\}/);
  assert.match(css, /vortex-entry-intro:not\(\.vortex-visual-validation\) \.vortice-canonical\{filter:drop-shadow/);
  assert.match(css, /data-geometry-mode="expanded"[^}]*transform:scale\(1\.30,1\.06\)/);
  assert.match(css, /data-geometry-mode="expanded"[^}]*vortex-layer-orbits[^}]*display:block/);
  assert.match(css, /data-geometry-mode="expanded"\] \.v5-orbital-fields\{transform:scaleX\(1\.28\)/);
  assert.match(css, /data-geometry-mode="expanded"\] \.v5-micro-coils ellipse:nth-child\(even\)[\s\S]*?display:none/);
  assert.match(css, /data-geometry-mode="expanded"\] \.v-equatorial-beam\{transform:scaleX\(1\.24\)/);
  assert.match(css, /data-geometry-mode="expanded"\] \.v-prism-anchor\{scale:\.96/);
  assert.match(css, /vortex-visual-validation #canonical-vortex \.vortex-layer-platform\{\s*opacity:\.42;transform:scaleX\(\.78\)/);
});

test('Core-only phase keeps particles local and preserves outer negative space', () => {
  assert.equal(svg.includes('vortex-entry-orbit-field'), false);
  assert.match(css, /#canonical-vortex \.vortex-layer-particles\{[^}]*clip-path:ellipse/);
  assert.match(css, /body\.vortex-entry-intro\{[^}]*#01030a/);
  assert.match(css, /body\.vortex-visual-validation #vortex-core\{display:block/);
  assert.match(css, /vortex-visual-validation/);
  assert.match(css, /body\.vortex-visual-validation \.vortex-layer-platform\{display:block/);
  assert.match(css, /body\.vortex-visual-validation \.hero-stage::before/);
  assert.match(css, /body\.vortex-visual-validation \.hero-stage::after/);
  assert.match(read('app.js'), /visualValidation\?'expanded'/);
  assert.match(read('app.js'), /setOperationalState\(visualValidation\?'ACTIVE':'DORMANT'\)/);
  assert.match(read('app.js'), /setAttribute\('viewBox','-300 0 1200 900'\)/);
  assert.match(css, /#canonical-vortex\[data-operational-state="ACTIVE"\] \.v5-core-convergence/);
});
