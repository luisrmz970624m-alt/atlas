// ATLAS · El Vórtice — centro de mando local. Solo lee /api/dashboard; no inventa datos.
// Todo valor dinámico se escribe con textContent/atributos; nunca se interpreta HTML recibido.
const app=document.querySelector('#app'),system=document.querySelector('#system'),template=document.querySelector('#card'),kpiTemplate=document.querySelector('#kpi'),root=document.documentElement,core=document.querySelector('#vortex-core'),coreState=document.querySelector('#vortex-state'),banner=document.querySelector('#banner'),settings=document.querySelector('#settings'),search=document.querySelector('#search');
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
  reportes:['Reportes','Reportes','Auditoría reciente, recursos y resumen de esta sesión.'],
  alertas:['Alertas','Alertas','Alertas emitidas por el sistema local.']
};
function setView(view){if(!VIEWS[view])view='inicio';const [crumb,title,lead]=VIEWS[view];app.dataset.view=view;document.querySelector('#view-crumb').textContent=crumb;document.querySelector('#view-title').textContent=title;document.querySelector('#view-lead').textContent=lead;document.querySelectorAll('[data-nav]').forEach(link=>link.dataset.nav===view?link.setAttribute('aria-current','page'):link.removeAttribute('aria-current'));document.querySelectorAll('.board [data-views]').forEach(panel=>panel.hidden=!panel.dataset.views.split(' ').includes(view));closeNav();if(lastData)renderKpis(lastData)}
const routeFromHash=()=>setView(location.hash.slice(1)||'inicio');

// --- Sidebar móvil ---
const menuToggle=document.querySelector('#menu-toggle'),scrim=document.querySelector('#scrim');
function openNav(){document.body.classList.add('nav-open');scrim.hidden=false;menuToggle.setAttribute('aria-expanded','true')}
function closeNav(){document.body.classList.remove('nav-open');scrim.hidden=true;menuToggle.setAttribute('aria-expanded','false')}

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
function renderKpis(d){const view=app.dataset.view,business=d.business||{},nodes=[];document.querySelector('#kpi-title').textContent=view==='inicio'||view==='empresa'?'Empresa · KPIs':`${VIEWS[view]?.[0]||'Empresa'} · KPIs`;for(const [key,label,get,kind,views] of KPIS){if(!views.includes(view))continue;const value=get(business),node=kpiTemplate.content.firstElementChild.cloneNode(true),series=history[key]||[];node.querySelector('.kpi-label').textContent=label;node.querySelector('.kpi-value').textContent=fmt(value,kind);node.dataset.status=typeof value==='number'?(key==='profit'&&value<0?'danger':'value'):statusOf(value);if(series.length>=2){const points=sparkPoints(series);node.dataset.trend=Math.min(...series)===Math.max(...series)?'flat':'true';node.querySelector('.spark-line').setAttribute('points',points);node.querySelector('.spark-area').setAttribute('points',`0,32 ${points} 100,32`);node.querySelector('.kpi-meta').textContent=`sesión · ${series.length} lecturas`}else node.querySelector('.kpi-meta').textContent=typeof value==='number'?'sesión · PENDING tendencia':'sin dato en la API';nodes.push(node)}fill('kpis',...nodes)}

// --- Barras ---
function bars(rows){const max=Math.max(0,...rows.map(([,v])=>typeof v==='number'?Math.abs(v):0));return rows.map(([label,value,tone])=>{const row=el('div','bar-row'),track=el('div','bar-track'),bar=el('div','bar-fill');if(tone)row.dataset.tone=tone;bar.style.width=typeof value==='number'&&max>0?`${(Math.abs(value)/max*100).toFixed(1)}%`:'0%';track.append(bar);row.append(el('span','key',label),track,el('span','bar-value',fmt(value)));return row})}
const metric=(label,value,kind='int')=>{const node=el('div','metric');node.dataset.status=typeof value==='number'?'value':statusOf(value);node.append(el('span','',label),el('strong','',fmt(value,kind)));return node};

// --- Módulos ---
const PROVIDER_DETAILS={ollama:{label:'Ollama',icon:'OL',type:'GENERACIÓN IA',origin:'LOCAL',policy:'LOCAL'},claude:{label:'Claude',icon:'CL',type:'GENERACIÓN IA',origin:'API',policy:'OPT-IN'},openai:{label:'ChatGPT / Codex',icon:'AI',type:'GENERACIÓN IA',origin:'API',policy:'OPT-IN'},chatgpt:{label:'ChatGPT / Codex',icon:'AI',type:'GENERACIÓN IA',origin:'API',policy:'OPT-IN'}};
function providerDetail(name){return PROVIDER_DETAILS[String(name).toLowerCase()]||{label:name,icon:String(name).slice(0,2).toUpperCase(),type:'UNAVAILABLE',origin:'UNAVAILABLE',policy:'UNAVAILABLE'}}
function providerLine(label,value){const row=el('span','provider-line');row.append(el('b','',label),el('span','',display(value)));return row}
function renderProviders(d){const entries=Object.entries(d.providers||{});const nodes=entries.map(([name,status])=>{const detail=providerDetail(name),state=display(String(status).toUpperCase()),item=el('article','provider provider-node'),head=el('div','provider-node-head'),icon=el('span','provider-mark',detail.icon),identity=el('div','provider-identity'),meta=el('div','provider-meta-grid');item.dataset.status=statusOf(state);item.dataset.origin=detail.origin.toLowerCase();identity.append(el('span','provider-name',detail.label),el('span','provider-type',detail.type));head.append(icon,identity,chip(state));meta.append(providerLine('ORIGEN',detail.origin),providerLine('DISPONIBILIDAD',state),providerLine('ACCESO',detail.policy));item.append(head,meta);return item});fill('providers',...(nodes.length?nodes:[emptyState('EMPTY · la API no reporta proveedores')]));fill('agents',card('SUPERVISIÓN',[['Policy activa',d.vortice?.modo],['Supervisor',undefined],['Proveedores reportados',entries.length||'EMPTY'],['Configurados',entries.filter(([,s])=>s==='configured').length],['Agentes registrados',undefined]]))}
function renderAlerts(d){const alerts=d.alerts||[],count=document.querySelector('#alert-count');count.hidden=!alerts.length;count.textContent=String(alerts.length);document.querySelector('#alerts-tag').textContent=alerts.length?`${alerts.length} ACTIVAS`:'EMPTY';fill('alerts',...(alerts.length?alerts.map(a=>{const item=el('div','alert-item'),body=el('div');item.dataset.status=statusOf(a.nivel);body.append(el('p','',text(a.mensaje)),el('span','provider-meta',`${text(a.codigo)} · ${a.simulated?'SIMULATED':'LOCAL'}`));item.append(chip(a.nivel),body);return item}):[card('ALERTAS',[['Estado','EMPTY']])]))}
function renderSummary(d){const b=d.business||{};fill('summary',card('VÓRTICE',[['Estado',d.vortice.estado],['Policy',d.vortice.modo],['Cola',d.vortice.cola],['Decisiones',d.vortice.decisiones?.length]]),card('EMPRESA · SIMULATED',[['Escenario',b.scenario],['Cash',fmt(b.caja)],['Profit',fmt(b.resultado)],['Employees',fmt(b.empleados,'int')]]))}
function renderTrading(d){const t=d.trading||{};fill('trading',card('TRADING · SOLO ESTADO',[['Trading Lab',t.tradingLab],['Backtester',t.backtester],['OOS',t.oos],['Walk-forward',t.walkForward],['Paper Trading',t.paper],['MT5 Bridge Local',t.mt5BridgeLocal],['MT5 Real',t.mt5Real]],'pipeline'))}
function renderSimulation(d){const s=d.simulations||{},total=s.totalWorkers,stack=el('div','stack');if(typeof total==='number'&&total>0){const other=Math.max(0,total-(s.running||0)-(s.paused||0)-(s.completed||0)-(s.failed||0));for(const [cls,v] of [['s-running',s.running],['s-paused',s.paused],['s-completed',s.completed],['s-failed',s.failed],['s-other',other]]){if(!v)continue;const seg=el('i',cls);seg.style.width=`${(v/total*100).toFixed(1)}%`;seg.title=`${cls.slice(2)} · ${v}`;stack.append(seg)}}const grid=el('div','metric-grid');grid.append(metric('Workers',total),metric('Running',s.running),metric('Paused',s.paused),metric('Completed',s.completed),metric('Failed',s.failed),metric('Trading',s.trading),metric('Empresa',s.empresa));fill('simulation',...(typeof total==='number'&&total>0?[stack,grid]:[emptyState('EMPTY · sin workers de simulación registrados'),grid]))}
function renderWorkers(d){const workers=d.simulations?.workers||[];if(!workers.length)return fill('workers',emptyState('EMPTY · sin workers'));const table=el('table'),head=el('tr');for(const h of ['ID','Tipo','Dominio','Estado','Prioridad','Progreso'])head.append(el('th','',h));const body=el('tbody');for(const w of workers){const tr=el('tr'),state=el('td'),progress=el('td'),bar=el('div','progress'),fillBar=el('i');state.append(chip(w.estado==='FAILED'?'FAILED':w.estado));fillBar.style.width=`${Math.max(0,Math.min(100,Number(w.progress)||0))}%`;bar.append(fillBar);progress.append(bar);tr.append(el('td','',text(w.id).slice(0,12)),el('td','',text(w.tipo)),el('td','',text(w.dominio)),state,el('td','',text(w.prioridad)),progress);body.append(tr)}const thead=el('thead');thead.append(head);table.append(thead,body);fill('workers',table)}
function renderFinance(d){const b=d.business||{};fill('finance',...bars([['Revenue',b.ventas],['Nómina',b.gastos,'warning'],['Profit',b.resultado,typeof b.resultado==='number'&&b.resultado<0?'danger':'success'],['Cash',b.caja]]));fill('accounts',...bars([['Por cobrar',b.cuentasCobrar,'success'],['Por pagar',b.cuentasPagar,'danger']]))}
function renderMemory(d){const m=d.memory?.empresa||{},keys=['OBSERVADA','EVALUADA','CANDIDATA','VALIDADA','RECHAZADA'],tones={VALIDADA:'success',RECHAZADA:'danger',CANDIDATA:'warning'};const total=keys.reduce((s,k)=>s+(Number(m[k])||0),0);fill('memory',...(Object.keys(m).length?bars(keys.map(k=>[k.charAt(0)+k.slice(1).toLowerCase(),m[k],tones[k]])):[emptyState('UNAVAILABLE · la API no reporta memoria')]),...(Object.keys(m).length&&!total?[emptyState('EMPTY · sin experiencias registradas')]:[]))}
function renderVideo(){const unavailable=()=>emptyState('UNAVAILABLE');document.querySelector('#video-tag').textContent='UNAVAILABLE';fill('video-status',card('MÓDULO',[['Disponibilidad','UNAVAILABLE'],['Fuente','UNAVAILABLE'],['Modo','UNAVAILABLE'],['Worker','UNAVAILABLE']]));fill('video-objects',unavailable());fill('video-motion',unavailable());fill('video-events',unavailable());fill('video-summary',unavailable())}
function renderVortexLog(d){const decisions=d.vortice?.decisiones||[];const list=el('div','timeline');for(const item of decisions.slice(-12).reverse()){const row=el('div','tl-item');row.append(el('span','tl-time','decisión'),el('span','',typeof item==='string'?item:text(item?.accion)),chip('LOCAL'));list.append(row)}fill('vortex-log',card('VÓRTICE · DETALLE',[['Estado',d.vortice?.estado],['Policy',d.vortice?.modo],['Cola',d.vortice?.cola],['Decisiones',decisions.length||'EMPTY']]),...(decisions.length?[list]:[]))}
function renderReports(d){const events=d.audit?.eventos||[];const list=el('div','timeline');for(const e of events.slice().reverse()){const row=el('div','tl-item');row.append(el('span','tl-time',text(e.timestamp)),el('span','',text(e.categoria)),chip(e.resultado));list.append(row)}fill('audit',...(events.length?[list]:[emptyState('EMPTY · sin eventos de auditoría')]));const r=d.resources||{};fill('resources',card('RECURSOS',[['Origen',r.origen],['CPU',r.cpu],['RAM',r.ram],['Workers activos',r.workers]]));fill('session',card('SESIÓN LOCAL',[['Versión',d.system?.version],['Estado sistema',d.system?.estado],['Lecturas en esta sesión',samples],['Última lectura',new Date().toLocaleTimeString('es-MX')],['Eventos de auditoría',events.length||'EMPTY'],['Alertas',(d.alerts||[]).length||'EMPTY']]))}

// --- Carga ---
async function json(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error('UNAVAILABLE');return(await r.json()).data}
function render(d){lastData=d;track(d);renderCore(d);system.textContent=`${d.system.estado} · v${d.system.version} · LOCAL · OFFLINE`;system.dataset.state=d.system.estado==='OK'?'ok':'error';banner.hidden=true;delete app.dataset.stale;renderSummary(d);renderProviders(d);renderAlerts(d);renderKpis(d);renderTrading(d);renderSimulation(d);renderWorkers(d);renderFinance(d);renderMemory(d);renderVideo();renderVortexLog(d);renderReports(d)}
async function load(){try{render(await json('/api/dashboard'))}catch{core.dataset.vortexState='offline';coreState.textContent='OFFLINE';system.textContent='ERROR · LOCAL · OFFLINE';system.dataset.state='error';banner.hidden=false;banner.dataset.state='error';banner.textContent=lastData?'ERROR · API local UNAVAILABLE · mostrando la última lectura':'ERROR · API local UNAVAILABLE';if(lastData)app.dataset.stale='true';else fill('alerts',card('ERROR',[['API','UNAVAILABLE']]))}}
function polling(){clearInterval(timer);timer=setInterval(load,4000)}

// --- Eventos ---
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
document.querySelectorAll('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>applyTheme(b.dataset.themeChoice)));
document.querySelectorAll('[data-accent-choice]').forEach(b=>b.addEventListener('click',()=>applyAccent(b.dataset.accentChoice)));
document.querySelectorAll('[data-style-choice]').forEach(b=>b.addEventListener('click',()=>applyVisualStyle(b.dataset.styleChoice)));
document.querySelectorAll('[data-effects-choice]').forEach(b=>b.addEventListener('click',()=>applyEffects(b.dataset.effectsChoice)));
document.querySelector('#appearance-reset').addEventListener('click',()=>{applyTheme('auto');applyAccent('crimson');applyVisualStyle('atlas-crimson');applyEffects('normal');setMode('simple')});
document.querySelectorAll('[data-custom-group]').forEach(box=>box.addEventListener('change',()=>{write('vortice.customModules',JSON.stringify([...document.querySelectorAll('[data-custom-group]:checked')].map(b=>b.dataset.customGroup)));applyCustom()}));
document.querySelector('#custom-core-large').addEventListener('change',e=>{write('vortice.customCore',e.target.checked?'large':'normal');applyCustom()});
document.querySelectorAll('[data-open-settings]').forEach(b=>b.addEventListener('click',()=>{closeNav();settings.showModal()}));
document.querySelector('#settings-close').addEventListener('click',()=>settings.close());
settings.addEventListener('click',e=>{if(e.target===settings)settings.close()});
menuToggle.addEventListener('click',()=>document.body.classList.contains('nav-open')?closeNav():openNav());
document.querySelector('#sidebar-close').addEventListener('click',closeNav);
scrim.addEventListener('click',closeNav);
search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();document.querySelectorAll('.side-nav a,.side-nav .nav-button').forEach(link=>link.classList.toggle('search-miss',!!q&&!link.textContent.toLowerCase().includes(q)))});
search.addEventListener('keydown',e=>{if(e.key==='Escape'){search.value='';search.dispatchEvent(new Event('input'));search.blur()}if(e.key!=='Enter')return;const first=document.querySelector('.side-nav a:not(.search-miss)');if(first){location.hash=first.getAttribute('href');search.blur()}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement!==search&&!settings.open){e.preventDefault();search.focus()}if(e.key==='Escape')closeNav()});
addEventListener('hashchange',routeFromHash);
preference.addEventListener('change',()=>{if(root.dataset.themeMode==='auto')applyTheme('auto')});
reducedMotion.addEventListener('change',applyReducedMotion);

// --- Arranque ---
document.querySelector('#side-host').textContent=location.host||'UNAVAILABLE';
applyTheme(read('vortice.theme','auto'));applyAccent(read('vortice.accent','crimson'));applyVisualStyle(read('vortice.visualStyle','atlas-crimson'));applyEffects(read('vortice.effects','normal'));applyReducedMotion();setMode(read('vortice.modeView',read('atlas-mode','simple')));routeFromHash();
document.addEventListener('visibilitychange',()=>{root.dataset.motion=document.hidden?'paused':'running';document.hidden?clearInterval(timer):polling()});
root.dataset.motion=document.hidden?'paused':'running';
load();polling();
