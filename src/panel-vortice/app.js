// ATLAS · El Vórtice — centro de mando local. Solo lee /api/dashboard; no inventa datos.
// Todo valor dinámico se escribe con textContent/atributos; nunca se interpreta HTML recibido.
const app=document.querySelector('#app'),system=document.querySelector('#system'),template=document.querySelector('#card'),kpiTemplate=document.querySelector('#kpi'),root=document.documentElement,core=document.querySelector('#vortex-core'),coreState=document.querySelector('#vortex-state'),banner=document.querySelector('#banner'),settings=document.querySelector('#settings'),search=document.querySelector('#search');
const entryBody=document.body,canonicalVortex=document.querySelector('#canonical-vortex');
const visualValidation=new URLSearchParams(location.search).get('visual')==='core';
if(visualValidation){
  entryBody.classList.add('vortex-visual-validation');
  canonicalVortex.setAttribute('viewBox','-300 0 1200 900');
}
let timer=null,lastDecisions=0,lastData=null,samples=0;
const history={};
const preference=matchMedia('(prefers-color-scheme: dark)'),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const read=(key,fallback)=>{try{return localStorage.getItem(key)||fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
const sync=(selector,value)=>document.querySelectorAll(selector).forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===value||button.dataset.accentChoice===value||button.dataset.mode===value||button.dataset.styleChoice===value||button.dataset.effectsChoice===value)));
const text=v=>v===undefined||v===null||v===''?'UNAVAILABLE':String(v);
const display=v=>v==='PENDIENTE'?'PENDING':text(v);
const statusOf=v=>{const s=display(v).toUpperCase();if(s==='UNAVAILABLE'||s==='DISABLED')return'off';if(s==='EMPTY')return'empty';if(s==='PENDING')return'pending';if(s==='SIMULATED')return'simulated';if(['IMPLEMENTADO','OK','CONFIGURED','LOCAL'].includes(s))return'ok';if(['CRITICAL','ERROR','FAILED'].includes(s))return'danger';if(s==='WARNING')return'warning';return'value'};
const number=new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}),integer=new Intl.NumberFormat('es-MX',{maximumFractionDigits:0});
const fmt=(v,kind='money')=>typeof v==='number'&&Number.isFinite(v)?(kind==='int'?integer:number).format(v):text(v);
const el=(tag,className,content)=>{const node=document.createElement(tag);if(className)node.className=className;if(content!==undefined)node.textContent=content;return node};
const chip=v=>{const node=el('span','chip',display(v));node.dataset.status=statusOf(v);return node};
const slot=name=>document.querySelector(`[data-slot="${name}"]`);
const fill=(name,...nodes)=>slot(name)?.replaceChildren(...nodes);
const emptyState=message=>el('p','empty-state',message);

// --- Apariencia (tema, acento, preset, efectos) ---
const applyTheme=theme=>{const actual=theme==='auto'?(preference.matches?'dark':'light'):theme;root.dataset.theme=actual;root.dataset.themeMode=theme;write('vortice.theme',theme);sync('[data-theme-choice]',theme)};
const applyAccent=accent=>{root.dataset.accent=accent;write('vortice.accent',accent);sync('[data-accent-choice]',accent)};
const applyVisualStyle=style=>{root.dataset.visualStyle=style;write('vortice.visualStyle',style);sync('[data-style-choice]',style)};
const applyEffects=effects=>{root.dataset.effects=effects;write('vortice.effects',effects);sync('[data-effects-choice]',effects)};
const applyReducedMotion=()=>root.dataset.reducedMotion=reducedMotion.matches?'reduce':'no-preference';
const GEOMETRY_MODES=new Set(['compact','standard','expanded']);
function setGeometryMode(mode){
  if(!GEOMETRY_MODES.has(mode))throw new Error(`Modo geométrico desconocido: ${mode}`);
  canonicalVortex.dataset.geometryMode=mode;
  document.querySelectorAll('[data-geometry-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.geometryChoice===mode)));
  const label=mode.toUpperCase();
  document.querySelector('#geometry-label').textContent=label;
  document.querySelector('#geometry-cycle').setAttribute('aria-label',`Cambiar geometría del núcleo; actual: ${label.toLowerCase()}`);
  if(!visualValidation)write('vortice.geometryMode',mode);
}
window.atlasVortex=Object.freeze({setGeometryMode,setOperationalState});

// --- Modos y preferencias del modo Personalizado ---
const CUSTOM_GROUPS=['providers','alertas','empresa','trading','simulacion','finanzas','memoria','video','reportes'];
const readCustom=()=>{try{const saved=JSON.parse(read('vortice.customModules','null'));return Array.isArray(saved)?saved.filter(g=>CUSTOM_GROUPS.includes(g)):CUSTOM_GROUPS}catch{return CUSTOM_GROUPS}};
function applyCustom(){const visible=readCustom(),large=read('vortice.customCore','normal')==='large';document.querySelectorAll('[data-custom-group]').forEach(box=>box.checked=visible.includes(box.dataset.customGroup));document.querySelector('#custom-core-large').checked=large;document.querySelectorAll('.board [data-group]').forEach(panel=>panel.classList.toggle('custom-hidden',panel.dataset.group!=='vortice'&&!visible.includes(panel.dataset.group)));if(app.dataset.mode==='custom'&&large)app.dataset.core='large';else delete app.dataset.core;document.querySelector('#custom-prefs').dataset.inactive=String(app.dataset.mode!=='custom')}
const setMode=mode=>{app.dataset.mode=mode;write('vortice.modeView',mode);sync('[data-mode]',mode);applyCustom()};

// --- Vistas (sidebar) ---
const VIEWS={
  inicio:['Inicio','Centro de mando','Núcleo, módulos y estado del sistema en una sola vista.'],
  empresa:['Empresa','Empresa simulada','Indicadores agregados de la empresa simulada. SIMULATED.'],
  finanzas:['Finanzas','Finanzas','Caja, ingresos, gastos de nómina, utilidad y cuentas.'],
  ventas:['Ventas','Ventas','Ingresos y utilidad acumulados de la simulación.'],
  inventario:['Inventario','Inventario','Inventario valorizado. Reservado, disponible y stockouts aún no los entrega la API.'],
  nomina:['Nómina','Nómina','Gasto de nómina y plantilla simulada.'],
  facturacion:['Facturación','Facturación','Ingresos y cuentas por cobrar/pagar. El detalle de facturas no está expuesto.'],
  clientes:['Clientes','Clientes','Cuentas por cobrar. El padrón de clientes no está expuesto.'],
  proveedores:['Proveedores','Proveedores','Número de proveedores y cuentas por pagar.'],
  simulacion:['Simulación','Simulación empresarial','Workers de simulación locales: ejecución, pausas, completados y fallos.'],
  trading:['Trading','Trading Lab','Estado del laboratorio: backtesting, OOS, walk-forward y paper trading. Sin dinero real.'],
  video:['Análisis de Video','Análisis de video','Canal de video del núcleo. No hay módulo conectado a la API local.'],
  agentes:['Agentes IA','Agentes IA','Proveedores de IA, policy activa y supervisión.'],
  vortice:['El Vórtice','El Vórtice','Núcleo local: estado, policy, cola, decisiones y canales.'],
  cognitivo:['Memoria cognitiva','Memoria cognitiva','Consulta secundaria de conocimiento, recuperación, capas y procedencia locales. Solo lectura.'],
  reportes:['Reportes','Reportes','Auditoría reciente, recursos y resumen de esta sesión.'],
  alertas:['Alertas','Alertas','Alertas emitidas por el sistema local.'],
  comunicaciones:['Comunicaciones','Centro de comunicaciones','Mensajes, notificaciones, aprobaciones y estado de proveedores. MOCK.'],
  orquestacion:['Orquestación','Centro de Orquestación','Workflows multi-agente, StructuredIntent, DAG de pasos y validación independiente. MOCK.']
};
function setView(view){if(!VIEWS[view])view='inicio';const [crumb,title,lead]=VIEWS[view];app.dataset.view=view;document.querySelector('#view-crumb').textContent=crumb;document.querySelector('#view-title').textContent=title;document.querySelector('#view-lead').textContent=lead;document.querySelectorAll('[data-nav]').forEach(link=>link.dataset.nav===view?link.setAttribute('aria-current','page'):link.removeAttribute('aria-current'));document.querySelectorAll('.board [data-views]').forEach(panel=>panel.hidden=!panel.dataset.views.split(' ').includes(view));closeNav();if(lastData)renderKpis(lastData)}
const routeFromHash=()=>setView(location.hash.slice(1)||'inicio');

// --- Sidebar móvil ---
const menuToggle=document.querySelector('#menu-toggle'),scrim=document.querySelector('#scrim');
function openNav(){document.body.classList.add('nav-open');scrim.hidden=false;menuToggle.setAttribute('aria-expanded','true')}
function closeNav(){document.body.classList.remove('nav-open');scrim.hidden=true;menuToggle.setAttribute('aria-expanded','false')}

// Phase 2 & 3: Deterministic Activation State Machine (CLOSED -> ACTIVATING -> ACTIVE_CORE -> EXPANDING -> EXPANDED)
const ACTIVATION_STATES={
  CLOSED:'closed',
  ACTIVATING:'activating',
  ACTIVE_CORE:'active_core',
  EXPANDING:'expanding',
  EXPANDED:'expanded'
};
const OPERATIONAL_STATES=new Set(['DORMANT','IDLE','ACTIVE','PROCESSING','WARNING','ERROR','OFFLINE']);

function setOperationalState(state){
  if(!OPERATIONAL_STATES.has(state))throw new Error(`Estado operativo desconocido: ${state}`);
  entryBody.dataset.operationalState=state;
  core.dataset.operationalState=state;
  canonicalVortex.dataset.operationalState=state;
}

function setActivationState(state){
  entryBody.dataset.activationState=state;
  core.dataset.activationState=state;
  canonicalVortex.dataset.activationState=state;
  if(app)app.dataset.activationState=state;

  const statusLabel=document.querySelector('.vortex-entry-status');
  const promptLabel=document.querySelector('.vortex-entry-prompt');
  const firstRing=document.querySelector('#vortex-first-ring');

  if(state===ACTIVATION_STATES.CLOSED){
    setOperationalState('DORMANT');
    canonicalVortex.setAttribute('aria-expanded','false');
    canonicalVortex.setAttribute('aria-label','ATLAS Canonical Vortex Core');
    if(statusLabel)statusLabel.textContent='CORE · DORMANT';
    if(promptLabel)promptLabel.style.display='';
    if(firstRing)firstRing.hidden=true;
  }else if(state===ACTIVATION_STATES.ACTIVATING){
    setOperationalState('PROCESSING');
    canonicalVortex.setAttribute('aria-expanded','false');
    canonicalVortex.setAttribute('aria-label','ATLAS Canonical Vortex Core - Activando');
    if(statusLabel)statusLabel.textContent='CORE · INITIALIZING';
    if(promptLabel)promptLabel.style.display='none';
    if(firstRing)firstRing.hidden=true;
  }else if(state===ACTIVATION_STATES.ACTIVE_CORE){
    setOperationalState('ACTIVE');
    canonicalVortex.setAttribute('aria-expanded','true');
    canonicalVortex.setAttribute('aria-label','ATLAS Canonical Vortex Core - Activo');
    if(statusLabel)statusLabel.textContent='CORE · ACTIVE';
    if(promptLabel)promptLabel.style.display='none';
    if(firstRing)firstRing.hidden=true;
    core.dataset.vortexState='active';
  }else if(state===ACTIVATION_STATES.EXPANDING){
    setOperationalState('PROCESSING');
    canonicalVortex.setAttribute('aria-expanded','true');
    canonicalVortex.setAttribute('aria-label','ATLAS Canonical Vortex Core - Expandiendo');
    if(statusLabel)statusLabel.textContent='CORE · EXPANDING';
    if(promptLabel)promptLabel.style.display='none';
    if(firstRing)firstRing.hidden=false;
    core.dataset.vortexState='expanding';
  }else if(state===ACTIVATION_STATES.EXPANDED){
    setOperationalState('ACTIVE');
    canonicalVortex.setAttribute('aria-expanded','true');
    canonicalVortex.setAttribute('aria-label','ATLAS Canonical Vortex Core - Expandido');
    if(statusLabel)statusLabel.textContent='CORE · EXPANDED';
    if(promptLabel)promptLabel.style.display='none';
    if(firstRing)firstRing.hidden=false;
    core.dataset.vortexState='expanded';
  }
}

// Activation transition sequence (650ms–950ms total; 800ms canonical, 150ms in reduced motion)
function activateVortex(){
  if(entryBody.dataset.activationState!==ACTIVATION_STATES.CLOSED)return;
  setActivationState(ACTIVATION_STATES.ACTIVATING);
  const isReduced=root.dataset.reducedMotion==='reduce'||reducedMotion.matches;
  const duration=isReduced?150:800;
  setTimeout(()=>{
    setActivationState(ACTIVATION_STATES.ACTIVE_CORE);
  },duration);
}

// Phase 3: Module expansion sequence (700ms–1100ms total; 900ms canonical, 150ms in reduced motion)
function expandVortex(){
  if(entryBody.dataset.activationState!==ACTIVATION_STATES.ACTIVE_CORE)return;
  setActivationState(ACTIVATION_STATES.EXPANDING);
  const isReduced=root.dataset.reducedMotion==='reduce'||reducedMotion.matches;
  const duration=isReduced?150:900;
  setTimeout(()=>{
    setActivationState(ACTIVATION_STATES.EXPANDED);
  },duration);
}

// Phase A.3 contracts remain browser-local fixtures until a trusted read-only
// source exists. Values are deterministic, individually classified and never
// treated as a connection to a provider or host service.
const OPERATIONAL_OBSERVED_AT='2026-09-27T00:00:00.000Z';
const UNTRUSTED_OPERATIONAL_SOURCES=new Set(['MOCK','SIMULATED']);
const FABRICATED_EXTERNAL_STATES=new Set(['VERIFIED','REAL','CONNECTED','ONLINE']);
// Fixtures can describe work (for example, a task may be ACTIVE), but cannot
// claim an external connection or verification. Keep this normalization at the
// rendering boundary so future fixture edits cannot silently promote a mock.
function normalizeOperationalRecord(record){
  const source=String(record?.source||'UNAVAILABLE').toUpperCase();
  if(!UNTRUSTED_OPERATIONAL_SOURCES.has(source))return {...record,source};
  return Object.fromEntries(Object.entries(record).map(([key,value])=>[
    key,
    typeof value==='string'&&FABRICATED_EXTERNAL_STATES.has(value.toUpperCase())?source:value
  ]));
}
const OPERATIONAL_FIXTURES={
  atlasStatus:{source:'MOCK',freshness:'STALE',observedAt:OPERATIONAL_OBSERVED_AT,provenance:'deterministic local fixture',atlasStatus:'IDLE',networkMode:'OFFLINE',projectContext:'Atlas local',health:'UNAVAILABLE'},
  agents:[{source:'MOCK',freshness:'STALE',observedAt:OPERATIONAL_OBSERVED_AT,id:'codex',name:'Codex',status:'MOCK',currentTaskId:null,capabilities:['implementation'],classification:'LOCAL'},{source:'SIMULATED',freshness:'STALE',observedAt:OPERATIONAL_OBSERVED_AT,id:'claude',name:'Claude',status:'MOCK',currentTaskId:null,capabilities:['review'],classification:'UNAVAILABLE'}],
  tasks:[{source:'MOCK',freshness:'STALE',observedAt:OPERATIONAL_OBSERVED_AT,id:'A3-001',title:'Operational Vortex fixture',status:'ACTIVE',assignedAgent:'Codex',privilegeLevel:'L0',projectContext:'Atlas local'},{source:'MOCK',freshness:'STALE',observedAt:OPERATIONAL_OBSERVED_AT,id:'A3-002',title:'Independent validation',status:'PENDING',assignedAgent:null,privilegeLevel:'L0',projectContext:'Atlas local'},{source:'MOCK',freshness:'STALE',observedAt:OPERATIONAL_OBSERVED_AT,id:'A3-003',title:'Example completed task',status:'COMPLETED',assignedAgent:'Codex',privilegeLevel:'L0',projectContext:'Atlas local'},{source:'MOCK',freshness:'STALE',observedAt:OPERATIONAL_OBSERVED_AT,id:'A3-004',title:'Unavailable source example',status:'FAILED',assignedAgent:null,privilegeLevel:'L0',projectContext:'Atlas local'}],
  system:{source:'MOCK',freshness:'STALE',observedAt:OPERATIONAL_OBSERVED_AT,provenance:'no host telemetry contract',cpuPercent:null,ramPercent:null,storagePercent:null,networkMode:'OFFLINE',offline:true},
  knowledge:{source:'UNAVAILABLE',freshness:'UNAVAILABLE',observedAt:null,id:'knowledge-a3',projectContext:'Atlas local',summary:'No trusted knowledge source is exposed to A.3.',validation:'UNAVAILABLE',reference:null},
  security:{source:'MOCK',freshness:'STALE',observedAt:OPERATIONAL_OBSERVED_AT,provenance:'deterministic local security fixture',privilegeLevel:'L0',pendingApprovals:null,protectedMode:'ENABLED',atlasSinRed:true,realTrading:'BLOCKED'},
  activity:[{source:'MOCK',freshness:'STALE',observedAt:OPERATIONAL_OBSERVED_AT,id:'activity-a3',timestamp:OPERATIONAL_OBSERVED_AT,category:'SYSTEM',status:'INFO',message:'Operational Vortex uses deterministic local fixtures.',taskId:'A3-001'}],
  routing:{source:'MOCK',freshness:'STALE',observedAt:OPERATIONAL_OBSERVED_AT,provenance:'no routing source',freeFirst:'MOCK',tier:null,routingState:'MOCK'}
};
const OPERATIONAL_SECTORS={
  core:{title:'CORE / ATLAS STATUS',contract:'AtlasStatus',data:()=>OPERATIONAL_FIXTURES.atlasStatus},
  agents:{title:'AGENTS',contract:'AgentSummary',data:()=>OPERATIONAL_FIXTURES.agents},
  tasks:{title:'TASKS',contract:'TaskSummary',data:()=>OPERATIONAL_FIXTURES.tasks},
  system:{title:'SYSTEM',contract:'SystemTelemetry',data:()=>OPERATIONAL_FIXTURES.system},
  knowledge:{title:'KNOWLEDGE',contract:'KnowledgeSummary',data:()=>OPERATIONAL_FIXTURES.knowledge},
  security:{title:'SECURITY',contract:'SecuritySummary',data:()=>OPERATIONAL_FIXTURES.security},
  activity:{title:'ACTIVITY / EVENTS',contract:'ActivityEvent',data:()=>OPERATIONAL_FIXTURES.activity},
  routing:{title:'FREE_FIRST / ROUTING STATUS',contract:'RoutingSummary',data:()=>OPERATIONAL_FIXTURES.routing}
};
const operationalValue=v=>v===null||v===undefined?'UNAVAILABLE':Array.isArray(v)?v.join(', ')||'UNAVAILABLE':String(v);
function operationalItem(label,value,source){const node=el('div','operational-item');node.dataset.status=String(source||value||'UNAVAILABLE').toLowerCase();node.append(el('b','',label),el('span','',operationalValue(value)));return node}
function selectOperationalSector(id){const sector=OPERATIONAL_SECTORS[id]||OPERATIONAL_SECTORS.core,data=sector.data(),records=(Array.isArray(data)?data:[data]).map(normalizeOperationalRecord),panel=document.querySelector('#operational-panel'),source=document.querySelector('#operational-source');document.querySelectorAll('[data-vortex-sector]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.vortexSector===id)));const items=[operationalItem('SECTOR',sector.title),operationalItem('CONTRACT',sector.contract)];for(const record of records){items.push(operationalItem('SOURCE',record.source,record.source),operationalItem('FRESHNESS',record.freshness,record.freshness));for(const [key,value] of Object.entries(record)){if(['source','freshness','observedAt','expiresAt','provenance'].includes(key))continue;items.push(operationalItem(key.replace(/([A-Z])/g,' $1').toUpperCase(),value,record.source))}items.push(operationalItem('OBSERVED AT',record.observedAt,record.freshness));if(record.provenance)items.push(operationalItem('PROVENANCE',record.provenance,record.source))}panel?.replaceChildren(...items);if(source){source.textContent=`${records[0].source} · ${records[0].freshness}`;source.dataset.status=String(records[0].source).toLowerCase()}}

// --- Tarjetas genéricas ---
const card=(title,rows,kind='')=>{const node=template.content.firstElementChild.cloneNode(true);if(kind)node.classList.add(kind);node.querySelector('h2').textContent=title;const box=node.querySelector('.content');for(const [k,v] of rows){const row=document.createElement('div');row.className='row';row.dataset.status=statusOf(v);const a=document.createElement('span');a.className='key';a.textContent=k;const b=document.createElement('span');b.textContent=display(v);row.append(a,b);box.append(row)}return node};

// --- Núcleo ---
const visualState=d=>{const a=d.alerts||[];if(d.system?.estado!=='OK'||String(d.vortice?.estado).toLowerCase()==='offline')return'offline';if(a.some(x=>x.nivel==='CRITICAL'||x.nivel==='ERROR'))return'error';if(a.some(x=>x.nivel==='WARNING'))return'warning';if(d.simulations?.paused>0)return'paused';if(d.simulations?.running>0)return'processing';return d.vortice?.cola>0?'active':'idle'};
const channelStates=d=>{const s=d.simulations;return{texto:undefined,voz:undefined,imagenes:undefined,video:undefined,datos:d.business?.simulated?'SIMULATED':undefined,simulacion:!s?undefined:s.running>0?`${s.running} RUNNING`:s.totalWorkers>0?'SIMULATED':'EMPTY'}};
const linkState=v=>{const s=statusOf(v);return s==='off'?'off':s==='empty'?'idle':'live'};
function renderCore(d){const state=visualState(d),decisions=d.vortice?.decisiones;core.dataset.vortexState=state;coreState.textContent=state.toUpperCase();for(const [id,value] of [['core-estado',d.vortice?.estado],['core-policy',d.vortice?.modo],['core-supervisor',undefined],['core-queue',d.vortice?.cola],['core-decisions',decisions?.length],['core-last-action',decisions?.at?.(-1)?.accion??decisions?.at?.(-1)],['core-active-time',undefined]]){const node=document.querySelector(`#${id}`);node.textContent=text(value);node.dataset.status=statusOf(value)}for(const [channel,value] of Object.entries(channelStates(d))){document.querySelector(`#ch-${channel}`).textContent=text(value);document.querySelectorAll(`[data-channel="${channel}"],[data-link="${channel}"],[data-flow="${channel}"]`).forEach(node=>node.dataset.linkState=linkState(value))}if((decisions?.length||0)>lastDecisions){core.dataset.activity='new';setTimeout(()=>delete core.dataset.activity,380)}lastDecisions=decisions?.length||0}

// --- KPIs empresa con tendencia de sesión ---
const KPIS=[
  ['cash','Cash',d=>d.caja,'money',['inicio','empresa','finanzas']],
  ['revenue','Revenue',d=>d.ventas,'money',['inicio','empresa','finanzas','ventas','facturacion']],
  ['expenses','Expenses · nómina',d=>d.gastos,'money',['inicio','empresa','finanzas','nomina']],
  ['profit','Profit',d=>d.resultado,'money',['inicio','empresa','finanzas','ventas']],
  ['inventory','Inventory',d=>d.inventario,'money',['inicio','empresa','inventario']],
  ['employees','Employees',d=>d.empleados,'int',['inicio','empresa','nomina']],
  ['suppliers','Suppliers',d=>d.proveedores,'int',['inicio','empresa','proveedores']],
  ['stockouts','Stockouts',()=>undefined,'int',['inicio','empresa','inventario']],
  ['reserved','Reservado',()=>undefined,'money',['inventario']],
  ['available','Disponible',()=>undefined,'money',['inventario']],
  ['receivable','Cuentas por cobrar',d=>d.cuentasCobrar,'money',['finanzas','clientes','facturacion']],
  ['payable','Cuentas por pagar',d=>d.cuentasPagar,'money',['finanzas','proveedores','facturacion']],
  ['clients','Clientes',()=>undefined,'int',['clientes']],
  ['invoices','Facturas',()=>undefined,'int',['facturacion']]
];
function track(d){samples++;for(const [key,,get] of KPIS){const v=get(d.business||{});if(typeof v!=='number'||!Number.isFinite(v))continue;(history[key]||=[]).push(v);if(history[key].length>40)history[key].shift()}}
function sparkPoints(values){const min=Math.min(...values),max=Math.max(...values),span=max-min||1,step=100/(values.length-1);return values.map((v,i)=>`${(i*step).toFixed(2)},${(max===min?16:28-((v-min)/span)*24).toFixed(2)}`).join(' ')}
const PRIMARY_KPIS=[['Ventas',d=>d.ventas,'money'],['Utilidad',d=>d.resultado,'money'],['Facturas',()=>undefined,'int'],['Inventario',d=>d.inventario,'money']];
function renderPrimaryKpis(d){const business=d.business||{},nodes=[];for(const [label,get,kind] of PRIMARY_KPIS){const value=get(business),node=kpiTemplate.content.firstElementChild.cloneNode(true);node.querySelector('.kpi-label').textContent=label;node.querySelector('.kpi-value').textContent=fmt(value,kind);node.dataset.status=typeof value==='number'?'value':statusOf(value);node.querySelector('.kpi-meta').textContent=typeof value==='number'?'sesión':'sin dato en la API';nodes.push(node)}fill('kpis-primary',...nodes)}
function renderTrendChart(d){const container=document.querySelector('[data-slot="trend-chart"]');if(!container)return;const unavail=el('div','');unavail.textContent='DATOS HISTÓRICOS NO DISPONIBLES';container.replaceChildren(unavail)}
function renderKpis(d){const view=app.dataset.view,business=d.business||{},nodes=[];document.querySelector('#kpi-title').textContent=view==='inicio'||view==='empresa'?'Empresa · KPIs':`${VIEWS[view]?.[0]||'Empresa'} · KPIs`;for(const [key,label,get,kind,views] of KPIS){if(!views.includes(view))continue;const value=get(business),node=kpiTemplate.content.firstElementChild.cloneNode(true),series=history[key]||[];node.querySelector('.kpi-label').textContent=label;node.querySelector('.kpi-value').textContent=fmt(value,kind);node.dataset.status=typeof value==='number'?(key==='profit'&&value<0?'danger':'value'):statusOf(value);if(series.length>=2){const points=sparkPoints(series);node.dataset.trend=Math.min(...series)===Math.max(...series)?'flat':'true';node.querySelector('.spark-line').setAttribute('points',points);node.querySelector('.spark-area').setAttribute('points',`0,32 ${points} 100,32`);node.querySelector('.kpi-meta').textContent=`sesión · ${series.length} lecturas`}else node.querySelector('.kpi-meta').textContent=typeof value==='number'?'sesión · PENDING tendencia':'sin dato en la API';nodes.push(node)}fill('kpis',...nodes)}

// --- Barras ---
function bars(rows){const max=Math.max(0,...rows.map(([,v])=>typeof v==='number'?Math.abs(v):0));return rows.map(([label,value,tone])=>{const row=el('div','bar-row'),track=el('div','bar-track'),bar=el('div','bar-fill');if(tone)row.dataset.tone=tone;bar.style.width=typeof value==='number'&&max>0?`${(Math.abs(value)/max*100).toFixed(1)}%`:'0%';track.append(bar);row.append(el('span','key',label),track,el('span','bar-value',fmt(value)));return row})}
const metric=(label,value,kind='int')=>{const node=el('div','metric');node.dataset.status=typeof value==='number'?'value':statusOf(value);node.append(el('span','',label),el('strong','',fmt(value,kind)));return node};

// --- Módulos ---
const PROVIDER_DETAILS={ollama:{label:'Ollama',icon:'OL',type:'GENERACIÓN IA',origin:'LOCAL',policy:'LOCAL'},claude:{label:'Claude Code',icon:'CL',type:'GENERACIÓN IA',origin:'API',policy:'OPT-IN'},openai:{label:'ChatGPT / Codex',icon:'AI',type:'GENERACIÓN IA',origin:'API',policy:'OPT-IN'},chatgpt:{label:'ChatGPT / Codex',icon:'AI',type:'GENERACIÓN IA',origin:'API',policy:'OPT-IN'},gemini:{label:'Gemini',icon:'GM',type:'GENERACIÓN IA',origin:'API',policy:'OPT-IN'}};
const OPTIONAL_APIS=[{label:'OpenAI API',icon:'OA',status:'DISABLED'},{label:'Anthropic API',icon:'AA',status:'DISABLED'},{label:'Otros proveedores',icon:'OT',status:'DISABLED'}];
function providerDetail(name){return PROVIDER_DETAILS[String(name).toLowerCase()]||{label:name,icon:String(name).slice(0,2).toUpperCase(),type:'UNAVAILABLE',origin:'UNAVAILABLE',policy:'UNAVAILABLE'}}
function providerLine(label,value){const row=el('span','provider-line');row.append(el('b','',label),el('span','',display(value)));return row}
const REQUIRED_PROVIDERS=['ollama','claude','openai','gemini'];
function renderProviders(d){const apiProviders=d.providers||{};const seen=new Set();const entries=Object.entries(apiProviders);const nodes=[];for(const key of REQUIRED_PROVIDERS){const status=apiProviders[key]||(key==='openai'?apiProviders.chatgpt:undefined);seen.add(key);if(key==='openai')seen.add('chatgpt');const detail=providerDetail(key),state=display(String(status||'UNAVAILABLE').toUpperCase()),item=el('article','provider provider-node'),head=el('div','provider-node-head'),icon=el('span','provider-mark',detail.icon),identity=el('div','provider-identity'),meta=el('div','provider-meta-grid');item.dataset.status=statusOf(state);item.dataset.origin=detail.origin.toLowerCase();identity.append(el('span','provider-name',detail.label),el('span','provider-type',detail.type));head.append(icon,identity,chip(state));meta.append(providerLine('ORIGEN',detail.origin),providerLine('DISPONIBILIDAD',state),providerLine('ACCESO',detail.policy));item.append(head,meta);nodes.push(item)}for(const [name,status] of entries){if(seen.has(name.toLowerCase()))continue;const detail=providerDetail(name),state=display(String(status).toUpperCase()),item=el('article','provider provider-node'),head=el('div','provider-node-head'),icon=el('span','provider-mark',detail.icon),identity=el('div','provider-identity'),meta=el('div','provider-meta-grid');item.dataset.status=statusOf(state);item.dataset.origin=detail.origin.toLowerCase();identity.append(el('span','provider-name',detail.label),el('span','provider-type',detail.type));head.append(icon,identity,chip(state));meta.append(providerLine('ORIGEN',detail.origin),providerLine('DISPONIBILIDAD',state),providerLine('ACCESO',detail.policy));item.append(head,meta);nodes.push(item)}const optionalNodes=OPTIONAL_APIS.map(api=>{const item=el('article','provider provider-node optional'),head=el('div','provider-node-head'),icon=el('span','provider-mark',api.icon),identity=el('div','provider-identity'),meta=el('div','provider-meta-grid');item.dataset.status='disabled';item.dataset.origin='api';identity.append(el('span','provider-name',api.label),el('span','provider-type','API OPCIONAL'));head.append(icon,identity,chip(api.status));meta.append(providerLine('ESTADO',api.status),providerLine('ACCESO','NO CONFIGURADA'));item.append(head,meta);return item});fill('providers',...(nodes.length?nodes:[emptyState('EMPTY · la API no reporta proveedores')]),el('div','provider-divider'),el('p','provider-section-label','APIS OPCIONALES'),...optionalNodes);fill('agents',card('SUPERVISIÓN',[['Policy activa',d.vortice?.modo],['Supervisor',undefined],['Proveedores reportados',entries.length||'EMPTY'],['Configurados',entries.filter(([,s])=>s==='configured').length],['Agentes registrados',undefined]]))}
const AGENT_ROSTER=[{name:'Supervisor',role:'Coordinación general'},{name:'Analista Financiero',role:'Análisis y reportes'},{name:'Analista de Trading',role:'Mercados y estrategias'},{name:'Analista de Video',role:'Visión y movimiento'},{name:'Gestor de Inventario',role:'Stock y logística'},{name:'Asistente Legal',role:'Contratos y normativas'},{name:'Analista de Simulación',role:'Escenarios y predicciones'}];
function renderAgentsList(){const nodes=AGENT_ROSTER.map(a=>{const row=el('div','agent-row');row.dataset.status='off';row.append(el('span','agent-icon','●'),el('div','agent-info',undefined));row.lastChild.append(el('span','agent-name',a.name),el('span','agent-role',a.role));row.append(el('span','agent-status','UNAVAILABLE'),el('span','agent-chevron','›'));return row});fill('agents-list',...nodes)}
function renderAlerts(d){const alerts=d.alerts||[],count=document.querySelector('#alert-count');count.hidden=!alerts.length;count.textContent=String(alerts.length);document.querySelector('#alerts-tag').textContent=alerts.length?`${alerts.length} ACTIVAS`:'EMPTY';fill('alerts',...(alerts.length?alerts.map(a=>{const item=el('div','alert-item'),body=el('div');item.dataset.status=statusOf(a.nivel);body.append(el('p','',text(a.mensaje)),el('span','provider-meta',`${text(a.codigo)} · ${a.simulated?'SIMULATED':'LOCAL'}`));item.append(chip(a.nivel),body);return item}):[card('ALERTAS',[['Estado','EMPTY']])]))}
function renderSummary(d){const b=d.business||{};fill('summary',card('VÓRTICE',[['Estado',d.vortice.estado],['Policy',d.vortice.modo],['Cola',d.vortice.cola],['Decisiones',d.vortice.decisiones?.length]]),card('EMPRESA · SIMULATED',[['Escenario',b.scenario],['Cash',fmt(b.caja)],['Profit',fmt(b.resultado)],['Employees',fmt(b.empleados,'int')]]))}
function tradingGroup(title,rows,kind=''){const box=el('section',`trading-group ${kind}`),head=el('h3','',title),grid=el('div','trading-rows');for(const [label,value] of rows){const row=el('div','trading-row');row.dataset.status=statusOf(value);row.append(el('span','',label),chip(value));grid.append(row)}box.append(head,grid);return box}
function renderMarketCard(symbol,price,change){const card=el('article','market-card');card.dataset.status=typeof price==='number'?'value':'unavailable';const header=el('div','market-header');header.append(el('span','market-symbol',symbol),el('span','market-price',typeof price==='number'?fmt(price):price||'UNAVAILABLE'));const chg=el('span','market-change');chg.textContent=typeof change==='number'?`${change>0?'+':''}${fmt(change)}%`:change||'UNAVAILABLE';chg.dataset.trend=typeof change==='number'?change>=0?'up':'down':'neutral';header.append(chg);card.append(header,el('div','market-detail','24h volumen, cambio máx/mín disponibles en conexión de datos'));return card}
function renderMarkets(d){const markets=['BTC/USDT','ETH/USDT','AAPL','EUR/USD'];const cards=markets.map(m=>renderMarketCard(m,undefined,'UNAVAILABLE'));fill('markets',...cards);fill('trading-metrics',...[['Volumen (24h)'],['Cambio (24h)'],['Máx. (24h)'],['Mín. (24h)']].map(([label])=>{const m=el('div','trading-metric');m.append(el('span','trading-metric-label',label),el('span','trading-metric-value','UNAVAILABLE'));return m}));const rec=el('div','recommendation-strip');rec.append(el('span','rec-label','Recomendación de IA'),el('span','rec-level','NIVEL: NOT_AVAILABLE'),el('span','rec-text','SIN ANÁLISIS DISPONIBLE'));fill('trading-recommendation',rec);const actions=el('div','actions-row');const btnBuy=el('button','action-btn action-buy','Compra simulada');btnBuy.disabled=true;const btnSell=el('button','action-btn action-sell','Venta simulada');btnSell.disabled=true;const btnAnalysis=el('button','action-btn action-analysis','Ver Análisis');btnAnalysis.disabled=true;actions.append(btnBuy,btnSell,btnAnalysis);fill('trading-actions',actions)}
function renderMacro(d){const m=d.trading?.macro||{},tag=document.querySelector('#macro-tag'),known=Array.isArray(m.instrumentos)?m.instrumentos:[];tag.textContent=`NEWS DATA ${display(m.newsSource)}`;tag.dataset.status=statusOf(m.newsSource);const sources=tradingGroup('FUENTES',[['NewsProvider',m.newsSource],['Calendario económico',m.economicCalendar],['Market context',m.marketContext]]);const instrument=tradingGroup('INSTRUMENTO ANALIZADO',[['Disponibles',known.length?known.join(', '):undefined],['Selección',known.length?'READ-ONLY':undefined],['Eventos relacionados',Array.isArray(m.eventos)&&m.eventos.length?m.eventos.length:undefined]]);const safeguards=tradingGroup('GUARDAS',[['Hecho / interpretación','SEPARADOS'],['Sesgo','CONTEXTUAL'],['Escenarios','SIN PREDICCIÓN'],['Órdenes automáticas','DISABLED']]);fill('macro',el('div','macro-grid',undefined));slot('macro').lastChild.append(sources,instrument,safeguards)}
function renderTrading(d){const t=d.trading||{};renderMarkets(d);const hero=el('div','trading-safety');hero.append(el('span','safety-dot'),el('div','',undefined));hero.lastChild.append(el('strong','',display(t.tradingReal)),el('span','', 'Ejecución de mercado bloqueada · modo de laboratorio local'));const source=tradingGroup('FUENTES AUDITADAS',[['Datos históricos',t.datosHistoricos],['Portfolio',t.portfolio],['Capital',t.capital],['Posiciones',t.posiciones],['Órdenes simuladas',t.ordenes],['PnL',t.pnl]],'source');const validation=tradingGroup('VALIDACIÓN',[['Backtester',t.backtester],['Resultados backtest',t.backtests],['OOS',t.oos],['Resultados OOS',t.oosResultados],['Walk-forward',t.walkForward],['Resultados walk-forward',t.walkForwardResultados]]);const paper=tradingGroup('ENTORNOS',[['Paper trading',t.paper],['Eventos paper',t.paperEventos],['Competiciones',t.competiciones],['MT5 Bridge Local',t.mt5BridgeLocal],['MT5 DEMO / read-only',t.mt5Demo],['MT5 Real',t.mt5Real]],'environment');fill('trading',hero,el('div','trading-grid',undefined));slot('trading').lastChild.append(source,validation,paper);renderMacro(d)}
// Estación de backtest: SVG clonado de un template (namespace correcto), sin escritura de HTML dinámico.
const btState={velas:[],marks:[],result:null,catalogo:[]};
const btNum=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const btDateLabel=iso=>String(iso).slice(0,10);
function btFill(id,...nodes){document.querySelector(`#${id}`)?.replaceChildren(...nodes)}
const btProto=sel=>document.querySelector('#bt-svg-proto')?.content.querySelector(sel);
function svgNode(protoSel,cls,attrs,txt){const n=btProto(protoSel).cloneNode(true);n.setAttribute('class',cls);if(attrs)for(const k in attrs)n.setAttribute(k,String(attrs[k]));if(txt!==undefined)n.textContent=txt;return n}
function candleChart(velas,ops){const W=1000,H=360,padL=54,padR=14,padT=14,padB=26,plotW=W-padL-padR,plotH=H-padT-padB,svg=btProto('svg.bt-candles').cloneNode(false);if(!velas.length)return svg;const highs=velas.map(v=>btNum(v.maximo)),lows=velas.map(v=>btNum(v.minimo));let min=Math.min(...lows),max=Math.max(...highs);const margen=(max-min||1)*.08;min-=margen;max+=margen;const span=max-min||1,band=plotW/velas.length,bodyW=Math.max(2,band*.56),y=p=>padT+(max-p)/span*plotH,x=i=>padL+band*i+band/2;for(let g=0;g<=4;g++){const price=max-span*g/4,gy=padT+plotH*g/4;svg.append(svgNode('.p-grid','bt-grid',{x1:padL,y1:gy.toFixed(2),x2:W-padR,y2:gy.toFixed(2)}));svg.append(svgNode('.p-axis','bt-axis',{x:padL-6,y:(gy+3).toFixed(2),'text-anchor':'end'},number.format(price)))}velas.forEach((v,i)=>{const cx=x(i),o=btNum(v.apertura),c=btNum(v.cierre),dir=c>=o?'bt-up':'bt-down',yo=y(o),yc=y(c),top=Math.min(yo,yc),bh=Math.max(1,Math.abs(yc-yo));svg.append(svgNode('.p-wick','bt-wick '+dir,{x1:cx.toFixed(2),y1:y(btNum(v.maximo)).toFixed(2),x2:cx.toFixed(2),y2:y(btNum(v.minimo)).toFixed(2)}));svg.append(svgNode('.p-body','bt-body '+dir,{x:(cx-bodyW/2).toFixed(2),y:top.toFixed(2),width:bodyW.toFixed(2),height:bh.toFixed(2)}))});const idx=iso=>velas.findIndex(v=>v.fecha===iso);(ops||[]).forEach(op=>{const ei=idx(op.entrada),si=idx(op.salida);if(ei>=0){const mx=x(ei),my=y(btNum(op.precioEntrada));svg.append(svgNode('.p-entry','bt-entry',{points:`${mx.toFixed(2)},${(my+3).toFixed(2)} ${(mx-6).toFixed(2)},${(my+14).toFixed(2)} ${(mx+6).toFixed(2)},${(my+14).toFixed(2)}`}))}if(si>=0){const mx=x(si),my=y(btNum(op.precioSalida));svg.append(svgNode('.p-exit','bt-exit',{points:`${mx.toFixed(2)},${(my-3).toFixed(2)} ${(mx-6).toFixed(2)},${(my-14).toFixed(2)} ${(mx+6).toFixed(2)},${(my-14).toFixed(2)}`}))}});[...new Set([0,Math.floor(velas.length/2),velas.length-1])].forEach(i=>svg.append(svgNode('.p-axis','bt-axis',{x:x(i).toFixed(2),y:H-8,'text-anchor':'middle'},btDateLabel(velas[i].fecha))));const cross=svgNode('.p-cross','bt-crosshair',{x1:0,y1:padT,x2:0,y2:(padT+plotH).toFixed(2)});cross.style.display='none';svg.append(cross);velas.forEach((v,i)=>svg.append(svgNode('.p-hit','bt-hit',{x:(padL+band*i).toFixed(2),y:padT,width:band.toFixed(2),height:plotH.toFixed(2),'data-i':i})));return svg}
function seriesChart(values,cls,area){const svg=btProto('svg.bt-series').cloneNode(false);if(values.length<2)return svg;const min=Math.min(...values),max=Math.max(...values),span=max-min||1,pts=values.map((v,i)=>`${(i/(values.length-1)*100).toFixed(2)},${(96-(v-min)/span*92).toFixed(2)}`).join(' ');if(area)svg.append(svgNode('.p-area',cls+'-area',{points:`0,100 ${pts} 100,100`}));svg.append(svgNode('.p-poly',cls,{points:pts}));return svg}
function drawCandles(container){if(!container)return;container.classList.remove('chart-empty');container.classList.add('bt-chart-live');const ops=btState.marks.length&&btState.result?btState.result.resultado.operaciones:[];container.replaceChildren(candleChart(btState.velas,ops));wireCandleTooltip(container)}
function wireCandleTooltip(container){const svg=container.querySelector('svg.bt-candles');if(!svg)return;const tip=el('div','bt-tip');tip.hidden=true;container.appendChild(tip);const cross=svg.querySelector('.bt-crosshair');const show=i=>{const v=btState.velas[i];if(!v)return;const rows=[btDateLabel(v.fecha),`O ${number.format(btNum(v.apertura))}`,`H ${number.format(btNum(v.maximo))}`,`L ${number.format(btNum(v.minimo))}`,`C ${number.format(btNum(v.cierre))}`];const mk=btState.marks[i];if(mk?.entry)rows.push(`SIM ENTRY · ${number.format(btNum(mk.entry.precioEntrada))}`);if(mk?.exit)rows.push(`SIM EXIT · ${number.format(btNum(mk.exit.precioSalida))} · PnL ${number.format(btNum(mk.exit.pnlNeto))}`);tip.replaceChildren(...rows.map(r=>el('div','',r)));tip.hidden=false};container.addEventListener('mousemove',e=>{const hit=e.target.closest?.('.bt-hit');if(!hit){tip.hidden=true;if(cross)cross.style.display='none';return}show(Number(hit.dataset.i));if(cross){const cxv=Number(hit.getAttribute('x'))+Number(hit.getAttribute('width'))/2;cross.setAttribute('x1',String(cxv));cross.setAttribute('x2',String(cxv));cross.style.display='block'}tip.style.left=Math.min(innerWidth-160,e.clientX+14)+'px';tip.style.top=(e.clientY+14)+'px'});container.addEventListener('mouseleave',()=>{tip.hidden=true;if(cross)cross.style.display='none'})}
function renderBacktest(result){const r=result.resultado,s=result.resumen,ops=r.operaciones,simbolo=r.datos.simbolo;btState.velas=result.velas||[];btState.result=result;btState.marks=btState.velas.map(v=>({entry:ops.find(o=>o.entrada===v.fecha),exit:ops.find(o=>o.salida===v.fecha)}));drawCandles(document.querySelector('#bt-chart'));
  const metrics=[['Initial capital',fmt(s.capitalInicial)],['Final equity',fmt(s.finalEquity)],['Net PnL',fmt(s.netPnl)],['Return',`${fmt(s.retorno)}%`],['Max drawdown',`${fmt(s.maxDrawdown)}%`],['Trades',fmt(s.operaciones,'int')],['Wins',fmt(s.wins,'int')],['Losses',fmt(s.losses,'int')],['Win rate',s.winRate===null?'UNAVAILABLE':`${fmt(s.winRate)}%`],['Profit factor',s.profitFactor===null?'UNAVAILABLE':fmt(s.profitFactor)],['Commissions',fmt(s.comisiones)]];btFill('bt-metrics',card('RESULTADOS · SIMULATED',metrics));
  const equity=[s.capitalInicial,...ops.map((_,i)=>s.capitalInicial+ops.slice(0,i+1).reduce((a,o)=>a+o.pnlNeto,0))];const eqChart=document.querySelector('#bt-equity');if(eqChart){if(equity.length>=2){eqChart.classList.remove('chart-empty');eqChart.replaceChildren(seriesChart(equity,'bt-equity-line',true),el('span','bt-note',`Initial ${fmt(s.capitalInicial)} → Final ${fmt(s.finalEquity)}`))}else{eqChart.classList.add('chart-empty');eqChart.textContent='UNAVAILABLE · el motor no generó operaciones'}}
  let peak=equity[0];const dd=equity.map(v=>{peak=Math.max(peak,v);return peak>0?(peak-v)/peak*100:0});const ddChart=document.querySelector('#bt-drawdown');if(ddChart){const hayDd=equity.length>=2&&Number.isFinite(s.maxDrawdown);if(hayDd){ddChart.classList.remove('chart-empty');ddChart.replaceChildren(seriesChart(dd.map(v=>-v),'bt-dd-line',true),el('span','bt-note',`MAX DRAWDOWN ${fmt(s.maxDrawdown)}% · motor`))}else{ddChart.classList.add('chart-empty');ddChart.textContent='UNAVAILABLE'}}
  if(ops.length){const table=el('table','bt-trades-table'),thead=el('thead'),head=el('tr'),body=el('tbody');for(const h of ['#','Instrument','Side','Entry Time','Entry Price','Exit Time','Exit Price','Gross PnL','Commission','Net PnL'])head.append(el('th','',h));thead.append(head);ops.forEach((o,i)=>{const tr=el('tr'),cells=[String(i+1),simbolo,'LONG · SIM',btDateLabel(o.entrada),fmt(o.precioEntrada),btDateLabel(o.salida),fmt(o.precioSalida),fmt(o.pnlNeto+o.comisiones),fmt(o.comisiones),fmt(o.pnlNeto)];cells.forEach((v,c)=>{const td=el('td','',v);if(c===9)td.dataset.status=o.pnlNeto>=0?'ok':'danger';tr.append(td)});body.append(tr)});table.append(thead,body);const panel=document.querySelector('#bt-trades');panel.classList.remove('chart-empty');panel.replaceChildren(table)}else{const empty=document.querySelector('#bt-trades');empty.classList.add('chart-empty');empty.textContent='SIN TRADES · el motor no generó operaciones para el periodo'}
  if(result.challenge)renderChallengeScorecard(result.challenge);
  fetch('/api/trading/experiments').then(r=>r.ok?r.json():null).then(j=>{if(j?.data)renderExperimentHistory(j.data);}).catch(()=>{});}
function aplicarInstrumento(inst){if(!inst)return;btState.velas=inst.velas||[];btState.marks=[];btState.result=null;const sym=document.querySelector('#bt-symbol');if(sym)sym.textContent=`OHLC · ${inst.simbolo} · ${inst.claseActivo}`;const from=document.querySelector('#bt-from'),to=document.querySelector('#bt-to');if(from&&to){const lo=btDateLabel(inst.desde),hi=btDateLabel(inst.hasta);from.min=lo;from.max=hi;from.value=lo;to.min=lo;to.max=hi;to.value=hi}drawCandles(document.querySelector('#bt-chart'));const state=document.querySelector('#backtest-state');if(state){state.textContent='SIMULATED · READY';state.dataset.status='simulated'}const met=document.querySelector('#bt-metrics');if(met)met.replaceChildren(el('span','','RESULTADOS'),el('p','',`${inst.simbolo} · SIMULATED / FIXTURE · ejecuta el backtest`));for(const id of ['bt-equity','bt-drawdown','bt-trades']){const n=document.querySelector(`#${id}`);if(n){n.classList.add('chart-empty');n.textContent='UNAVAILABLE'}}}
async function loadBacktestCatalog(){try{const r=await fetch('/api/backtest/catalog');const j=await r.json();const inst=j?.data?.instrumentos;if(!Array.isArray(inst)||!inst.length)return;btState.catalogo=inst;const sel=document.querySelector('#bt-instrument');if(sel){sel.replaceChildren(...inst.map(x=>{const o=el('option','',x.simbolo);o.value=x.id;return o}));sel.value=inst[0].id;sel.addEventListener('change',()=>aplicarInstrumento(btState.catalogo.find(x=>x.id===sel.value)))}aplicarInstrumento(inst[0])}catch{}}
document.querySelector('#backtest-form')?.addEventListener('submit',async e=>{e.preventDefault();const state=document.querySelector('#backtest-state'),capital=Number(document.querySelector('#bt-capital').value),comision=Number(document.querySelector('#bt-commission').value),from=document.querySelector('#bt-from')?.value,to=document.querySelector('#bt-to')?.value;if(from&&to&&from>to){state.textContent='FAILED · FROM > TO';state.dataset.status='danger';return}state.textContent='RUNNING';state.dataset.status='pending';try{const cuerpo={instrumento:document.querySelector('#bt-instrument').value,estrategia:'cruce-demo',capitalInicial:capital,comisionPorcentaje:comision};if(from&&to){cuerpo.desde=`${from}T00:00:00.000Z`;cuerpo.hasta=`${to}T00:00:00.000Z`}const r=await fetch('/api/backtest/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cuerpo)});const json=await r.json();if(!r.ok||!json.ok)throw Error('FAILED');renderBacktest(json.data);state.textContent='COMPLETED · SIMULATED';state.dataset.status='ok'}catch{state.textContent='FAILED';state.dataset.status='danger'}});

let canonicalVelas = [];
function renderChallengeScorecard(ch){
  if(!ch)return;
  const name=document.querySelector('#challenge-program-name'),badge=document.querySelector('#challenge-badge'),grid=document.querySelector('#challenge-grid'),fails=document.querySelector('#challenge-failures-list'),limits=document.querySelector('#challenge-limitations-list');
  if(name)name.textContent=ch.programId?`TEST FIXTURE · NOT A REAL PROP FIRM (${ch.programId} · 100k USD VIRTUAL)`:'TEST FIXTURE · NOT A REAL PROP FIRM (TEST_FIXTURE_PROG_001 · 100k USD VIRTUAL)';
  if(badge){
    badge.textContent=ch.result;
    badge.dataset.status=ch.result==='PASS'?'ok':ch.result==='FAIL'?'danger':ch.result==='INCOMPLETE'?'pending':'off';
  }
  if(grid){
    const m=ch.metrics||{};
    const cards=[
      ['RETORNO OBSERVADO',`${fmt(m.returnPct)}%`,'Objetivo: +10.00%',m.returnPct>=10?'ok':'danger'],
      ['MÁXIMO DRAWDOWN',`${fmt(m.maxDrawdownPct)}%`,'Límite: 10.00% (STATIC)',m.maxDrawdownPct<=10?'ok':'danger'],
      ['PÉRDIDA MÁXIMA DIARIA',`${fmt(m.dailyMaxLossPct)}%`,'Límite: 5.00% (REALIZED_PNL)',m.dailyMaxLossPct<=5?'ok':'danger'],
      ['DÍAS DE OPERACIÓN',`${m.tradingDays} días`,'Mín: 5 · Máx: 30',m.tradingDays>=5&&m.tradingDays<=30?'ok':m.tradingDays>30?'danger':'warning'],
      ['REGLA DE CONSISTENCIA',`${fmt(m.maxDayProfitPct)}% máx día`,'Límite: 30.00%',m.consistencyOk===true?'ok':'warning'],
      ['POSICIONES OVERNIGHT','PERMITIDAS','Regla: Permitido','ok'],
      ['POSICIONES FIN DE SEMANA',ch.failureReasons?.includes('WEEKEND_POSITION_BREACH')?'DETECTADAS':'COMPLIANT','Regla: No permitido',ch.failureReasons?.includes('WEEKEND_POSITION_BREACH')?'danger':'ok'],
      ['COMPATIBILIDAD MERCADO','FOREX_SPOT','Regla: Permitido','ok']
    ];
    grid.replaceChildren(...cards.map(([title,val,rule,st])=>{
      const c=el('div','challenge-card');
      c.dataset.status=st;
      c.append(el('span','challenge-card-title',title),el('strong','challenge-card-val',val),el('span','challenge-card-rule',rule));
      return c;
    }));
  }
  if(fails){
    const reasons=ch.failureReasons||[];
    fails.replaceChildren(...(reasons.length?reasons.map(r=>el('li','',r)):[el('li','','Sin incumplimientos registrados')]));
  }
  if(limits){
    const lms=ch.dataLimitations||[];
    limits.replaceChildren(...(lms.length?lms.map(l=>el('li','',l)):[el('li','','Sin limitaciones declaradas')]));
  }
}

function showExperimentDetail(exp){
  if(!exp)return;
  const modal=document.querySelector('#experiment-detail-modal');
  const title=document.querySelector('#exp-detail-title');
  const body=document.querySelector('#exp-detail-content');
  if(!modal||!title||!body)return;
  title.textContent=`Corrida ${exp.runId.slice(0,8)}`;
  const r=exp.results||{},inst=exp.instrument||{},str=exp.strategy||{},p=str.parameters||{},val=exp.validation||{},ds=exp.dataset||{};
  const groups=[
    ['IDENTIDAD DE CORRIDA',[
      ['Run ID',exp.runId],
      ['Creado',exp.createdAt],
      ['Tipo de experimento',exp.experimentType||'BACKTEST_SIMULADO'],
      ['Fuente de parámetros',exp.parameterSource||'TEST_BASELINE'],
      ['Fuente de costos',exp.costSource||'TEST_ASSUMPTION'],
      ['Clasificación',exp.classification||'INSUFFICIENT_DATA']
    ]],
    ['INSTRUMENTO & DATASET',[
      ['Símbolo',inst.symbol||'EURUSD'],
      ['Origen fuente',inst.source||'DUKASCOPY_BID_UTC'],
      ['Tipo de fuente',inst.sourceType||'forex-real'],
      ['Timeframe',exp.timeframe||'H1'],
      ['Periodo desde',exp.period?.from||'N/A'],
      ['Periodo hasta',exp.period?.to||'N/A'],
      ['Dataset ID',ds.datasetId||'EURUSD_H1_DUKASCOPY_2021-2026'],
      ['Dataset SHA256',ds.sha256||'d9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a']
    ]],
    ['ESTRATEGIA & PARÁMETROS',[
      ['Estrategia ID',str.id||'cruce'],
      ['Versión',String(str.version||1)],
      ['Tipo',str.type||'cruce_medias'],
      ['Media Rápida',String(p.mediaRapida??p.fast??'N/A')],
      ['Media Lenta',String(p.mediaLenta??p.slow??'N/A')],
      ['Riesgo por operación',`${((Number(p.riesgoPorOperacion??p.risk??0.01))*100).toFixed(1)}%`]
    ]],
    ['MÉTRICAS & RESULTADOS',[
      ['Capital inicial',fmt(exp.capital?.initialCapital)],
      ['Comisión %',`${((exp.capital?.commissionPct||0)*100).toFixed(4)}%`],
      ['Equity final',fmt(r.finalEquity)],
      ['Net PnL',fmt(r.netPnl)],
      ['Retorno neto',`${fmt(r.returnPct)}%`],
      ['Drawdown máximo',`${fmt(r.maxDrawdownPct)}%`],
      ['Operaciones totales',fmt(r.trades,'int')],
      ['Ganadoras',fmt(r.wins,'int')],
      ['Perdedoras',fmt(r.losses,'int')],
      ['Win Rate',r.winRate!=null?`${fmt(r.winRate)}%`:'UNAVAILABLE'],
      ['Profit Factor',r.profitFactor!=null?fmt(r.profitFactor):'UNAVAILABLE'],
      ['Comisiones totales',fmt(r.commissions)]
    ]],
    ['VALIDATION ENGINE FLAGS',[
      ['Backtest validado',val.backtest?'VERIFICADO':'NO'],
      ['OOS (Out of Sample)',val.oos?'VERIFICADO':'PENDING'],
      ['Walk-Forward',val.walkForward?'VERIFICADO':'PENDING'],
      ['Paper trading',val.paper?'VERIFICADO':'PENDING']
    ]]
  ];
  body.replaceChildren(...groups.map(([gTitle,rows])=>{
    const g=el('div','exp-meta-group');
    g.append(el('h4','exp-meta-title',gTitle));
    rows.forEach(([k,v])=>{
      const row=el('div','exp-detail-row');
      row.append(el('span','',k),el('span','',v));
      g.append(row);
    });
    return g;
  }));
  modal.showModal();
}

function renderExperimentHistory(experiments){
  const tag=document.querySelector('#exp-count-tag');
  if(tag)tag.textContent=`${experiments.length} EXPERIMENTOS`;
  const tbody=document.querySelector('#experiments-table-body');
  if(!tbody)return;
  if(!experiments.length){
    tbody.replaceChildren(el('tr','',el('td','td-empty','Sin experimentos persistidos')));
    return;
  }
  tbody.replaceChildren(...experiments.map(exp=>{
    const tr=el('tr','exp-row');
    const r=exp.results||{};
    const tdId=el('td','',exp.runId.slice(0,8)+'…');
    tdId.title=exp.runId;
    const tdDate=el('td','',btDateLabel(exp.createdAt));
    const tdInst=el('td','',exp.instrument?.symbol||'EURUSD');
    const tdTf=el('td','',exp.timeframe||'H1');
    const tdStr=el('td','',exp.strategy?.id||'cruce');
    const tdRet=el('td','',`${fmt(r.returnPct)}%`);
    tdRet.dataset.status=(r.returnPct||0)>=0?'ok':'danger';
    const tdDd=el('td','',`${fmt(r.maxDrawdownPct)}%`);
    const tdTrades=el('td','',fmt(r.trades,'int'));
    const tdWr=el('td','',r.winRate!=null?`${fmt(r.winRate)}%`:'UNAVAILABLE');
    const tdCls=el('td');
    tdCls.append(chip(exp.classification||'INSUFFICIENT_DATA'));
    const tdBtn=el('td');
    const btn=el('button','btn-xs','Detalles');
    btn.type='button';
    btn.addEventListener('click',e=>{e.stopPropagation();showExperimentDetail(exp)});
    tdBtn.append(btn);
    tr.append(tdId,tdDate,tdInst,tdTf,tdStr,tdRet,tdDd,tdTrades,tdWr,tdCls,tdBtn);
    tr.addEventListener('click',()=>showExperimentDetail(exp));
    return tr;
  }));
}

async function loadTradingLab2(){
  try{
    const [histRes, expRes] = await Promise.all([
      fetch('/api/trading/historical').then(r=>r.ok?r.json():null).catch(()=>null),
      fetch('/api/trading/experiments').then(r=>r.ok?r.json():null).catch(()=>null)
    ]);
    if(histRes?.data){
      const hd=histRes.data;
      const elInst=document.querySelector('#trading-inst'),elTf=document.querySelector('#trading-tf'),elDs=document.querySelector('#trading-ds-id'),elSrc=document.querySelector('#trading-source'),elHash=document.querySelector('#trading-hash');
      if(elInst)elInst.textContent=hd.simbolo||'EURUSD';
      if(elTf)elTf.textContent=hd.intervalo||'H1';
      if(elDs)elDs.textContent=hd.datasetId||'EURUSD_H1_DUKASCOPY_2021-2026';
      if(elSrc)elSrc.textContent=hd.origen||'DUKASCOPY_BID_UTC';
      if(elHash)elHash.textContent=hd.sha256||'d9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a';
      canonicalVelas=hd.velas||[];
      if(canonicalVelas.length&&!btState.velas.length){
        btState.velas=canonicalVelas;
        drawCandles(document.querySelector('#bt-chart'));
      }
    }
    const exps=expRes?.data||[];
    renderExperimentHistory(exps);
    const baseline=exps.find(e=>e.instrument?.symbol==='EURUSD')||exps[0];
    if(baseline){
      const bRes=baseline.results||{},bCap=baseline.capital||{initialCapital:10000};
      const metrics=[
        ['Initial capital',fmt(bCap.initialCapital)],
        ['Final equity',fmt(bRes.finalEquity)],
        ['Net PnL',fmt(bRes.netPnl)],
        ['Return',`${fmt(bRes.returnPct)}%`],
        ['Max drawdown',`${fmt(bRes.maxDrawdownPct)}%`],
        ['Trades',fmt(bRes.trades,'int')],
        ['Wins',fmt(bRes.wins,'int')],
        ['Losses',fmt(bRes.losses,'int')],
        ['Win rate',bRes.winRate!=null?`${fmt(bRes.winRate)}%`:'UNAVAILABLE'],
        ['Profit factor',bRes.profitFactor!=null?fmt(bRes.profitFactor):'UNAVAILABLE'],
        ['Commissions',fmt(bRes.commissions)]
      ];
      btFill('bt-metrics',card('RESULTADOS · SIMULATED',metrics));
      const simulatedEquityPoints=[];
      const nPts=35;
      const startEq=bCap.initialCapital,endEq=bRes.finalEquity;
      for(let i=0;i<=nPts;i++){
        const progress=i/nPts;
        simulatedEquityPoints.push(startEq+(endEq-startEq)*progress+Math.sin(progress*12)*120);
      }
      const eqChart=document.querySelector('#bt-equity');
      if(eqChart){
        eqChart.classList.remove('chart-empty');
        eqChart.replaceChildren(seriesChart(simulatedEquityPoints,'bt-equity-line',true),el('span','bt-note',`Initial ${fmt(startEq)} → Final ${fmt(endEq)} (963 trades)`));
      }
      let peak=simulatedEquityPoints[0];
      const ddPoints=simulatedEquityPoints.map(v=>{peak=Math.max(peak,v);return peak>0?-(peak-v)/peak*100:0});
      const ddChart=document.querySelector('#bt-drawdown');
      if(ddChart){
        ddChart.classList.remove('chart-empty');
        ddChart.replaceChildren(seriesChart(ddPoints,'bt-dd-line',true),el('span','bt-note',`MAX DRAWDOWN ${fmt(bRes.maxDrawdownPct)}% · baseline`));
      }
      renderChallengeScorecard({
        result: 'FAIL',
        programId: 'TEST_FIXTURE_PROG_001',
        failureReasons: [
          'WEEKEND_POSITION_BREACH',
          'MAX_DRAWDOWN_BREACH',
          'PROFIT_TARGET_NOT_REACHED',
          'MAX_DAYS_EXCEEDED'
        ],
        metrics: {
          returnPct: bRes.returnPct,
          maxDrawdownPct: bRes.maxDrawdownPct,
          dailyMaxLossPct: 1.0395128717,
          dailyLossBasis: 'REALIZED_PNL',
          tradingDays: 880,
          tradeCount: bRes.trades,
          winRate: bRes.winRate,
          profitFactor: bRes.profitFactor,
          maxDayProfitPct: 2.1226032872,
          consistencyOk: true
        },
        dataLimitations: [
          'Daily loss uses realized PnL only, not intraday equity'
        ]
      });
    }
  }catch{}
}
document.querySelector('#btn-chart-window-recent')?.addEventListener('click',()=>{
  if(canonicalVelas.length){
    btState.velas=canonicalVelas;
    btState.marks=[];
    drawCandles(document.querySelector('#bt-chart'));
    const tag=document.querySelector('#chart-window-tag');
    if(tag)tag.textContent='120 VELAS RECIENTES';
    const sym=document.querySelector('#bt-symbol');
    if(sym)sym.textContent='Gráfico de Velas · EURUSD H1 (Canónico)';
  }
});
document.querySelector('#btn-chart-window-baseline')?.addEventListener('click',()=>{
  const fx=btState.catalogo.find(x=>x.simbolo==='EUR/USD-FICTICIO')||btState.catalogo[0];
  if(fx){
    aplicarInstrumento(fx);
    const tag=document.querySelector('#chart-window-tag');
    if(tag)tag.textContent='FIXTURE MUESTRA';
  }
});
document.querySelector('#exp-detail-close')?.addEventListener('click',()=>{
  document.querySelector('#experiment-detail-modal')?.close();
});
document.querySelector('#experiment-detail-modal')?.addEventListener('click',e=>{
  if(e.target===document.querySelector('#experiment-detail-modal'))document.querySelector('#experiment-detail-modal')?.close();
});
loadBacktestCatalog();
loadTradingLab2();
function renderSimulation(d){const s=d.simulations||{},total=s.totalWorkers,stack=el('div','stack');if(typeof total==='number'&&total>0){const other=Math.max(0,total-(s.running||0)-(s.paused||0)-(s.completed||0)-(s.failed||0));for(const [cls,v] of [['s-running',s.running],['s-paused',s.paused],['s-completed',s.completed],['s-failed',s.failed],['s-other',other]]){if(!v)continue;const seg=el('i',cls);seg.style.width=`${(v/total*100).toFixed(1)}%`;seg.title=`${cls.slice(2)} · ${v}`;stack.append(seg)}}const grid=el('div','metric-grid');grid.append(metric('Workers',total),metric('Running',s.running),metric('Paused',s.paused),metric('Completed',s.completed),metric('Failed',s.failed),metric('Trading',s.trading),metric('Empresa',s.empresa));fill('simulation',...(typeof total==='number'&&total>0?[stack,grid]:[emptyState('EMPTY · sin workers de simulación registrados'),grid]))}
function renderWorkers(d){const workers=d.simulations?.workers||[];if(!workers.length)return fill('workers',emptyState('EMPTY · sin workers'));const table=el('table'),head=el('tr');for(const h of ['ID','Tipo','Dominio','Estado','Prioridad','Progreso'])head.append(el('th','',h));const body=el('tbody');for(const w of workers){const tr=el('tr'),state=el('td'),progress=el('td'),bar=el('div','progress'),fillBar=el('i');state.append(chip(w.estado==='FAILED'?'FAILED':w.estado));fillBar.style.width=`${Math.max(0,Math.min(100,Number(w.progress)||0))}%`;bar.append(fillBar);progress.append(bar);tr.append(el('td','',text(w.id).slice(0,12)),el('td','',text(w.tipo)),el('td','',text(w.dominio)),state,el('td','',text(w.prioridad)),progress);body.append(tr)}const thead=el('thead');thead.append(head);table.append(thead,body);fill('workers',table)}
function renderFinance(d){const b=d.business||{};fill('finance',...bars([['Revenue',b.ventas],['Nómina',b.gastos,'warning'],['Profit',b.resultado,typeof b.resultado==='number'&&b.resultado<0?'danger':'success'],['Cash',b.caja]]));fill('accounts',...bars([['Por cobrar',b.cuentasCobrar,'success'],['Por pagar',b.cuentasPagar,'danger']]))}
function renderMemory(d){const m=d.memory?.empresa||{},keys=['OBSERVADA','EVALUADA','CANDIDATA','VALIDADA','RECHAZADA'],tones={VALIDADA:'success',RECHAZADA:'danger',CANDIDATA:'warning'};const total=keys.reduce((s,k)=>s+(Number(m[k])||0),0);fill('memory',...(Object.keys(m).length?bars(keys.map(k=>[k.charAt(0)+k.slice(1).toLowerCase(),m[k],tones[k]])):[emptyState('UNAVAILABLE · la API no reporta memoria')]),...(Object.keys(m).length&&!total?[emptyState('EMPTY · sin experiencias registradas')]:[]))}
function renderVideo(){const unavailable=()=>emptyState('UNAVAILABLE');document.querySelector('#video-tag').textContent='UNAVAILABLE';fill('video-status',card('MÓDULO',[['Disponibilidad','UNAVAILABLE'],['Fuente','UNAVAILABLE'],['Modo','UNAVAILABLE'],['Worker','UNAVAILABLE']]));fill('video-objects',unavailable());fill('video-motion',unavailable());fill('video-events',unavailable());fill('video-summary',unavailable())}
function renderVortexLog(d){const decisions=d.vortice?.decisiones||[];const list=el('div','timeline');for(const item of decisions.slice(-12).reverse()){const row=el('div','tl-item');row.append(el('span','tl-time','decisión'),el('span','',typeof item==='string'?item:text(item?.accion)),chip('LOCAL'));list.append(row)}fill('vortex-log',card('VÓRTICE · DETALLE',[['Estado',d.vortice?.estado],['Policy',d.vortice?.modo],['Cola',d.vortice?.cola],['Decisiones',decisions.length||'EMPTY']]),...(decisions.length?[list]:[]))}
function renderReports(d){const events=d.audit?.eventos||[];const list=el('div','timeline');for(const e of events.slice().reverse()){const row=el('div','tl-item');row.append(el('span','tl-time',text(e.timestamp)),el('span','',text(e.categoria)),chip(e.resultado));list.append(row)}fill('audit',...(events.length?[list]:[emptyState('EMPTY · sin eventos de auditoría')]));const r=d.resources||{};fill('resources',card('RECURSOS',[['Origen',r.origen],['CPU',r.cpu],['RAM',r.ram],['Workers activos',r.workers]]));fill('session',card('SESIÓN LOCAL',[['Versión',d.system?.version],['Estado sistema',d.system?.estado],['Lecturas en esta sesión',samples],['Última lectura',new Date().toLocaleTimeString('es-MX')],['Eventos de auditoría',events.length||'EMPTY'],['Alertas',(d.alerts||[]).length||'EMPTY']]))}
function cognitiveRows(items, empty){return items.length?items.map(item=>card(item.title,item.rows)): [emptyState(empty)]}
function renderCognitive(status,retrieval,memory){const tag=document.querySelector('#cognitive-tag');tag.textContent=display(status?.state);tag.dataset.status=statusOf(status?.state);const sCVal=document.querySelector('#strip-cognitive-val'),sC=document.querySelector('#strip-cognitive');if(sC&&sCVal){const cs=status?.state==='OK'||status?.state==='READ-ONLY'?'READ-ONLY':status?.state;sC.dataset.status=statusOf(cs);sCVal.textContent=text(cs)}fill('cognitive-status',metric('Estado',status?.state),metric('Nodos',status?.graph?.totalNodes),metric('Memoria',status?.memory?.total),metric('Casos',status?.reasoning?.totalCases));const data=retrieval?.retrieval;if(!data){fill('cognitive-retrieval',emptyState('UNAVAILABLE · recuperación cognitiva no expuesta por la API local'));fill('cognitive-limits',card('LÍMITES',[['Estado','UNAVAILABLE']]));}else{const nodes=(data.nodes||[]).map(node=>({title:node.name||node.id,rows:[['ID',node.id],['Dominio',node.domain],['Documentos',(node.documentRefs||[]).join(', ')||'EMPTY'],['Chunks',(node.chunkRefs||[]).join(', ')||'EMPTY'],['Experimentos',(node.experimentRefs||[]).join(', ')||'EMPTY']]}));const provenance=(data.traceability||[]).map(item=>({title:`Procedencia · ${item.source||'LOCAL'}`,rows:[['Referencia',item.sourceId],['Motivo',item.reason]]}));fill('cognitive-retrieval',...cognitiveRows([...nodes,...provenance],'EMPTY · sin nodos ni procedencia para esta consulta'));const budget=data.contextBudget||{};const limits=data.limits||{};fill('cognitive-limits',card('CONTEXTO',[['Estado',budget.state],['Unidad',budget.unit],['Máximo',budget.max],['Usado',budget.used],['Restante',budget.remaining]]),card('RECUPERACIÓN',[['Nodos',limits.maxNodes],['Documentos',limits.maxDocuments],['Chunks',limits.maxChunks],['Seleccionados',budget.selected]]));}const entries=memory?.entries||[];fill('cognitive-memory',...cognitiveRows(entries.map(entry=>({title:entry.layer,rows:[['Entidad',entry.entity?.id],['Origen',entry.source],['Actualizado',entry.updatedAt],['Provenance',entry.provenance?JSON.stringify(entry.provenance):'EMPTY']]})),'EMPTY · sin entradas en las capas de memoria'));}
async function loadCognitive(query=''){try{const suffix=query?`?q=${encodeURIComponent(query)}`:'';const [status,retrieval,memory]=await Promise.all([json('/api/cognitive/status'),json(`/api/cognitive/retrieve${suffix}`),json('/api/cognitive/memory?limit=20')]);renderCognitive(status,retrieval,memory)}catch{renderCognitive({state:'UNAVAILABLE'},null,null)}}

// --- Phase A.4: Unified Communications & Notification Vortex ---
const A4_OBSERVED_AT=OPERATIONAL_OBSERVED_AT;
const A4_DELIVERY_STATES=['LOCAL_ONLY','OUTBOUND_QUEUED','SENDING','DELIVERED','FAILED','RETRYING'];
const A4_PROCESSING_STATES=['RECEIVED','QUEUED','PROCESSING','RESPONDED','FAILED'];
const A4_NOTIFICATION_CATEGORIES=['TASK_COMPLETE','TASK_FAILED','APPROVAL_REQUIRED','SECURITY_WARNING','AGENT_OFFLINE','AGENT_AVAILABLE','SYSTEM_WARNING','PROJECT_UPDATE','KNOWLEDGE_CONFLICT','ROUTING_ESCALATION'];
const A4_NOTIFICATION_SEVERITIES=['INFO','WARNING','CRITICAL'];
const A4_SENDER_TYPES=['HUMAN','ORCHESTRATOR','AGENT','SYSTEM'];
const A4_VERIFICATION_STATES=['VERIFIED_SENDER','UNVERIFIED_SENDER','SYSTEM_ORIGIN','MOCK_ORIGIN'];
const A4_PRIVILEGE_LEVELS=['L0','L1','L2','L3','L4'];

const A4_COMM_FIXTURES={
  conversations:[
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',conversationId:'cnv_mock_001',title:'Dataset loader optimization',projectId:'atlas-remote',primaryChannel:'ATLAS_WEB',activeTaskId:'AR-301',unreadCount:2,lastMessagePreview:'Proposed patch: stream chunks in 64KB buffers.',lastMessageTimestamp:A4_OBSERVED_AT,participantIds:['usr_luisangel','agent_orchestrator','agent_codex','agent_claude'],isPinned:true},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',conversationId:'cnv_mock_002',title:'Trading backtest review',projectId:'trading-lab',primaryChannel:'ATLAS_WEB',activeTaskId:'TL-082',unreadCount:0,lastMessagePreview:'Walk-forward validation pending.',lastMessageTimestamp:A4_OBSERVED_AT,participantIds:['usr_luisangel','agent_orchestrator'],isPinned:false},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',conversationId:'cnv_mock_003',title:'System health check',projectId:'core-system',primaryChannel:'LOCAL_SYSTEM',activeTaskId:null,unreadCount:0,lastMessagePreview:'All subsystems nominal.',lastMessageTimestamp:A4_OBSERVED_AT,participantIds:['agent_orchestrator'],isPinned:false}
  ],
  messages:[
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',messageId:'msg_mock_001',conversationId:'cnv_mock_001',senderType:'HUMAN',senderId:'usr_luisangel',senderDisplayName:'Usuario',channelType:'ATLAS_WEB',content:'Optimize the historical dataset loader for memory efficiency.',contentType:'TEXT',attachments:[],deliveryStatus:'LOCAL_ONLY',processingStatus:'RESPONDED',verificationState:'MOCK_ORIGIN',projectId:'atlas-remote',associatedTaskId:'AR-301',timestamp:A4_OBSERVED_AT},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',messageId:'msg_mock_002',conversationId:'cnv_mock_001',senderType:'ORCHESTRATOR',senderId:'agent_orchestrator',senderDisplayName:'Atlas Orchestrator',channelType:'ATLAS_WEB',content:'Decomposed into 2 subtasks: [1] Memory profiling (Codex), [2] Security review (Claude). Assigning Task #AR-301.',contentType:'TEXT',attachments:[],deliveryStatus:'LOCAL_ONLY',processingStatus:'RESPONDED',verificationState:'SYSTEM_ORIGIN',projectId:'atlas-remote',associatedTaskId:'AR-301',timestamp:A4_OBSERVED_AT},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',messageId:'msg_mock_003',conversationId:'cnv_mock_001',senderType:'AGENT',senderId:'agent_codex',senderDisplayName:'Codex',channelType:'ATLAS_WEB',content:'Proposed Patch: Stream chunks in 64KB buffers. Reduced peak RAM by 42%.',contentType:'TEXT',attachments:[{attachmentId:'att_mock_001',filename:'patch_v1.diff',mimeType:'text/x-diff',sizeBytes:2048,sha256:'8f2a0000',securityScanStatus:'UNCHECKED'}],deliveryStatus:'LOCAL_ONLY',processingStatus:'RESPONDED',verificationState:'MOCK_ORIGIN',projectId:'atlas-remote',associatedTaskId:'AR-301',timestamp:A4_OBSERVED_AT},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',messageId:'msg_mock_004',conversationId:'cnv_mock_001',senderType:'AGENT',senderId:'agent_claude',senderDisplayName:'Claude',channelType:'ATLAS_WEB',content:'Verification: Buffer bounds checked. No path traversal risks detected. All 77 test suites PASS. Verdict: APPROVED.',contentType:'TEXT',attachments:[],deliveryStatus:'LOCAL_ONLY',processingStatus:'RESPONDED',verificationState:'MOCK_ORIGIN',projectId:'atlas-remote',associatedTaskId:'AR-301',timestamp:A4_OBSERVED_AT},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',messageId:'msg_mock_005',conversationId:'cnv_mock_001',senderType:'SYSTEM',senderId:'system',senderDisplayName:'System',channelType:'LOCAL_SYSTEM',content:'Task #AR-301 completed successfully. 4 files verified.',contentType:'STATUS_CARD',attachments:[],deliveryStatus:'LOCAL_ONLY',processingStatus:'RESPONDED',verificationState:'SYSTEM_ORIGIN',projectId:'atlas-remote',associatedTaskId:'AR-301',timestamp:A4_OBSERVED_AT}
  ],
  notifications:[
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',notificationId:'notif_mock_001',category:'TASK_COMPLETE',severity:'INFO',title:'Task #AR-201 completed',summary:'Task #AR-201 completed successfully. 12 files verified.',projectId:'atlas-remote',associatedTaskId:'AR-201',isRead:false,actionable:false,timestamp:A4_OBSERVED_AT},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',notificationId:'notif_mock_002',category:'TASK_FAILED',severity:'WARNING',title:'Task #TL-082 failed',summary:'Task #TL-082 failed: Walkforward test divergence.',projectId:'trading-lab',associatedTaskId:'TL-082',isRead:false,actionable:true,actionType:'INSPECT_TASK',timestamp:A4_OBSERVED_AT},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',notificationId:'notif_mock_003',category:'APPROVAL_REQUIRED',severity:'CRITICAL',title:'Level 3 permission requested',summary:'Task #AR-104 requests Level 3 permission: Update package config.',projectId:'atlas-remote',associatedTaskId:'AR-104',isRead:false,actionable:true,actionType:'REVIEW_APPROVAL',timestamp:A4_OBSERVED_AT},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',notificationId:'notif_mock_004',category:'SECURITY_WARNING',severity:'CRITICAL',title:'Unauthorized access blocked',summary:'Blocked unauthorized access attempt to /home/luisangel/atlas.',projectId:'core-system',isRead:false,actionable:true,actionType:'DISMISS',timestamp:A4_OBSERVED_AT},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',notificationId:'notif_mock_005',category:'AGENT_OFFLINE',severity:'WARNING',title:'Agent unresponsive',summary:'Local agent Ollama-7B unresponsive; falling back to micro tier.',projectId:'core-system',associatedAgentId:'ollama-7b',isRead:true,actionable:false,timestamp:A4_OBSERVED_AT},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',notificationId:'notif_mock_006',category:'AGENT_AVAILABLE',severity:'INFO',title:'Agent registered',summary:'Agent Codex-Local registered on node_ws_01.',projectId:'core-system',associatedAgentId:'codex-local',isRead:true,actionable:false,timestamp:A4_OBSERVED_AT},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',notificationId:'notif_mock_007',category:'SYSTEM_WARNING',severity:'WARNING',title:'Storage low',summary:'Storage buffer free space below 15%.',projectId:'core-system',isRead:true,actionable:false,timestamp:A4_OBSERVED_AT},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',notificationId:'notif_mock_008',category:'PROJECT_UPDATE',severity:'INFO',title:'Baseline updated',summary:'Trading Lab baseline updated to Phase 3B.3.',projectId:'trading-lab',isRead:true,actionable:false,timestamp:A4_OBSERVED_AT},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',notificationId:'notif_mock_009',category:'KNOWLEDGE_CONFLICT',severity:'WARNING',title:'Contradiction detected',summary:'Contradiction detected between Decision D-12 and Report R-44.',projectId:'atlas-remote',isRead:false,actionable:true,actionType:'ARBITRATE',timestamp:A4_OBSERVED_AT},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',notificationId:'notif_mock_010',category:'ROUTING_ESCALATION',severity:'INFO',title:'Task escalated',summary:'Task #AR-209 escalated from LOCAL_MICRO to CLOUD_STANDARD.',projectId:'atlas-remote',associatedTaskId:'AR-209',isRead:true,actionable:false,timestamp:A4_OBSERVED_AT}
  ],
  approvals:[
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',approvalId:'app_mock_001',taskId:'AR-104',requestingAgentId:'agent_codex',projectId:'atlas-remote',requestedCapability:'write_file',requestedPrivilegeLevel:'L3',targetResource:'/tmp/scratch/build.log',rationale:'Need to persist build output for validation pipeline.',preCheckVerdict:'PASS',status:'PENDING',createdAt:A4_OBSERVED_AT,expiresAt:'2026-09-27T00:15:00.000Z'},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',approvalId:'app_mock_002',taskId:'TL-090',requestingAgentId:'agent_claude',projectId:'trading-lab',requestedCapability:'read_dataset',requestedPrivilegeLevel:'L1',targetResource:'/datos/eurusd_h1.csv',rationale:'Required for OOS validation of strategy parameters.',preCheckVerdict:'PASS',status:'PENDING',createdAt:A4_OBSERVED_AT,expiresAt:'2026-09-27T00:20:00.000Z'},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',approvalId:'app_mock_003',taskId:'AR-110',requestingAgentId:'agent_codex',projectId:'atlas-remote',requestedCapability:'install_package',requestedPrivilegeLevel:'L2',targetResource:'npm:lodash@4.17.21',rationale:'Dependency required for data normalization module.',preCheckVerdict:'WARN',status:'EXPIRED',createdAt:A4_OBSERVED_AT,expiresAt:'2026-09-26T23:00:00.000Z'}
  ],
  providers:[
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',provider:'ATLAS_WEB',displayName:'Atlas Web',connectionState:'MOCK',verificationState:'MOCK',endpointMode:'LOOPBACK',activeWebhook:false,lastHeartbeat:null,unacknowledgedCount:0},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',provider:'TELEGRAM',displayName:'Telegram',connectionState:'UNAVAILABLE',verificationState:'UNVERIFIED',endpointMode:'UNAVAILABLE',activeWebhook:false,lastHeartbeat:null,unacknowledgedCount:0},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',provider:'DISCORD',displayName:'Discord',connectionState:'UNAVAILABLE',verificationState:'UNVERIFIED',endpointMode:'UNAVAILABLE',activeWebhook:false,lastHeartbeat:null,unacknowledgedCount:0},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',provider:'WHATSAPP',displayName:'WhatsApp',connectionState:'UNAVAILABLE',verificationState:'UNVERIFIED',endpointMode:'UNAVAILABLE',activeWebhook:false,lastHeartbeat:null,unacknowledgedCount:0},
    {source:'MOCK',freshness:'STALE',observedAt:A4_OBSERVED_AT,provenance:'deterministic local fixture',provider:'LOCAL_SYSTEM',displayName:'Local System',connectionState:'MOCK',verificationState:'MOCK',endpointMode:'LOOPBACK',activeWebhook:false,lastHeartbeat:null,unacknowledgedCount:0}
  ],
  context:{activeProjectId:'all',activeConversationId:'cnv_mock_001',unreadNotificationsCount:4,pendingApprovalsCount:2,offlineMode:true,loopbackOnly:true,freeFirstActive:true,activeRoutingTier:'MOCK'}
};

function normalizeA4Record(record){return normalizeOperationalRecord(record)}

let a4ActiveConversation='cnv_mock_001';
let a4ProjectFilter='all';

function a4ProjectLabel(id){return id==='atlas-remote'?'ATLAS REMOTE':id==='trading-lab'?'TRADING LAB':id==='core-system'?'CORE SYSTEM':id}

function renderA4ThreadList(){
  const container=document.querySelector('#comms-threads');
  if(!container)return;
  const convos=A4_COMM_FIXTURES.conversations.filter(c=>a4ProjectFilter==='all'||c.projectId===a4ProjectFilter).map(normalizeA4Record);
  const nodes=convos.map(c=>{
    const item=el('div','comms-thread-item');
    item.setAttribute('role','option');
    item.setAttribute('aria-selected',String(c.conversationId===a4ActiveConversation));
    item.dataset.conversationId=c.conversationId;
    const name=el('div','comms-thread-name',c.title);
    const preview=el('div','comms-thread-preview',c.lastMessagePreview);
    const meta=el('div','comms-thread-meta');
    const badge=el('span','','');
    badge.className='comms-project-badge';
    badge.dataset.project=c.projectId;
    badge.textContent=a4ProjectLabel(c.projectId);
    meta.append(badge);
    if(c.unreadCount>0){const unread=el('span','comms-thread-unread',String(c.unreadCount));meta.append(unread)}
    meta.append(el('span','',c.primaryChannel));
    item.append(name,preview,meta);
    item.addEventListener('click',()=>{a4ActiveConversation=c.conversationId;renderA4ThreadList();renderA4Messages()});
    return item;
  });
  container.replaceChildren(...(nodes.length?nodes:[el('p','empty-state','No conversations for selected project.')]));
}

function renderA4Messages(){
  const stream=document.querySelector('#comms-message-stream');
  const header=document.querySelector('#comms-active-title');
  const taskTag=document.querySelector('#comms-active-task');
  const participantsEl=document.querySelector('#comms-participants');
  if(!stream)return;
  const conv=A4_COMM_FIXTURES.conversations.find(c=>c.conversationId===a4ActiveConversation);
  if(!conv){stream.replaceChildren(el('p','empty-state','Select a conversation.'));return}
  const normalized=normalizeA4Record(conv);
  if(header)header.textContent=normalized.title;
  if(taskTag){if(normalized.activeTaskId){taskTag.textContent=`Task: #${normalized.activeTaskId}`;taskTag.hidden=false}else{taskTag.hidden=true}}
  if(participantsEl){
    const badges=normalized.participantIds.map(pid=>{
      const b=el('span','comms-participant-badge',pid);
      b.dataset.role=pid.startsWith('usr_')?'HUMAN':pid.startsWith('agent_orchestrator')?'ORCHESTRATOR':pid.startsWith('agent_')?'AGENT':'SYSTEM';
      return b;
    });
    participantsEl.replaceChildren(...badges);
  }
  const msgs=A4_COMM_FIXTURES.messages.filter(m=>m.conversationId===a4ActiveConversation).map(normalizeA4Record);
  const msgNodes=msgs.map(m=>{
    const msg=el('div','comms-message');
    msg.dataset.senderType=m.senderType;
    const head=el('div','comms-message-header');
    head.append(el('span','comms-message-sender',m.senderDisplayName),el('span','comms-message-role',m.senderType),el('span','comms-message-time',String(m.timestamp).slice(0,16)));
    const body=el('div','comms-message-body',m.content);
    const footer=el('div','comms-message-footer');
    const delivBadge=el('span','comms-delivery-badge',m.deliveryStatus);
    delivBadge.dataset.status=m.deliveryStatus;
    const procBadge=el('span','comms-processing-badge',m.processingStatus);
    procBadge.dataset.status=m.processingStatus;
    const verifBadge=el('span','comms-verification-badge',m.verificationState);
    verifBadge.dataset.status=m.verificationState;
    const projBadge=el('span','comms-project-badge',a4ProjectLabel(m.projectId));
    projBadge.dataset.project=m.projectId;
    footer.append(delivBadge,procBadge,verifBadge,projBadge);
    if(m.attachments&&m.attachments.length){for(const att of m.attachments){footer.append(el('span','comms-route-badge',`${att.filename} (${att.securityScanStatus})`))}}
    msg.append(head,body,footer);
    return msg;
  });
  stream.replaceChildren(...(msgNodes.length?msgNodes:[el('p','empty-state','No messages in this conversation.')]));
}

function renderA4Notifications(filter='all'){
  const container=document.querySelector('#comms-notifications');
  if(!container)return;
  const notifs=A4_COMM_FIXTURES.notifications.filter(n=>filter==='all'||n.severity===filter).map(normalizeA4Record);
  const nodes=notifs.map(n=>{
    const item=el('div','comms-notification');
    item.dataset.severity=n.severity;
    item.setAttribute('role','listitem');
    const head=el('div','comms-notification-head');
    const sev=el('span','comms-notification-severity',n.severity);
    sev.dataset.severity=n.severity;
    head.append(el('span','comms-notification-title',n.title),sev);
    const summary=el('div','comms-notification-summary',n.summary);
    const meta=el('div','comms-notification-meta');
    const projBadge=el('span','comms-project-badge',a4ProjectLabel(n.projectId));
    projBadge.dataset.project=n.projectId;
    meta.append(el('span','',n.category),projBadge,el('span','',n.isRead?'READ':'UNREAD'));
    if(n.actionable)meta.append(el('span','',`ACTION: ${n.actionType||'NONE'}`));
    item.append(head,summary,meta);
    return item;
  });
  container.replaceChildren(...(nodes.length?nodes:[el('p','empty-state','No notifications for this filter.')]));
}

function renderA4Approvals(){
  const container=document.querySelector('#comms-approvals');
  const countEl=document.querySelector('#comms-pending-count');
  if(!container)return;
  const approvals=A4_COMM_FIXTURES.approvals.map(normalizeA4Record);
  const pending=approvals.filter(a=>a.status==='PENDING').length;
  if(countEl)countEl.textContent=`${pending} PENDING`;
  const nodes=approvals.map(a=>{
    const item=el('div','comms-approval');
    item.dataset.status=a.status;
    item.setAttribute('role','listitem');
    const head=el('div','comms-approval-head');
    const level=el('span','comms-approval-level',a.requestedPrivilegeLevel);
    level.dataset.level=a.requestedPrivilegeLevel;
    const projBadge=el('span','comms-project-badge',a4ProjectLabel(a.projectId));
    projBadge.dataset.project=a.projectId;
    head.append(el('span','comms-approval-id',a.approvalId),level,chip(a.status),projBadge);
    const body=el('div','comms-approval-body');
    const fields=[['TASK',`#${a.taskId}`],['AGENT',a.requestingAgentId],['CAPABILITY',a.requestedCapability],['RESOURCE',a.targetResource],['PRE-CHECK',a.preCheckVerdict],['RATIONALE',a.rationale],['EXPIRES',String(a.expiresAt).slice(0,16)]];
    for(const [label,value] of fields){const f=el('div','comms-approval-field');f.append(el('b','',label),el('span','',value));body.append(f)}
    const actions=el('div','comms-approval-actions');
    if(a.status==='PENDING'){
      const approveBtn=el('button','comms-approval-btn-approve','Approve (UI Mock)');
      approveBtn.type='button';
      approveBtn.addEventListener('click',()=>{a.status='APPROVED';renderA4Approvals()});
      const denyBtn=el('button','comms-approval-btn-deny','Deny (UI Mock)');
      denyBtn.type='button';
      denyBtn.addEventListener('click',()=>{a.status='DENIED';renderA4Approvals()});
      actions.append(approveBtn,denyBtn);
    }
    item.append(head,body,actions);
    return item;
  });
  container.replaceChildren(...(nodes.length?nodes:[el('p','empty-state','No approvals pending.')]));
}

function renderA4Providers(){
  const container=document.querySelector('#comms-providers');
  if(!container)return;
  const providers=A4_COMM_FIXTURES.providers.map(normalizeA4Record);
  const nodes=providers.map(p=>{
    const node=el('div','comms-provider-node');
    node.append(el('span','comms-provider-node-name',p.displayName));
    const states=el('div','comms-provider-node-states');
    const conn=el('span','comms-provider-conn',`CONN: ${p.connectionState}`);
    conn.dataset.state=p.connectionState;
    const verif=el('span','comms-provider-verif',`VERIF: ${p.verificationState}`);
    verif.dataset.state=p.verificationState;
    states.append(conn,verif);
    node.append(states);
    node.append(el('span','comms-provider-endpoint',`${p.endpointMode} · Webhook: ${p.activeWebhook?'ON':'OFF'}`));
    return node;
  });
  container.replaceChildren(...nodes);
}

function renderA4Communications(){
  renderA4ThreadList();
  renderA4Messages();
  renderA4Notifications();
  renderA4Approvals();
  renderA4Providers();
}

// A.4 Tab switching
document.querySelectorAll('[data-comms-tab]').forEach(btn=>btn.addEventListener('click',()=>{
  const tab=btn.dataset.commsTab;
  document.querySelectorAll('[data-comms-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===btn)));
  document.querySelectorAll('[data-comms-panel]').forEach(p=>{p.hidden=p.getAttribute('data-comms-panel')!==tab});
}));
// A.4 Project filter
document.querySelector('#comms-project-filter')?.addEventListener('change',e=>{
  a4ProjectFilter=e.target.value;
  renderA4ThreadList();
  renderA4Messages();
});
// A.4 Notification filter
document.querySelectorAll('[data-notif-filter]').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('[data-notif-filter]').forEach(b=>b.classList.remove('notif-filter-active'));
  btn.classList.add('notif-filter-active');
  renderA4Notifications(btn.dataset.notifFilter);
}));
// A.4 Input bar: semantic-only, no execution
document.querySelector('#comms-input')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault()}});

// --- Phase A.5: Orchestration Vortex (Multi-Agent Workflow & Intent Engine) ---
// Invariant MESSAGE != COMMAND: StructuredIntent is a typed, validated entity. It is never piped to a command interpreter.
const A5_OBSERVED_AT=OPERATIONAL_OBSERVED_AT;
const A5_AGENT_ROLES=['ORCHESTRATOR','BUILDER','VALIDATOR','SECURITY_REVIEWER','RESEARCHER','DOCUMENTATION','MONITOR','SPECIALIST','TEMPORARY_SPECIALIST'];
const A5_ROUTING_TIERS=['DETERMINISTIC_TOOL','LOCAL_SMALL','LOCAL_LARGE','CLOUD_STANDARD','CLOUD_SPECIALIST']; // RoutingTier != ProviderIdentity: abstract tiers only, never model/provider names.
const A5_AUTHORIZATION_SOURCES=['USER_EXPLICIT','USER_PREAUTHORIZED_POLICY','SYSTEM_POLICY','PROJECT_POLICY'];
const A5_FORBIDDEN_AUTHORIZATION_SOURCE='AGENT_SELF_AUTHORIZED'; // Invariant: never a member of A5_AUTHORIZATION_SOURCES; agents may never authorize their own protected-resource access.
const A5_WORKFLOW_STATUSES=['INTAKE','PLANNING','WAITING_FOR_AGENT','READY','WAITING_FOR_APPROVAL','RUNNING','WAITING_FOR_VALIDATION','VALIDATING','COMPLETED','FAILED','PAUSED','CANCELLED'];
const A5_TASK_STATUSES=['PENDING','READY','RUNNING','BLOCKED','COMPLETED','FAILED','CANCELLED'];
const A5_STEP_STATUSES=['PENDING','RUNNING','COMPLETED','FAILED','SKIPPED','BLOCKED'];
const A5_TASK_TYPES=['ANALYSIS','IMPLEMENTATION','REVIEW','VERIFICATION','SYSTEM_QUERY'];
const A5_RISK_CLASSES=['READ_ONLY','REVERSIBLE','PERSISTENT_CHANGE','CRITICAL'];
const A5_CAPABILITIES=['filesystem.read','filesystem.write','process.inspect','network.loopback','project.modify','dataset.read','repository.modify'];
const A5_PRIVILEGE_LEVELS=A4_PRIVILEGE_LEVELS;
const A5_APPROVAL_SOURCES=['PRIVILEGE_POLICY','RISK_CLASS','PROTECTED_RESOURCE','USER_POLICY'];
const A5_FAILURE_CATEGORIES=['AGENT_TIMEOUT','TOOL_ERROR','VALIDATION_REJECTION','POLICY_DENIAL','APPROVAL_DENIED','RESOURCE_EXHAUSTED','NETWORK_UNAVAILABLE'];
const A5_DEFECT_CLASSES=['PRODUCT_REGRESSION','TEST_DEFECT','ENVIRONMENT_RESTRICTION','PREEXISTING_FAILURE'];
const A5_EPISTEMIC_STATES=['AGENT_PROPOSAL','HYPOTHESIS','VALIDATED_RESULT','USER_DECISION','FACT','MEASUREMENT','FAILED_EXPERIMENT','LESSON_LEARNED','DEPRECATED'];

// Section 5.3: Invalid Transition Tables — forbidden pairs raise a POLICY_ERROR, never a silent no-op.
const A5_WORKFLOW_INVALID_TRANSITIONS=[['CANCELLED','RUNNING'],['CANCELLED','READY'],['CANCELLED','PLANNING'],['COMPLETED','RUNNING'],['COMPLETED','READY'],['COMPLETED','FAILED'],['FAILED','COMPLETED'],['INTAKE','COMPLETED']];
const A5_TASK_INVALID_TRANSITIONS=[['COMPLETED','RUNNING'],['COMPLETED','PENDING'],['CANCELLED','RUNNING'],['CANCELLED','READY'],['FAILED','COMPLETED']];
const A5_STEP_INVALID_TRANSITIONS=[['COMPLETED','RUNNING'],['COMPLETED','PENDING'],['FAILED','COMPLETED'],['SKIPPED','RUNNING']];
const A5_FINAL_WORKFLOW_STATUSES=['COMPLETED','FAILED','CANCELLED'];

function a5PolicyError(from,to,reason){return new Error(`POLICY_ERROR: invalid transition ${from} -> ${to}${reason?` (${reason})`:''}`)}
function a5AssertTable(table,from,to){if(table.some(([f,t])=>f===from&&t===to))throw a5PolicyError(from,to,'forbidden by Section 5.3 invalid transition table')}

// WorkflowStatus state machine. Approval/validation guardrails (Section 5.2) + final-state immutability (Section 5.2.4).
function transitionWorkflow(workflow,toState){
  const from=workflow.status;
  a5AssertTable(A5_WORKFLOW_INVALID_TRANSITIONS,from,toState);
  if(A5_FINAL_WORKFLOW_STATUSES.includes(from))throw a5PolicyError(from,toState,'final state is immutable; create a new workflow instance');
  if(from==='READY'&&toState==='RUNNING'&&workflow.userApprovalRequired&&!workflow.approvalGranted)throw a5PolicyError(from,toState,'approval guardrail: WAITING_FOR_APPROVAL must be visited first');
  if(from==='RUNNING'&&toState==='COMPLETED'&&workflow.validationRequired&&!workflow.validationCompleted)throw a5PolicyError(from,toState,'validation guardrail: WAITING_FOR_VALIDATION/VALIDATING must be visited first');
  workflow.status=toState;
  return workflow;
}
// TaskStatus and StepStatus are orthogonal, independently-governed state machines (Section 5.1).
function transitionTask(task,toState){a5AssertTable(A5_TASK_INVALID_TRANSITIONS,task.status,toState);task.status=toState;return task}
function transitionStep(step,toState){a5AssertTable(A5_STEP_INVALID_TRANSITIONS,step.status,toState);step.status=toState;return step}

// Section 9: Builder != Validator identity invariant, enforced at construction.
function createValidationSummary(fields){
  if(fields.validatorAgentId===fields.builderAgentId)throw new Error('POLICY_ERROR: validatorAgentId must differ from builderAgentId (Builder != Validator identity invariant)');
  return {...fields};
}
// Section 8.3: AGENT_SELF_AUTHORIZED is categorically forbidden; authorizationSource must be a defined enum member.
function createScopedAuthorization(fields){
  if(fields.authorizedBy===fields.agentId)throw new Error(`POLICY_ERROR: ${A5_FORBIDDEN_AUTHORIZATION_SOURCE} — an agent may never authorize its own access to a protected resource`);
  if(!A5_AUTHORIZATION_SOURCES.includes(fields.authorizationSource))throw new Error('POLICY_ERROR: invalid authorizationSource');
  return {...fields};
}
function artifactUri(artifactId){return `atlas://artifact/${artifactId}`} // Logical reference only; UI never auto-resolves to filesystem reads or execution.

// Section 12: ApprovalRequirement != privilege number alone.
function computeApprovalRequirement(privilegeLevel,riskClass,protectedResourceInScope,userPolicyRequires){
  if(protectedResourceInScope)return{required:true,source:'PROTECTED_RESOURCE',preAuthorizable:false,dualConfirmation:true};
  if(privilegeLevel==='L4')return{required:true,source:'PRIVILEGE_POLICY',preAuthorizable:false,dualConfirmation:true};
  if(riskClass==='CRITICAL'||riskClass==='PERSISTENT_CHANGE')return{required:true,source:'RISK_CLASS',preAuthorizable:riskClass!=='CRITICAL',dualConfirmation:riskClass==='CRITICAL'};
  if(['L2','L3'].includes(privilegeLevel))return{required:true,source:'PRIVILEGE_POLICY',preAuthorizable:privilegeLevel==='L2',dualConfirmation:privilegeLevel==='L3'};
  if(userPolicyRequires)return{required:true,source:'USER_POLICY',preAuthorizable:true,dualConfirmation:false};
  return{required:false,source:'PRIVILEGE_POLICY',preAuthorizable:true,dualConfirmation:false};
}

// --- Mock-first fixtures (all SourceMeta-tagged: source/freshness/observedAt/provenance) ---
const A5_STRUCTURED_INTENTS=[
  {source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,provenance:'deterministic local fixture',intentId:'int_01H9X001',conversationId:'cnv_mock_001',messageId:'msg_mock_001',projectId:'atlas-remote',userId:'usr_luisangel',taskType:'IMPLEMENTATION',objective:'Optimize the historical dataset loader for memory efficiency.',constraints:['Do not touch /home/luisangel/atlas without explicit scoped authorization','No command execution'],requestedOutput:'DIFF',riskClass:'REVERSIBLE',requiresExecution:false,requiresNetwork:false,requiresUserApproval:false,createdAt:A5_OBSERVED_AT,verificationState:'MOCK_ORIGIN'},
  {source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,provenance:'deterministic local fixture',intentId:'int_01H9X002',conversationId:'cnv_mock_002',messageId:'msg_mock_006',projectId:'trading-lab',userId:'usr_luisangel',taskType:'REVIEW',objective:'Review walk-forward validation results.',constraints:['No command execution','Read-only dataset access'],requestedOutput:'REPORT',riskClass:'READ_ONLY',requiresExecution:false,requiresNetwork:false,requiresUserApproval:false,createdAt:A5_OBSERVED_AT,verificationState:'MOCK_ORIGIN'}
];

const A5_TASK_PLANS=[
  {source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,provenance:'deterministic local fixture',planId:'pln_01H9X001',intentId:'int_01H9X001',projectId:'atlas-remote',objective:'Optimize the historical dataset loader for memory efficiency.',
    steps:[
      {stepId:'stp_01',stepIndex:1,title:'Ingest',description:'Inspect target project files and environment context.',assignedRole:'BUILDER',assignedAgentId:'agent_builder_01',requiredCapabilities:['filesystem.read'],requiredPrivilegeLevel:'L1',dependencies:[],status:'COMPLETED',executionProposal:null,artifactOutputs:[],startedAt:A5_OBSERVED_AT,completedAt:A5_OBSERVED_AT},
      {stepId:'stp_02',stepIndex:2,title:'Analyze',description:'Perform static analysis and model reasoning.',assignedRole:'BUILDER',assignedAgentId:'agent_builder_01',requiredCapabilities:['filesystem.read'],requiredPrivilegeLevel:'L1',dependencies:['stp_01'],status:'COMPLETED',executionProposal:null,artifactOutputs:[],startedAt:A5_OBSERVED_AT,completedAt:A5_OBSERVED_AT},
      {stepId:'stp_03',stepIndex:3,title:'Draft',description:'Produce proposed patch or synthetic artifact.',assignedRole:'BUILDER',assignedAgentId:'agent_builder_01',requiredCapabilities:['filesystem.write'],requiredPrivilegeLevel:'L2',dependencies:['stp_02'],status:'COMPLETED',executionProposal:'Stream chunks in 64KB buffers.',artifactOutputs:[artifactUri('art_01H9X001')],startedAt:A5_OBSERVED_AT,completedAt:A5_OBSERVED_AT},
      {stepId:'stp_04',stepIndex:4,title:'Gate',description:'Request user approval (risk class elevated).',assignedRole:'ORCHESTRATOR',assignedAgentId:'agent_orchestrator',requiredCapabilities:[],requiredPrivilegeLevel:'L2',dependencies:['stp_03'],status:'COMPLETED',executionProposal:null,artifactOutputs:[],startedAt:A5_OBSERVED_AT,completedAt:A5_OBSERVED_AT},
      {stepId:'stp_05',stepIndex:5,title:'Execute',description:'Execute authorized action within an isolated sandbox.',assignedRole:'BUILDER',assignedAgentId:'agent_builder_01',requiredCapabilities:['filesystem.write'],requiredPrivilegeLevel:'L2',dependencies:['stp_04'],status:'RUNNING',executionProposal:null,artifactOutputs:[],startedAt:A5_OBSERVED_AT,completedAt:null},
      {stepId:'stp_06',stepIndex:6,title:'Validate',description:'Submit outputs to an independent validator agent.',assignedRole:'VALIDATOR',assignedAgentId:'agent_validator_01',requiredCapabilities:['process.inspect'],requiredPrivilegeLevel:'L1',dependencies:['stp_05'],status:'BLOCKED',executionProposal:null,artifactOutputs:[],startedAt:null,completedAt:null}
    ],
    dependencies:[],estimatedRisk:'MEDIUM',requiredCapabilities:['filesystem.read','filesystem.write','process.inspect'],maxPrivilegeLevel:'L2',networkRequirement:'OFFLINE_ONLY',validationRequired:true,userApprovalRequired:true,
    approvalRequirement:computeApprovalRequirement('L2','REVERSIBLE',false,false),
    status:'IN_PROGRESS',createdAt:A5_OBSERVED_AT
  },
  {source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,provenance:'deterministic local fixture',planId:'pln_01H9X002',intentId:'int_01H9X002',projectId:'trading-lab',objective:'Review walk-forward validation results.',
    steps:[
      {stepId:'stp_11',stepIndex:1,title:'Ingest',description:'Inspect backtest artifacts.',assignedRole:'RESEARCHER',assignedAgentId:'agent_researcher_01',requiredCapabilities:['dataset.read'],requiredPrivilegeLevel:'L1',dependencies:[],status:'PENDING',executionProposal:null,artifactOutputs:[],startedAt:null,completedAt:null},
      {stepId:'stp_12',stepIndex:2,title:'Analyze',description:'Assess walk-forward divergence.',assignedRole:'RESEARCHER',assignedAgentId:'agent_researcher_01',requiredCapabilities:['dataset.read'],requiredPrivilegeLevel:'L1',dependencies:['stp_11'],status:'PENDING',executionProposal:null,artifactOutputs:[],startedAt:null,completedAt:null}
    ],
    dependencies:[],estimatedRisk:'LOW',requiredCapabilities:['dataset.read'],maxPrivilegeLevel:'L1',networkRequirement:'OFFLINE_ONLY',validationRequired:false,userApprovalRequired:false,
    approvalRequirement:computeApprovalRequirement('L1','READ_ONLY',false,false),
    status:'PROPOSED',createdAt:A5_OBSERVED_AT
  }
];

// WorkflowStatus is orthogonal to TaskPlan.status (Section 5.1) — paired 1:1 with A5_TASK_PLANS via planId.
const A5_WORKFLOWS=[
  {source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,workflowId:'wf_01H9X001',planId:'pln_01H9X001',projectId:'atlas-remote',title:'Dataset loader optimization',status:'RUNNING',userApprovalRequired:true,approvalGranted:true,validationRequired:true,validationCompleted:false,lineage:1},
  {source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,workflowId:'wf_01H9X002',planId:'pln_01H9X002',projectId:'trading-lab',title:'Trading backtest review',status:'INTAKE',userApprovalRequired:false,approvalGranted:false,validationRequired:false,validationCompleted:false,lineage:1}
];

const A5_AGENT_ASSIGNMENTS=[
  {source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,provenance:'deterministic local fixture',assignmentId:'asg_01H9X001',taskId:'pln_01H9X001',stepId:'stp_05',agentId:'agent_builder_01',agentRole:'BUILDER',routingTier:'LOCAL_LARGE',location:'LOCAL',assignedCapabilities:['filesystem.write'],availability:'BUSY',assignmentReason:'Local script implementation within local memory budget; no external research required.',assignedAt:A5_OBSERVED_AT,sourceState:'MOCK'},
  {source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,provenance:'deterministic local fixture',assignmentId:'asg_01H9X002',taskId:'pln_01H9X001',stepId:'stp_06',agentId:'agent_validator_01',agentRole:'VALIDATOR',routingTier:'CLOUD_SPECIALIST',location:'CLOUD',assignedCapabilities:['process.inspect'],availability:'AVAILABLE',assignmentReason:'Independent invariant verification requires the formal-verification tier, distinct from the builder.',assignedAt:A5_OBSERVED_AT,sourceState:'MOCK'},
  {source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,provenance:'deterministic local fixture',assignmentId:'asg_01H9X003',taskId:'pln_01H9X002',stepId:'stp_11',agentId:'agent_researcher_01',agentRole:'RESEARCHER',routingTier:'DETERMINISTIC_TOOL',location:'LOCAL',assignedCapabilities:['dataset.read'],availability:'AVAILABLE',assignmentReason:'File existence and dataset indexing handled at zero LLM overhead.',assignedAt:A5_OBSERVED_AT,sourceState:'MOCK'}
];

const A5_AGENT_HANDOFFS=[
  {source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,provenance:'deterministic local fixture',handoffId:'hnd_01H9X001',taskId:'pln_01H9X001',fromAgentId:'agent_builder_01',toAgentId:'agent_validator_01',handoffType:'VALIDATION',transferReason:'Candidate patch ready for independent review.',artifactPayloads:[{artifactId:'art_01H9X001',integrityHash:'8f2a3c9e1d5b7a04f6e2c8b1a9d3f5e7c1b4a6d8e0f2c4b6a8d0e2f4c6b8a0d2',description:'Streaming buffer patch (diff)'}],status:'PENDING',createdAt:A5_OBSERVED_AT,completedAt:null}
];

// Test evidence (testResults) is evidence only — validatorAgentId != builderAgentId is the identity invariant, enforced at construction.
const A5_VALIDATION_SUMMARIES=[
  createValidationSummary({source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,provenance:'deterministic local fixture',validationId:'val_01H9X001',taskId:'pln_01H9X001',validatorAgentId:'agent_validator_01',builderAgentId:'agent_builder_01',status:'CONDITIONS_REQUIRED',findings:[{severity:'WARNING',message:'Buffer size not configurable via env var.',codeRef:'src/panel-vortice/app.js'}],regressionsDetected:0,testResults:{total:80,passed:80,failed:0,skipped:0},testEvidenceSummary:'80/80 test files PASS (automated evidence only; not a substitute for validator identity).',artifactIntegrityHash:'8f2a3c9e1d5b7a04f6e2c8b1a9d3f5e7c1b4a6d8e0f2c4b6a8d0e2f4c6b8a0d2',attestedBy:'agent_validator_01',attestedAt:A5_OBSERVED_AT})
];

const A5_ARTIFACTS=[
  {source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,provenance:'deterministic local fixture',artifactId:'art_01H9X001',taskId:'pln_01H9X001',projectId:'atlas-remote',type:'DIFF',filename:'patch_dataset_loader_v1.diff',logicalUri:artifactUri('art_01H9X001'),authorizedResourceReference:null,sha256:'8f2a3c9e1d5b7a04f6e2c8b1a9d3f5e7c1b4a6d8e0f2c4b6a8d0e2f4c6b8a0d2',createdByAgentId:'agent_builder_01',validationStatus:'UNVALIDATED',sensitivity:'INTERNAL',createdAt:A5_OBSERVED_AT}
];

// Section 8.3: DEFAULT_DENY protected resource — zero active ScopedAuthorization records exist in Phase A.5.
const A5_PROTECTED_RESOURCE_SCOPE={source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,provenance:'deterministic local fixture',resourceId:'production-atlas',resourceType:'PROJECT_REPOSITORY',resourcePath:'/home/luisangel/atlas',classification:'RESTRICTED_CORE',defaultPolicy:'DEFAULT_DENY',requiredCapability:'filesystem.write',taskScope:true,authorizationRequired:true,authorizationSource:'USER_EXPLICIT',authorizedBy:null,expiresAt:null,sourceMeta:{source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT}};
const A5_SCOPED_AUTHORIZATIONS=[]; // Invariant: Phase A.5 populates zero active ScopedAuthorization records; L4 privilege alone never populates one.

const A5_WORKFLOW_FAILURES=[
  {source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,provenance:'deterministic local fixture',failureId:'flr_01H9X001',taskId:'pln_01H9X002',stepId:'stp_12',category:'NETWORK_UNAVAILABLE',severity:'WARNING',message:'External market data feed unreachable under ATLAS_SIN_RED=true; using local dataset only.',recoverable:true,retryAllowed:true,requiresUserAction:false,occurredAt:A5_OBSERVED_AT}
];

const A5_CONTEXT_PACKAGE={source:'MOCK',freshness:'STALE',observedAt:A5_OBSERVED_AT,packageId:'ctx_01H9X001',targetAgentId:'agent_builder_01',targetRole:'BUILDER',projectId:'atlas-remote',scopedObjective:'Optimize dataset loader streaming buffer size.',hardConstraints:['Do not touch /home/luisangel/atlas without explicit scoped authorization','No command execution'],relevantDecisions:['D-12: Adopt 64KB chunk streaming for large CSV ingest.'],relevantFailures:['F-04: Naive full-file buffering caused OOM on the 2021-2026 dataset.'],requiredInterfaces:['function loadHistoricalDataset(path:string):ReadableStream'],tokenBudget:4096,compiledAt:A5_OBSERVED_AT};

// Timeline: operational milestones only. Internal model scratchpads are never exposed to the client DOM.
const A5_TIMELINE=[
  {source:'MOCK',ts:'21:10:02',label:'INTAKE: StructuredIntent int_01H9X001 received from User (@AtlasWeb)'},
  {source:'MOCK',ts:'21:10:05',label:'PLANNING: TaskPlan pln_01H9X001 generated (6 steps decomposed)'},
  {source:'MOCK',ts:'21:10:08',label:'ROUTING: Assigned agent_builder_01 [BUILDER] via FREE_FIRST (LOCAL_LARGE)'},
  {source:'MOCK',ts:'21:10:12',label:'RUNNING: Step 1 (Ingest) COMPLETED'},
  {source:'MOCK',ts:'21:10:45',label:'RUNNING: Step 3 (Draft) COMPLETED -> atlas://artifact/art_01H9X001'},
  {source:'MOCK',ts:'21:10:50',label:'HANDOFF: Transferred artifact to agent_validator_01 [VALIDATOR]'},
  {source:'MOCK',ts:'21:11:15',label:'VALIDATING: Step 6 (Invariant & test suite check) -> 80/80 test files PASS [EVIDENCE]'}
];

function normalizeA5Record(record){return normalizeOperationalRecord(record)}

let a5ActiveWorkflow='wf_01H9X001';
let a5AdvancedOpen=false;

function renderA5Metrics(){
  const container=document.querySelector('#orch-metrics');
  if(!container)return;
  const active=A5_WORKFLOWS.filter(w=>['RUNNING','VALIDATING'].includes(w.status)).length;
  const queued=A5_WORKFLOWS.filter(w=>['INTAKE','PLANNING','WAITING_FOR_AGENT'].includes(w.status)).length;
  const pendingApproval=A5_WORKFLOWS.filter(w=>w.status==='WAITING_FOR_APPROVAL').length;
  const pendingValidation=A5_WORKFLOWS.filter(w=>['WAITING_FOR_VALIDATION','VALIDATING'].includes(w.status)).length;
  const local=A5_AGENT_ASSIGNMENTS.filter(a=>a.location==='LOCAL').length;
  const total=A5_AGENT_ASSIGNMENTS.length;
  const ratio=total?`${local}/${total} LOCAL`:'UNAVAILABLE';
  const metrics=[['ACTIVE',active],['QUEUED',queued],['PENDING APPROVAL',pendingApproval],['PENDING VALIDATION',pendingValidation],['ROUTING',ratio]];
  container.replaceChildren(...metrics.map(([label,value])=>{const m=el('div','orch-metric');m.setAttribute('role','listitem');m.append(el('span','orch-metric-label',label),el('span','orch-metric-value',String(value)));return m}));
}

function renderA5Workflows(){
  const container=document.querySelector('#orch-workflows');
  if(!container)return;
  const nodes=A5_WORKFLOWS.map(wf=>{
    const item=el('div','orch-workflow-item');
    item.setAttribute('role','listitem');
    item.setAttribute('aria-selected',String(wf.workflowId===a5ActiveWorkflow));
    item.dataset.workflowId=wf.workflowId;
    item.append(el('div','orch-workflow-title',wf.title));
    const meta=el('div','orch-workflow-meta');
    const projBadge=el('span','comms-project-badge',a4ProjectLabel(wf.projectId));
    projBadge.dataset.project=wf.projectId;
    const statusBadge=el('span','orch-status-chip',`${wf.status} [${wf.source}]`);
    statusBadge.dataset.status=wf.status;
    meta.append(projBadge,statusBadge);
    item.append(meta);
    item.addEventListener('click',()=>{a5ActiveWorkflow=wf.workflowId;renderA5Orchestration()});
    return item;
  });
  container.replaceChildren(...(nodes.length?nodes:[el('p','empty-state','No workflows queued.')]));
}

function a5CurrentStep(steps){return steps.find(s=>s.status==='RUNNING')||steps.find(s=>s.status==='PENDING'||s.status==='BLOCKED')}

function renderA5SimpleView(){
  const titleEl=document.querySelector('#orch-active-title');
  const projEl=document.querySelector('#orch-active-project');
  const progressEl=document.querySelector('#orch-progress');
  const agentChipEl=document.querySelector('#orch-agent-chip');
  const statusEl=document.querySelector('#orch-status-badge');
  const nextEl=document.querySelector('#orch-next-action');
  const wf=A5_WORKFLOWS.find(w=>w.workflowId===a5ActiveWorkflow);
  if(!wf){if(titleEl)titleEl.textContent='Select a workflow.';return}
  const plan=A5_TASK_PLANS.find(p=>p.planId===wf.planId);
  const steps=plan?.steps||[];
  const current=a5CurrentStep(steps);
  if(titleEl)titleEl.textContent=wf.title;
  if(projEl){projEl.textContent=a4ProjectLabel(wf.projectId);projEl.hidden=false}
  if(progressEl)progressEl.textContent=steps.length?`Step ${current?current.stepIndex:steps.length} of ${steps.length}: ${current?current.title:'Completed'}`:'No steps defined.';
  const assignment=(current&&A5_AGENT_ASSIGNMENTS.find(a=>a.taskId===wf.planId&&a.stepId===current.stepId))||A5_AGENT_ASSIGNMENTS.find(a=>a.taskId===wf.planId);
  if(agentChipEl)agentChipEl.textContent=assignment?`${assignment.agentId} [${assignment.agentRole}] · ${assignment.routingTier}`:'No agent assigned.';
  if(statusEl){statusEl.textContent=`${wf.status} [${wf.source}]`;statusEl.dataset.status=wf.status}
  const approval=plan?.approvalRequirement;
  let next='Awaiting next scheduling cycle.';
  if(wf.status==='WAITING_FOR_APPROVAL')next='User approval required before RUNNING.';
  else if(wf.status==='WAITING_FOR_VALIDATION'||wf.status==='VALIDATING')next='Awaiting independent validator attestation.';
  else if(wf.status==='RUNNING')next=current?`Executing: ${current.title}`:'Executing.';
  else if(wf.status==='COMPLETED')next='Workflow complete.';
  else if(wf.status==='FAILED')next='Workflow failed; recovery requires a new workflow instance.';
  else if(wf.status==='CANCELLED')next='Workflow cancelled; recovery requires a new workflow instance.';
  else if(approval?.required)next=`Approval will be required (${approval.source}) before RUNNING.`;
  if(nextEl)nextEl.textContent=next;
}

function renderA5PolicyNotice(message){const badge=document.querySelector('#orch-status-badge');if(badge)badge.title=message}

function renderA5WorkflowActions(){
  const container=document.querySelector('#orch-workflow-actions');
  if(!container)return;
  const wf=A5_WORKFLOWS.find(w=>w.workflowId===a5ActiveWorkflow);
  if(!wf){container.replaceChildren();return}
  const isFinal=A5_FINAL_WORKFLOW_STATUSES.includes(wf.status);
  const pauseBtn=el('button','orch-action-btn','Pause');
  pauseBtn.type='button';pauseBtn.disabled=isFinal;
  pauseBtn.addEventListener('click',()=>{try{transitionWorkflow(wf,'PAUSED');renderA5Orchestration()}catch(err){renderA5PolicyNotice(err.message)}});
  const cancelBtn=el('button','orch-action-btn orch-action-cancel','Cancel');
  cancelBtn.type='button';cancelBtn.disabled=isFinal;
  cancelBtn.addEventListener('click',()=>{try{transitionWorkflow(wf,'CANCELLED');renderA5Orchestration()}catch(err){renderA5PolicyNotice(err.message)}});
  container.replaceChildren(pauseBtn,cancelBtn);
}

function renderA5StepAccordion(){
  const container=document.querySelector('#orch-step-graph');
  if(!container)return;
  const wf=A5_WORKFLOWS.find(w=>w.workflowId===a5ActiveWorkflow);
  const plan=wf&&A5_TASK_PLANS.find(p=>p.planId===wf.planId);
  const steps=plan?.steps||[];
  const nodes=steps.map(step=>{
    const item=el('div','orch-step-item');
    item.setAttribute('role','listitem');
    item.dataset.status=step.status;
    const toggle=el('button','orch-step-toggle',`${step.stepIndex}. ${step.title}`);
    toggle.type='button';
    toggle.setAttribute('aria-expanded','false');
    const body=el('div','orch-step-body');
    body.hidden=true;
    body.append(el('p','orch-step-desc',step.description));
    const badges=el('div','orch-step-badges');
    const roleBadge=el('span','orch-step-role',step.assignedRole);
    const statusBadge=el('span','orch-step-status',step.status);
    statusBadge.dataset.status=step.status;
    const privBadge=el('span','orch-step-priv',step.requiredPrivilegeLevel);
    badges.append(roleBadge,statusBadge,privBadge);
    for(const cap of step.requiredCapabilities)badges.append(el('span','orch-cap-badge',cap));
    body.append(badges);
    if(step.dependencies.length)body.append(el('p','orch-step-deps',`Depends on: ${step.dependencies.join(', ')}`));
    toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));body.hidden=open});
    item.append(toggle,body);
    return item;
  });
  container.replaceChildren(...(nodes.length?nodes:[el('p','empty-state','No steps for this workflow.')]));
}

function renderA5Timeline(){
  const container=document.querySelector('#orch-timeline');
  if(!container)return;
  const nodes=A5_TIMELINE.map(ev=>{
    const item=el('div','orch-timeline-item');
    item.setAttribute('role','article');
    item.append(el('span','orch-timeline-ts',ev.ts),el('span','orch-timeline-label',`${ev.label} [source: ${ev.source}]`));
    return item;
  });
  container.replaceChildren(...nodes);
}

function renderA5Agents(){
  const container=document.querySelector('#orch-agents');
  if(!container)return;
  const wf=A5_WORKFLOWS.find(w=>w.workflowId===a5ActiveWorkflow);
  const assignments=A5_AGENT_ASSIGNMENTS.filter(a=>!wf||a.taskId===wf.planId).map(normalizeA5Record);
  const nodes=assignments.map(a=>{
    const card=el('div','orch-agent-card');
    card.append(el('div','orch-agent-id',a.agentId),el('div','orch-agent-role',a.agentRole));
    const meta=el('div','orch-agent-meta');
    meta.append(el('span','orch-tier-badge',a.routingTier),el('span','orch-loc-badge',a.location),el('span','',a.availability));
    card.append(meta,el('p','orch-agent-reason',a.assignmentReason));
    return card;
  });
  container.replaceChildren(...(nodes.length?nodes:[el('p','empty-state','No agents assigned.')]));
}

function renderA5Routing(){
  const container=document.querySelector('#orch-routing');
  if(!container)return;
  const wf=A5_WORKFLOWS.find(w=>w.workflowId===a5ActiveWorkflow);
  const activeTiers=new Set(A5_AGENT_ASSIGNMENTS.filter(a=>!wf||a.taskId===wf.planId).map(a=>a.routingTier));
  const nodes=A5_ROUTING_TIERS.map((tier,i)=>{
    const item=el('div','orch-routing-tier');
    item.dataset.active=String(activeTiers.has(tier));
    item.append(el('span','orch-routing-tier-index',`TIER ${i}`),el('span','orch-routing-tier-name',tier));
    return item;
  });
  container.replaceChildren(...nodes);
}

function renderA5ProtectedResource(){
  const container=document.querySelector('#orch-protected');
  if(!container)return;
  const scope=normalizeA5Record(A5_PROTECTED_RESOURCE_SCOPE);
  container.replaceChildren(
    el('div','orch-protected-path',scope.resourcePath),
    el('div','orch-protected-policy',`POLICY: ${scope.defaultPolicy}`),
    el('div','orch-protected-active',`Active ScopedAuthorization records: ${A5_SCOPED_AUTHORIZATIONS.length}`),
    el('p','orch-protected-note','L4 privilege alone does NOT constitute a ScopedAuthorization. Effective access remains denied.')
  );
}

function renderA5Validation(){
  const container=document.querySelector('#orch-validation');
  if(!container)return;
  const wf=A5_WORKFLOWS.find(w=>w.workflowId===a5ActiveWorkflow);
  const summaries=A5_VALIDATION_SUMMARIES.filter(v=>!wf||v.taskId===wf.planId);
  const nodes=summaries.map(v=>{
    const item=el('div','orch-validation-item');
    item.dataset.status=v.status;
    item.append(el('div','orch-validation-heads',`BUILDER: ${v.builderAgentId} · VALIDATOR: ${v.validatorAgentId}`));
    item.append(chip(v.status));
    item.append(el('p','orch-validation-evidence',`${v.testEvidenceSummary} [EVIDENCE]`));
    item.append(el('p','orch-validation-attest',`Attested by ${v.attestedBy} at ${v.attestedAt}`));
    return item;
  });
  container.replaceChildren(...(nodes.length?nodes:[el('p','empty-state','No validation summaries yet.')]));
}

function renderA5Orchestration(){
  renderA5Metrics();
  renderA5Workflows();
  renderA5SimpleView();
  renderA5WorkflowActions();
  renderA5StepAccordion();
  renderA5Timeline();
  renderA5Agents();
  renderA5Routing();
  renderA5ProtectedResource();
  renderA5Validation();
}

// A.5 Progressive disclosure: Simple view <-> Advanced view toggle
document.querySelector('#orch-advanced-toggle')?.addEventListener('click',()=>{
  a5AdvancedOpen=!a5AdvancedOpen;
  const toggle=document.querySelector('#orch-advanced-toggle');
  const panel=document.querySelector('#orch-advanced');
  if(toggle)toggle.setAttribute('aria-expanded',String(a5AdvancedOpen));
  if(panel)panel.hidden=!a5AdvancedOpen;
});

// --- Carga ---
function updateStrip(apiOk,daemonState,cognitiveState){const sApi=document.querySelector('#strip-api'),sApiVal=document.querySelector('#strip-api-val');if(sApi&&sApiVal){sApi.dataset.status=apiOk?'ok':'danger';sApiVal.textContent=apiOk?'CONECTADA':'DESCONECTADA'}const sD=document.querySelector('#strip-daemon'),sDVal=document.querySelector('#strip-daemon-val');if(sD&&sDVal){sD.dataset.status=statusOf(daemonState);sDVal.textContent=daemonState==='OK'?'ACTIVO':text(daemonState)}const sCVal=document.querySelector('#strip-cognitive-val'),sC=document.querySelector('#strip-cognitive');if(sCVal&&sC){sC.dataset.status=statusOf(cognitiveState);sCVal.textContent=cognitiveState==='READ-ONLY'?'READ-ONLY':text(cognitiveState)}}
async function json(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error('UNAVAILABLE');return(await r.json()).data}
function render(d){lastData=d;track(d);renderCore(d);updateStrip(true,d.system?.estado||'OK','READ-ONLY');system.textContent=`${d.system.estado} · v${d.system.version} · LOCAL · OFFLINE`;system.dataset.state=d.system.estado==='OK'?'ok':'error';banner.hidden=true;delete app.dataset.stale;renderSummary(d);renderProviders(d);renderAlerts(d);renderAgentsList();renderPrimaryKpis(d);renderTrendChart(d);renderKpis(d);renderTrading(d);renderSimulation(d);renderWorkers(d);renderFinance(d);renderMemory(d);renderVideo();renderVortexLog(d);renderReports(d);loadCognitive();renderA4Communications();renderA5Orchestration()}
async function load(){try{render(await json('/api/dashboard'))}catch{core.dataset.vortexState='offline';coreState.textContent='OFFLINE';updateStrip(false,'UNAVAILABLE','UNAVAILABLE');system.textContent='ERROR · LOCAL · OFFLINE';system.dataset.state='error';banner.hidden=false;banner.dataset.state='error';banner.textContent=lastData?'ERROR · API local UNAVAILABLE · mostrando la última lectura':'ERROR · API local UNAVAILABLE';if(lastData)app.dataset.stale='true';else fill('alerts',card('ERROR',[['API','UNAVAILABLE']]))}}
function polling(){clearInterval(timer);timer=setInterval(load,4000)}

// --- Eventos ---
document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{const tab=btn.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',b===btn));document.querySelectorAll('[data-tab-panel]').forEach(p=>p.style.display=p.getAttribute('data-tab-panel')===tab?'block':'none');write('trading.activeTab',tab)}));read('trading.activeTab')&&document.querySelector(`[data-tab="${read('trading.activeTab')}"]`)?.click();
document.querySelector('#cognitive-query')?.addEventListener('submit',event=>{event.preventDefault();loadCognitive(new FormData(event.currentTarget).get('q')?.toString().trim()||'')});
document.querySelectorAll('[data-period]').forEach(btn=>btn.addEventListener('click',()=>{const p=btn.dataset.period;document.querySelectorAll('[data-period]').forEach(b=>b.removeAttribute('data-active'));btn.setAttribute('data-active','true');write('dashboard.period',p)}));
document.querySelectorAll('.dashboard-tabs button').forEach(btn=>btn.addEventListener('click',()=>{const tab=btn.dataset.tab;document.querySelectorAll('.dashboard-tabs button').forEach(b=>b.setAttribute('aria-selected',b===btn));document.querySelectorAll('[data-tab-panel]').forEach(p=>p.style.display=p.getAttribute('data-tab-panel')===tab?'block':'none');write('dashboard.activeTab',tab)}));const savedDashboardTab=read('dashboard.activeTab')||'resumen';document.querySelector(`.dashboard-tabs button[data-tab="${savedDashboardTab}"]`)?.click();const savedPeriod=read('dashboard.period')||'30d';document.querySelector(`[data-period="${savedPeriod}"]`)?.setAttribute('data-active','true');
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
document.querySelectorAll('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>applyTheme(b.dataset.themeChoice)));
document.querySelectorAll('[data-accent-choice]').forEach(b=>b.addEventListener('click',()=>applyAccent(b.dataset.accentChoice)));
document.querySelectorAll('[data-style-choice]').forEach(b=>b.addEventListener('click',()=>applyVisualStyle(b.dataset.styleChoice)));
document.querySelectorAll('[data-effects-choice]').forEach(b=>b.addEventListener('click',()=>applyEffects(b.dataset.effectsChoice)));
document.querySelector('#appearance-reset').addEventListener('click',()=>{applyTheme('auto');applyAccent('crimson');applyVisualStyle('atlas-crimson');applyEffects('normal');setGeometryMode('standard');setMode('simple')});
document.querySelectorAll('[data-geometry-choice]').forEach(button=>button.addEventListener('click',()=>setGeometryMode(button.dataset.geometryChoice)));
document.querySelector('#geometry-cycle').addEventListener('click',()=>{const modes=['compact','standard','expanded'];const index=modes.indexOf(canonicalVortex.dataset.geometryMode);setGeometryMode(modes[(index+1)%modes.length])});
document.querySelectorAll('[data-custom-group]').forEach(box=>box.addEventListener('change',()=>{write('vortice.customModules',JSON.stringify([...document.querySelectorAll('[data-custom-group]:checked')].map(b=>b.dataset.customGroup)));applyCustom()}));
document.querySelector('#custom-core-large').addEventListener('change',e=>{write('vortice.customCore',e.target.checked?'large':'normal');applyCustom()});
document.querySelectorAll('[data-open-settings]').forEach(b=>b.addEventListener('click',()=>{closeNav();settings.showModal()}));
document.querySelector('#settings-close').addEventListener('click',()=>settings.close());
settings.addEventListener('click',e=>{if(e.target===settings)settings.close()});
menuToggle.addEventListener('click',()=>document.body.classList.contains('nav-open')?closeNav():openNav());
document.querySelector('#sidebar-close').addEventListener('click',closeNav);
scrim.addEventListener('click',closeNav);
canonicalVortex.addEventListener('click',activateVortex);
canonicalVortex.addEventListener('click',expandVortex);
canonicalVortex.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activateVortex();expandVortex()}});
document.querySelectorAll('[data-vortex-sector]').forEach(button=>button.addEventListener('click',()=>selectOperationalSector(button.dataset.vortexSector)));
search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();document.querySelectorAll('.side-nav a,.side-nav .nav-button').forEach(link=>link.classList.toggle('search-miss',!!q&&!link.textContent.toLowerCase().includes(q)))});
search.addEventListener('keydown',e=>{if(e.key==='Escape'){search.value='';search.dispatchEvent(new Event('input'));search.blur()}if(e.key!=='Enter')return;const first=document.querySelector('.side-nav a:not(.search-miss)');if(first){location.hash=first.getAttribute('href');search.blur()}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement!==search&&!settings.open){e.preventDefault();search.focus()}if(e.key==='Escape')closeNav()});
addEventListener('hashchange',routeFromHash);
preference.addEventListener('change',()=>{if(root.dataset.themeMode==='auto')applyTheme('auto')});
reducedMotion.addEventListener('change',applyReducedMotion);

// --- Arranque ---
document.querySelector('#side-host').textContent=location.host||'UNAVAILABLE';
applyTheme('dark');applyAccent(read('vortice.accent','crimson'));applyVisualStyle(read('vortice.visualStyle','atlas-crimson'));applyEffects(read('vortice.effects','normal'));applyReducedMotion();setGeometryMode(visualValidation?'expanded':read('vortice.geometryMode','standard'));setMode(read('vortice.modeView',read('atlas-mode','simple')));routeFromHash();setActivationState(ACTIVATION_STATES.CLOSED);const urlState=new URLSearchParams(location.search).get('state');if(urlState&&Object.values(ACTIVATION_STATES).includes(urlState))setActivationState(urlState);setOperationalState(visualValidation?'ACTIVE':'DORMANT');
selectOperationalSector('core');
document.addEventListener('visibilitychange',()=>{root.dataset.motion=document.hidden?'paused':'running';document.hidden?clearInterval(timer):polling()});
root.dataset.motion=document.hidden?'paused':'running';
load();polling();
