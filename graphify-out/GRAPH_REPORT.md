# Graph Report - atlas  (2026-09-26)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1415 nodes · 3415 edges · 61 communities (49 shown, 12 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 100 edges (avg confidence: 0.81)
- Token cost: 50,993 input · 6,143 output

## Graph Freshness
- Built from commit: `e0e36527`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Supplier Request Management
- UI Theme Application
- MT5 Bridge Client
- Backtest Parameter Evidence
- Memory Space Management
- Forex Market Scheduler
- Trading Engine Operations
- Knowledge Graph Testing
- Business Experiment Runner
- Knowledge Base Management
- Business Campaign Lab
- Event Registration Audit
- Business Simulation Worker
- Trading Bot Competition
- Historical Data Series
- Execution Cycle Planning
- Local API Dashboard
- Entity Registry Management
- Simulated Company Accounting
- Integration Test Suite
- Business Decision Supervisor
- Energy Mining Management
- CLI Execution Framework
- Project Package Config
- Knowledge Organization
- Code Standards Lab
- Trading Decision Reasoning
- Panel Startup Config
- Simulation Task Scheduler
- Knowledge Graph Linking
- Market Context Calendar
- Course Progress Tracking
- Daemon State Persistence
- Experiment Classification
- CLI Backup State
- Web Frontend Config
- Trading Analysis Engine
- Indicator Registry
- Company Simulation Panel
- Document Version Identity
- Diagnostic Fixture Generation
- Scenario Time Engine
- Trading Experiment Repository
- Knowledge Graph Engine
- Bot Orchestrator
- Bot Engine Management
- Indicator Pipeline Orchestration
- Company Entity Types
- Scenario Checkpoint Management
- Decision Experiment Linking
- Memory Layer Management
- Memory Layer Bootstrap
- Corporate Memory System
- Business Agent Loop
- Source Metadata Manager
- Decision Experiment Data
- Bot Evolution System
- Competition Management CLI
- Context Budget Profiles
- Validation Scoring Engine
- Command Center Dashboard

## God Nodes (most connected - your core abstractions)
1. `EmpresaSimulada` - 40 edges
2. `OrquestadorV08` - 28 edges
3. `MemoriaEmpresarial` - 28 edges
4. `KnowledgeOrganizer` - 26 edges
5. `Memoria` - 26 edges
6. `SimulationScheduler` - 25 edges
7. `ejecutarBacktest()` - 25 edges
8. `MotorBots` - 24 edges
9. `SerieHistorica` - 23 edges
10. `TradingEngine` - 23 edges

## Surprising Connections (you probably didn't know these)
- `nueva()` --calls--> `Memoria`  [EXTRACTED]
  pruebas/prueba-curso.ts → src/memoria.ts
- `nueva()` --calls--> `Memoria`  [EXTRACTED]
  pruebas/prueba-memoria.ts → src/memoria.ts
- `cascada()` --calls--> `generarCon()`  [EXTRACTED]
  pruebas/prueba-proveedores.ts → src/proveedores/seleccion.ts
- `empresa()` --calls--> `crearEmpresa()`  [EXTRACTED]
  pruebas/prueba-panel.ts → src/empresa-simulator/empresa.ts
- `BusinessCampaign` --references--> `ConfigEmpresa`  [EXTRACTED]
  src/business-lab/lab.ts → src/empresa-simulator/tipos.ts

## Import Cycles
- None detected.

## Communities (61 total, 12 thin omitted)

### Community 0 - "Supplier Request Management"
Cohesion: 0.06
Nodes (67): fuentes, presupuesto, solicitud, cascada(), solicitudAlta, solicitudBaja, escaparSaltos(), extraerJSON() (+59 more)

### Community 1 - "UI Theme Application"
Cohesion: 0.06
Nodes (84): aplicarInstrumento(), app, applyAccent(), applyCustom(), applyEffects(), applyTheme(), applyVisualStyle(), banner (+76 more)

### Community 2 - "MT5 Bridge Client"
Cohesion: 0.08
Nodes (29): politica, POLITICA_DEMO, asegurarPuerta(), BridgeMT5Error, BridgeMT5Seguridad, BridgeMT5Timeout, ClienteMT5SoloLectura, cuenta() (+21 more)

### Community 3 - "Backtest Parameter Evidence"
Cohesion: 0.12
Nodes (31): configFixture, ParameterResult, serieFixture, CommissionEvidenceRow, fixture, ParameterEvidenceRow, configFixture, serieFixture (+23 more)

### Community 4 - "Memory Space Management"
Cohesion: 0.09
Nodes (21): nueva(), base, nueva(), contexto(), Espacio, EspacioInvalido, ESPACIOS, Estado (+13 more)

### Community 5 - "Forex Market Scheduler"
Cohesion: 0.09
Nodes (17): main(), obtenerRepositorio(), asignarScheduler(), EstadoSchedulerForex, ForexScheduler, HolidayCalendar, inicializarScheduler(), MarketWindow (+9 more)

### Community 6 - "Trading Engine Operations"
Cohesion: 0.12
Nodes (9): cliOperar(), cliPortafolio(), ejecutarCLIUsuario(), esSimboloSoportado(), GeneradorPreciosRealtime, PrecioHistorico, ProveedorPrecios, SIMBOLOS_SOPORTADOS (+1 more)

### Community 7 - "Knowledge Graph Testing"
Cohesion: 0.11
Nodes (24): LAB, ref_node_fs, ref_node_os, ref_node_path, asignarKG(), ContextBudget, Domain, inicializarKG() (+16 more)

### Community 8 - "Business Experiment Runner"
Cohesion: 0.08
Nodes (17): config, policy, BusinessPolicySegura, BusinessExperimentRunner, ConfigExperimento, DireccionMetrica, Estadisticas, EstadoExperimento (+9 more)

### Community 9 - "Knowledge Base Management"
Cohesion: 0.09
Nodes (15): asignarKB(), detectarSecretos(), dividirEnChunks(), DocumentType, generarChunkId(), generarDocumentId(), inicializarKB(), KnowledgeBaseLocal (+7 more)

### Community 10 - "Business Campaign Lab"
Cohesion: 0.12
Nodes (15): base, BusinessDecisionProposal, BusinessObservation, BaselineBusinessPolicy, BusinessCampaign, BusinessCampaignRunner, BusinessExperiment, BusinessPolicy (+7 more)

### Community 11 - "Event Registration Audit"
Cohesion: 0.14
Nodes (24): base, agregar(), auditar(), calcularHash(), GENESIS, leerEventos(), romper(), ultimoEvento() (+16 more)

### Community 12 - "Business Simulation Worker"
Cohesion: 0.12
Nodes (16): base, ahora(), BusinessSimulationWorker, clonar(), DominioSimulacion, ErrorTransicionSimulacion, EstadoSimulacion, EventoSimulacion (+8 more)

### Community 13 - "Trading Bot Competition"
Cohesion: 0.11
Nodes (17): ref_crypto, Bot, ConfiguracionBot, EstrategiaBot, OrdenBot, EstadisticasCompetencia, ResultadoDiario, SnapshotCompetencia (+9 more)

### Community 14 - "Historical Data Series"
Cohesion: 0.16
Nodes (20): configFixture, serieFixture, configFixture, estrategia, serieFixture, configuracion, estrategia, serie (+12 more)

### Community 15 - "Execution Cycle Planning"
Cohesion: 0.15
Nodes (26): aplicarEstandar(), construir(), corregirVerificacion(), DatosPaso, DatosPlan, ejecutar(), instrucciones(), parar() (+18 more)

### Community 16 - "Local API Dashboard"
Cohesion: 0.13
Nodes (17): apiCase(), dashboard(), panelHtml, panelJs, premiumChecks, ref_node_http, asset(), AtlasApiConfig (+9 more)

### Community 17 - "Entity Registry Management"
Cohesion: 0.14
Nodes (10): asignarER(), bootstrapEntidadesOrganizador(), Entity, EntityDomain, EntityMetadata, EntityRegistry, EntityRegistryData, EntityStatus (+2 more)

### Community 18 - "Simulated Company Accounting"
Cohesion: 0.26
Nodes (6): ejecutarPropuesta(), metricas(), copiar(), dinero(), EmpresaSimulada, EmpresaSimuladaError

### Community 19 - "Integration Test Suite"
Cohesion: 0.13
Nodes (7): config, base, ref_node_assert, ref_node_test, asignarWorker(), obtenerWorker(), asignarRepositorioExperimentos()

### Community 20 - "Business Decision Supervisor"
Cohesion: 0.11
Nodes (17): config, AccionDisponible, AccionEmpresarial, BusinessSupervisorAdapter, cantidad(), congelar(), EstadoAgent, esTexto() (+9 more)

### Community 21 - "Energy Mining Management"
Cohesion: 0.15
Nodes (3): cliMinar(), GestorEnergia, MotorMineria

### Community 22 - "CLI Execution Framework"
Cohesion: 0.14
Nodes (17): [comando, ...args], ICONO, src_ciclo_describir, Ejecucion, ejecutar(), enunciado(), evaluar(), LIMITE_MS (+9 more)

### Community 23 - "Project Package Config"
Cohesion: 0.09
Nodes (21): dependencies, @anthropic-ai/sdk, better-sqlite3, openai, description, engines, node, name (+13 more)

### Community 25 - "Code Standards Lab"
Cohesion: 0.12
Nodes (15): LAB, LECCION_BUENA, LECCION_FLOJA, PLAN_BUENO, archivosDeTexto(), Estandar, ESTANDARES, Exigencia (+7 more)

### Community 26 - "Trading Decision Reasoning"
Cohesion: 0.14
Nodes (16): config, fixture, asignarTRE(), AtlasExperienceAnalysis, ConfirmationGate, ConfirmationGates, DecisionCase, DecisionResult (+8 more)

### Community 27 - "Panel Startup Config"
Cohesion: 0.17
Nodes (14): entrypoint, paquete, ref_node_child_process, ref_node_net, ref_node_url, ConfigPanel, ErrorPanel, iniciarPanel() (+6 more)

### Community 29 - "Knowledge Graph Linking"
Cohesion: 0.15
Nodes (10): asignarLinker(), ClassificationConfidence, DocumentOrganization, inicializarLinker(), KnowledgeGraphEngine, KnowledgeNode, LinkingDecision, LinkingPolicy (+2 more)

### Community 30 - "Market Context Calendar"
Cohesion: 0.15
Nodes (14): evento, CategoriaContexto, categorias, ContextoMercadoInvalido, EconomicCalendarProvider, EventoContextoMercado, ImportanciaContexto, importancias (+6 more)

### Community 31 - "Course Progress Tracking"
Cohesion: 0.25
Nodes (15): Avance, avanceDe(), disponible(), ESPACIADO, EstadoTema, guardar(), Progreso, registrarMaterial() (+7 more)

### Community 32 - "Daemon State Persistence"
Cohesion: 0.19
Nodes (10): limpiar(), EstadoEnergia, RegistroEnergia, EstadoMineria, RegistroMineria, DIAS_RETENCION_HISTORICO, EstadoAtlasV08, cargarEstado() (+2 more)

### Community 33 - "Experiment Classification"
Cohesion: 0.18
Nodes (14): backtest, config, ConfiguracionBacktestInvalida, EstrategiaInvalida, clasificarExperimento(), crearExperimentoDesdeBacktest(), ejecutarBacktestPanel(), ESTRATEGIA_PANEL (+6 more)

### Community 34 - "CLI Backup State"
Cohesion: 0.22
Nodes (13): better-sqlite3, cliAgentes(), cliEstado(), cliProbarAgentes(), cliRespaldo(), ejecutarCLIv08(), mostrarEstadoAgentes(), clasificarErrorProveedor() (+5 more)

### Community 35 - "Web Frontend Config"
Cohesion: 0.11
Nodes (17): react, react-dom, vite, @vitejs/plugin-react, dependencies, react, react-dom, devDependencies (+9 more)

### Community 37 - "Indicator Registry"
Cohesion: 0.18
Nodes (8): asignarIR(), bootstrapMACrossIndicador(), IndicatorCategory, IndicatorRegistry, IndicatorSpec, IndicatorStatus, inicializarIR(), obtenerIR()

### Community 38 - "Company Simulation Panel"
Cohesion: 0.15
Nodes (11): empresa(), ref_node_sqlite, empresaDemo(), crearEmpresa(), EstadoExperienciaEmpresa, ExperienciaEmpresa, politicaPorDefecto, PoliticaValidacionEmpresa (+3 more)

### Community 39 - "Document Version Identity"
Cohesion: 0.18
Nodes (8): calcularContentHash(), DocumentVersion, generarLogicalDocumentId(), generarVersionId(), LogicalDocument, normalizarContenido(), OperationResult, VersionChain

### Community 40 - "Diagnostic Fixture Generation"
Cohesion: 0.17
Nodes (9): config, estrategia, fixture, createDiagnosticFixture_MultiRegime(), DiagnosticFixtureGenerator, FixtureConfig, FixtureMeta, SegmentConfig (+1 more)

### Community 42 - "Trading Experiment Repository"
Cohesion: 0.22
Nodes (5): ClasificacionExperimento, ColeccionExperimentos, generarIdDeduplicacion(), inicializarRepositorio(), RepositorioExperimentos

### Community 44 - "Bot Orchestrator"
Cohesion: 0.31
Nodes (5): conOrquestador(), cliCiclo(), cliCorrer(), OrquestadorV08, PrecioActual

### Community 46 - "Indicator Pipeline Orchestration"
Cohesion: 0.15
Nodes (8): IMPLEMENTATION_ALLOWLIST, IndicatorPipelineOrchestrator, IndicatorPipelineRun, IndicatorPipelineStage, PipelineResult, resolverImplementation(), StageResult, StageStatus

### Community 47 - "Company Entity Types"
Cohesion: 0.32
Nodes (12): Devolucion, Merma, Reserva, SnapshotEmpresa, Cliente, ConfigEmpresa, Empleado, FacturaSimulada (+4 more)

### Community 48 - "Scenario Checkpoint Management"
Cohesion: 0.21
Nodes (6): CheckpointEmpresa, CheckpointsEmpresa, Escenario, EventoProgramado, SchedulerSimulado, VelocidadSimulada

### Community 51 - "Memory Layer Bootstrap"
Cohesion: 0.27
Nodes (10): asignarML(), DocumentaryEntry, EntityType, ExperimentEntry, inicializarML(), MarketHistoryEntry, MemoryEntry, MemoryLayer (+2 more)

### Community 54 - "Source Metadata Manager"
Cohesion: 0.18
Nodes (4): ConflictingEvidence, SourceMetadata, SourceMetadataManager, SourceStatus

### Community 55 - "Decision Experiment Data"
Cohesion: 0.27
Nodes (8): ref_node_crypto, asignarDEL(), DecisionCaseRef, DecisionExperimentLinkageData, ExperimentRef, inicializarDEL(), LinkageRecord, obtenerDEL()

### Community 58 - "Context Budget Profiles"
Cohesion: 0.22
Nodes (5): ContextBudgetPolicies, ContextBudgetPolicy, ContextBudgetProfile, DEFAULT_PROFILES, ProfileType

### Community 59 - "Validation Scoring Engine"
Cohesion: 0.25
Nodes (3): ComponentScore, ValidationEngine, ValidationScore

### Community 60 - "Command Center Dashboard"
Cohesion: 0.33
Nodes (3): html, js, secciones

## Knowledge Gaps
- **289 isolated node(s):** `ResultadoRuta`, `Decision`, `EscenarioCampana`, `EstadoCampana`, `DominioSimulacion` (+284 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 458 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `KnowledgeOrganizer` connect `Knowledge Organization` to `Entity Registry Management`, `Knowledge Graph Testing`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `better-sqlite3` connect `CLI Backup State` to `Daemon State Persistence`, `Trading Bot Competition`, `Trading Engine Operations`, `Project Package Config`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `MemoryLayers` connect `Memory Layer Management` to `Entity Registry Management`, `Memory Layer Bootstrap`, `Knowledge Graph Testing`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `ResultadoRuta`, `Decision`, `EscenarioCampana` to the rest of the system?**
  _289 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Supplier Request Management` be split into smaller, more focused modules?**
  _Cohesion score 0.06228281208233093 - nodes in this community are weakly interconnected._
- **Should `UI Theme Application` be split into smaller, more focused modules?**
  _Cohesion score 0.0628174284950548 - nodes in this community are weakly interconnected._
- **Should `MT5 Bridge Client` be split into smaller, more focused modules?**
  _Cohesion score 0.08111888111888112 - nodes in this community are weakly interconnected._