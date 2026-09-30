# ATLAS FINAL UI — PHASE A.3

| Campo | Valor |
|---|---|
| PHASE | ATLAS FINAL UI — PHASE A.3 |
| CODENAME | Operational Vortex |
| SPEC_VERSION | 1.0 |
| STATUS | APPROVED_FOR_IMPLEMENTATION_SPEC |
| BASELINE | Phase A.2 GREEN |
| DATE | 2026-09-27 |
| OWNER | Atlas Orchestrator / User |

> Esta es la fuente autoritativa para la implementación de Phase A.3, salvo que una especificación posterior con versión explícita la sustituya.

## 1. Objetivo y principio de producto

Phase A.3 convierte el Vórtice canónico en una puerta de entrada a información operacional segura de Atlas. Es una fase **READ-ONLY / MOCK-FIRST**: muestra estado y procedencia; no ejecuta acciones de host, red, mensajería ni trading.

El Vórtice canónico de Phase A.2 no se reemplaza ni se convierte en un dashboard independiente. El modelo de interacción es:

```text
Canonical Vortex -> sector/módulo seleccionado -> panel de información operacional -> estado seguro de Atlas
```

Los paneles son extensiones contextuales de esa interacción y deben conservar la identidad visual, navegación y respuesta ya soportada en escritorio y móvil.

## 2. Compatibilidad obligatoria con Phase A.2

La implementación A.3 debe preservar sin regresiones:

- El SVG `#canonical-vortex`, su `viewBox`, clases, etiquetas ARIA y las nueve capas visuales verificadas por Phase A.
- El CSS de estado de entrada (`vortex-entry-intro`), su visibilidad inicial y la activación del Vórtice.
- Los estados interactivos existentes, incluida la variable de velocidad, hover y estados error/paused/offline.
- `prefers-reduced-motion` y la pausa/reanudación de animaciones al cambiar la visibilidad de la pestaña.
- El comportamiento responsive que ya existe para escritorio, tablet y móvil.
- Las invariantes existentes de UI que prohíben palabras/acciones de trading donde Phase A las prohíbe.

No se autoriza sustituir, eliminar, redibujar de forma incompatible ni desacoplar el Vórtice canónico para introducir A.3.

## 3. Contrato de verdad y procedencia

Todo dato operacional visible debe llevar una clasificación de verdad. La interfaz debe distinguir visual y semánticamente: `REAL`, `VERIFIED`, `MOCK`, `SIMULATED`, `OFFLINE`, `UNAVAILABLE` y `STALE`.

Reglas obligatorias:

- `CONNECTED`, `READY`, `ACTIVE` u `ONLINE` para un sistema externo solo pueden mostrarse cuando el estado subyacente está realmente verificado.
- Un agente o integración sin conexión real comprobada debe mostrarse como `MOCK`, `SIMULATED`, `OFFLINE` o `UNAVAILABLE`, según corresponda.
- Datos mock y datos verificados no se mezclan silenciosamente. Cada fila/tarjeta debe revelar su fuente o heredar una fuente visible e inequívoca del panel.
- Nunca se muestran secretos, valores de credenciales, tokens, claves, cabeceras de autorización ni logs que los contengan.
- Una fecha de actualización no convierte un dato mock en verificado; la procedencia y la frescura son campos independientes.

Ejemplos correctos: `Claude — MOCK`, `Codex — SIMULATED`, `System telemetry — STALE`, `Telegram — UNAVAILABLE`.

Ejemplos prohibidos sin integración verificada: `Claude — CONNECTED`, `Telegram — ONLINE`.

## 4. Superficies operacionales requeridas

### 4.1 CORE / ATLAS STATUS

Debe mostrar el estado actual de Atlas, modo offline/online, contexto de proyecto, salud global y frescura de los datos. Un estado online sin evidencia debe degradarse a `UNAVAILABLE` o al estado mock correspondiente.

### 4.2 AGENTS

Debe listar agentes registrados o mock con nombre, estado, referencia de tarea actual si existe, resumen de capacidades y clasificación local/cloud cuando esté disponible. Estados permitidos: `READY`, `BUSY`, `IDLE`, `OFFLINE`, `DISABLED`, `MOCK`. Los agentes mock deben llevar etiqueta visible `MOCK` o `SIMULATED`; ningún nombre de proveedor implica una conexión real.

### 4.3 TASKS

Debe exponer grupos o filtros `ACTIVE`, `PENDING`, `COMPLETED` y `FAILED`. Cada tarea muestra como mínimo ID, objetivo corto, agente asignado, estado, nivel de privilegio si se conoce y contexto de proyecto. La vista es informativa: no inicia, cancela, reintenta ni reasigna tareas.

### 4.4 SYSTEM

Debe representar contratos de telemetría de CPU, RAM, almacenamiento, modo de red y estado offline. A.3 no requiere telemetría del host. Si no existe un contrato local, seguro y read-only ya disponible, se usan fixtures deterministas y claramente `MOCK`/`SIMULATED`, o `UNAVAILABLE`.

### 4.5 KNOWLEDGE

Debe mostrar proyecto activo y decisiones/hechos validados recientes solo si hay una fuente segura existente. Cada elemento muestra validación y procedencia. Si no hay fuente segura, se limita a mocks visibles o `UNAVAILABLE`.

### 4.6 SECURITY

Debe mostrar el indicador de privilegio `L0`–`L4`, estado/conteo de aprobaciones pendientes, modo protegido, estado de `ATLAS_SIN_RED` y estado de trading real. Es exclusivamente descriptivo: no concede ni cambia privilegios, no aprueba acciones y no habilita trading.

### 4.7 ACTIVITY / EVENTS

Debe presentar una línea temporal corta de actividad y eventos/tareas con estado, procedencia y timestamp. No contiene valores secretos ni credenciales crudas.

### 4.8 FREE_FIRST / ROUTING STATUS

Debe mostrar si `FREE_FIRST` está habilitado, deshabilitado o es mock. Solo muestra tier/estado de routing si existe una fuente segura; de lo contrario usa `MOCK`/`UNAVAILABLE` de forma visible. No cambia proveedores ni rutas.

## 5. Contratos UI seguros

Los contratos siguientes son interfaces de documentación. Una implementación posterior puede añadir campos compatibles, pero no eliminar los requeridos ni relajar sus restricciones.

```ts
type SourceClassification = 'REAL' | 'VERIFIED' | 'MOCK' | 'SIMULATED' | 'UNAVAILABLE';
type FreshnessState = 'FRESH' | 'STALE' | 'OFFLINE' | 'UNAVAILABLE';
type PrivilegeLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

interface SourceMeta {
  source: SourceClassification;             // required
  freshness: FreshnessState;                 // required
  observedAt: string | null;                 // required ISO-8601 or null when unavailable
  expiresAt?: string | null;
  provenance?: string;                       // safe human-readable origin; never credentials
}

interface AtlasStatus extends SourceMeta {
  atlasStatus: 'READY' | 'BUSY' | 'IDLE' | 'OFFLINE' | 'DEGRADED' | 'UNAVAILABLE';
  networkMode: 'OFFLINE' | 'LOOPBACK_ONLY' | 'UNAVAILABLE';
  projectContext: string | null;
  health: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
}

interface AgentSummary extends SourceMeta {
  id: string;
  name: string;
  status: 'READY' | 'BUSY' | 'IDLE' | 'OFFLINE' | 'DISABLED' | 'MOCK';
  currentTaskId?: string | null;
  capabilities: string[];
  classification?: 'LOCAL' | 'CLOUD' | 'UNAVAILABLE';
}

interface TaskSummary extends SourceMeta {
  id: string;
  title: string;
  status: 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'FAILED';
  assignedAgent?: string | null;
  privilegeLevel?: PrivilegeLevel | null;
  projectContext: string | null;
}

interface SystemTelemetry extends SourceMeta {
  cpuPercent?: number | null;                // 0..100 only when a verified source supplies it
  ramPercent?: number | null;                // 0..100 only when a verified source supplies it
  storagePercent?: number | null;            // 0..100 only when a verified source supplies it
  networkMode: 'OFFLINE' | 'LOOPBACK_ONLY' | 'UNAVAILABLE';
  offline: boolean | null;
}

interface KnowledgeSummary extends SourceMeta {
  id: string;
  projectContext: string | null;
  summary: string;
  validation: 'VALIDATED' | 'UNVALIDATED' | 'MOCK' | 'UNAVAILABLE';
  reference?: string | null;
}

interface SecuritySummary extends SourceMeta {
  privilegeLevel: PrivilegeLevel;
  pendingApprovals: number | null;
  protectedMode: 'ENABLED' | 'DISABLED' | 'UNAVAILABLE';
  atlasSinRed: true | false | null;
  realTrading: 'BLOCKED' | 'UNAVAILABLE';
}

interface ActivityEvent extends SourceMeta {
  id: string;
  timestamp: string;
  category: 'AGENT' | 'TASK' | 'SYSTEM' | 'SECURITY' | 'ROUTING' | 'KNOWLEDGE';
  status: 'INFO' | 'SUCCESS' | 'WARNING' | 'FAILED' | 'UNAVAILABLE';
  message: string;
  taskId?: string | null;
}

interface RoutingSummary extends SourceMeta {
  freeFirst: 'ENABLED' | 'DISABLED' | 'MOCK' | 'UNAVAILABLE';
  tier?: string | null;
  routingState: 'AVAILABLE' | 'OFFLINE' | 'UNAVAILABLE' | 'MOCK';
}
```

`source: 'REAL'` exige evidencia verificable de una fuente ya autorizada; `VERIFIED` exige evidencia local comprobada; `MOCK` y `SIMULATED` exigen fixture determinista; `UNAVAILABLE` representa ausencia de fuente. `STALE` se expresa en `freshness`, sin ocultar el valor de `source`.

## 6. Política MOCK-FIRST y de lectura

Cuando un backend seguro no esté disponible, A.3 utiliza fixtures deterministas y los marca visiblemente `MOCK` o `SIMULATED`. No debe inferir, generar aleatoriamente ni presentar métricas inexistentes como reales. Los valores ausentes se presentan como `UNAVAILABLE`.

La lectura de datos solo puede usar contratos locales, explícitos, seguros y read-only. A.3 no debe introducir polling a proveedores externos, SDKs externos, fetch hacia Internet ni conectores de credenciales.

## 7. Invariantes de red y ejecución

- La validación A.3 se ejecuta con `ATLAS_SIN_RED=true`.
- Si se requiere listener de runtime, solo escucha en `127.0.0.1`; no se permite bind público.
- No se establece conexión con proveedores externos, brokers ni mensajería de producción.
- No se usan credenciales de producción ni se muestran en UI, fixtures o logs.
- Trading real permanece `BLOCKED`.
- No existe ruta de ejecución de comandos reales.

## 8. Fuera de alcance estricto

Phase A.3 no implementa terminal real, PTY, `sudo`, `root`, ejecución arbitraria de comandos, escrituras al host, cambios de configuración del sistema, trading real, dinero real, conexión de producción a broker, Telegram, Discord o WhatsApp de producción, listener público, VPN/túnel, credenciales de producción ni acciones automáticas de control remoto. Mensajería y ejecución de terminal pertenecen a fases posteriores.

## 9. Áreas probables de implementación futura (no autorizadas por esta tarea)

Una implementación posterior probablemente trabajará en `src/panel-vortice/index.html`, `src/panel-vortice/premium.css`, `src/panel-vortice/app.js` y pruebas bajo `pruebas/`. Esta especificación **no autoriza** ningún cambio en esas áreas, ni en datasets, API, paquetes, configuración de host, commits o push.

## 10. Criterios de aceptación A.3

| ID | Criterio |
|---|---|
| A3-AC-01 | El Vórtice canónico y sus nueve capas permanecen intactos. |
| A3-AC-02 | Los paneles operacionales son alcanzables mediante interacción Vórtice/módulo. |
| A3-AC-03 | Agents renderiza estados deterministas y etiqueta claramente mocks. |
| A3-AC-04 | Tasks soporta `ACTIVE`, `PENDING`, `COMPLETED`, `FAILED`. |
| A3-AC-05 | System es read-only y muestra fuente/frescura. |
| A3-AC-06 | Security expone `L0`–`L4` sin conceder/cambiar privilegios. |
| A3-AC-07 | FREE_FIRST/routing es solo informativo. |
| A3-AC-08 | No se fabrica estado externo `CONNECTED`/`ONLINE`. |
| A3-AC-09 | Se conserva la accesibilidad de Phase A. |
| A3-AC-10 | Se conserva reduced motion. |
| A3-AC-11 | Se conserva visibilidad inicial y pausa/reanudación. |
| A3-AC-12 | La validación con `ATLAS_SIN_RED=true` pasa. |
| A3-AC-13 | Se mantiene la invariante loopback `127.0.0.1` solamente. |
| A3-AC-14 | Trading real sigue bloqueado. |
| A3-AC-15 | El hash de dataset canónico permanece inalterado. |
| A3-AC-16 | No existen cambios de repositorio no autorizados por la implementación. |
| A3-AC-17 | Los 76 archivos de prueba existentes continúan pasando. |
| A3-AC-18 | Todas las nuevas pruebas A.3 pasan. |
| A3-AC-19 | Fixtures y logs de UI no exponen secretos/credenciales. |
| A3-AC-20 | No se introduce ruta de ejecución de comandos reales. |
| A3-AC-21 | Knowledge muestra procedencia/validación o `UNAVAILABLE`. |
| A3-AC-22 | Datos mock/verificados no se mezclan sin etiqueta visible. |
| A3-AC-23 | La experiencia conserva el comportamiento responsive existente. |

## 11. Especificación de pruebas futuras

La implementación debe añadir `pruebas/prueba-phase-a3-operational-vortex.ts` y, si necesita pruebas de integración complementarias, mantenerlas acotadas a A.3. Como mínimo, la suite A.3 verificará:

1. Integridad del Vórtice canónico, SVG, nueve capas y dataset hash.
2. Activación de sector/módulo y acceso al panel operacional contextual.
3. Renderizado de estados de agente y etiquetas `MOCK`/`SIMULATED`.
4. Renderizado de todos los estados de tarea requeridos.
5. Renderizado de telemetría con fuente y frescura, sin escritura de host.
6. Visualización solamente de `L0`–`L4` y ausencia de mutación de privilegios.
7. FREE_FIRST/routing como información, sin cambio de routing.
8. Ausencia de `CONNECTED`/`ONLINE` fabricado para fuentes no verificadas.
9. Accesibilidad, reduced motion, visibilidad inicial y pausa/reanudación.
10. Conservación de las invariantes existentes sobre términos/acciones de trading prohibidos.
11. `ATLAS_SIN_RED=true`, loopback-only, ausencia de proveedor externo y ausencia de ruta de ejecución real.
12. Ausencia de secretos en fixtures y logs de UI.

No se implementan pruebas ni código como parte de la creación de esta especificación.

## 12. Gate completo para declarar A.3 GREEN

Phase A.3 solo puede declararse `GREEN` cuando se cumpla simultáneamente:

```text
Existing baseline:               76 / 76 existing test files PASS
New A.3 tests:                   ALL PASS
Phase A canonical Vortex:        PASS
Accessibility:                   PASS
Responsive behavior:             PASS
Offline/no-network:              PASS
ATLAS_SIN_RED:                   true
Loopback:                        127.0.0.1 only
Real trading:                    BLOCKED
Real command execution:          NONE
Dataset SHA-256:                 d9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a
Unauthorized git changes:        NONE
```

Una implementación que no pueda probar cualquiera de estas condiciones no se declara GREEN; debe reportar el estado real (`BLOCKED`, `UNAVAILABLE` o fallo) sin sustituirlo por una afirmación de éxito.
