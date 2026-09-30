import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export type EntityStatus = 'ACTIVE' | 'SUPERSEDED' | 'DEPRECATED' | 'NEEDS_REVIEW';
export type EntityDomain = 'TRADING' | 'BUSINESS' | 'EDUCATION' | 'SYSTEM';

export type EntityType =
  | 'INSTRUMENT'
  | 'CURRENCY'
  | 'COUNTRY'
  | 'CENTRAL_BANK'
  | 'INSTITUTION'
  | 'MACRO_INDICATOR'
  | 'ECONOMIC_EVENT'
  | 'STRATEGY'
  | 'INDICATOR'
  | 'CONCEPT';

export interface EntityMetadata {
  region?: string;
  country?: string;
  currency?: string;
  officialUrl?: string;
  wikipediaUrl?: string;
  customData?: Record<string, unknown>;
}

export interface Entity {
  entityId: string;
  canonicalName: string;
  aliases: string[];
  entityType: EntityType;
  domain: EntityDomain;
  status: EntityStatus;
  relatedEntityIds: string[];
  source: string;
  metadata?: EntityMetadata;
  createdAt: string;
  updatedAt: string;
  supersededBy?: string;
}

export interface EntityRegistryData {
  registryId: string;
  version: number;
  entities: Map<string, Entity>;
  entitiesByType: Map<EntityType, Set<string>>;
  entitiesByName: Map<string, string>;
  aliasMap: Map<string, string>;
  createdAt: string;
  updatedAt: string;
}

/** Registro de entidades canónicas. */
export class EntityRegistry {
  private registry: EntityRegistryData;
  private rutaPersistencia: string = 'datos/entity-registry.json';

  constructor(rutaPersistencia?: string) {
    if (rutaPersistencia) this.rutaPersistencia = rutaPersistencia;

    const ahora = new Date().toISOString();
    this.registry = {
      registryId: `reg_${Date.now()}`,
      version: 1,
      entities: new Map(),
      entitiesByType: new Map(),
      entitiesByName: new Map(),
      aliasMap: new Map(),
      createdAt: ahora,
      updatedAt: ahora,
    };

    this.cargar();
  }

  /** Registra una entidad nueva. */
  registrarEntidad(opciones: {
    canonicalName: string;
    aliases?: string[];
    entityType: EntityType;
    domain?: EntityDomain;
    source: string;
    metadata?: EntityMetadata;
  }): Entity {
    const ahora = new Date().toISOString();
    const entityId = randomUUID();

    // Validar que canonical name no existe
    if (this.registry.entitiesByName.has(opciones.canonicalName.toLowerCase())) {
      throw new Error(`Entidad '${opciones.canonicalName}' ya existe`);
    }

    // Validar que los aliases no existen
    for (const alias of opciones.aliases || []) {
      if (this.registry.aliasMap.has(alias.toLowerCase())) {
        throw new Error(`Alias '${alias}' ya mapeado a otra entidad`);
      }
    }

    const entity: Entity = {
      entityId,
      canonicalName: opciones.canonicalName,
      aliases: opciones.aliases || [],
      entityType: opciones.entityType,
      domain: opciones.domain || 'TRADING',
      status: 'ACTIVE',
      relatedEntityIds: [],
      source: opciones.source,
      metadata: opciones.metadata,
      createdAt: ahora,
      updatedAt: ahora,
    };

    // Registrar en índices
    this.registry.entities.set(entityId, entity);

    // Indexar por tipo
    if (!this.registry.entitiesByType.has(entity.entityType)) {
      this.registry.entitiesByType.set(entity.entityType, new Set());
    }
    this.registry.entitiesByType.get(entity.entityType)!.add(entityId);

    // Indexar por nombre canonical
    this.registry.entitiesByName.set(entity.canonicalName.toLowerCase(), entityId);

    // Indexar aliases
    for (const alias of entity.aliases) {
      this.registry.aliasMap.set(alias.toLowerCase(), entityId);
    }

    this.registry.updatedAt = ahora;
    this.guardar();

    return entity;
  }

  /** Obtiene una entidad por ID. */
  obtenerPorId(entityId: string): Entity | undefined {
    return this.registry.entities.get(entityId);
  }

  /** Obtiene una entidad por nombre canonical o alias. */
  obtenerPorNombre(nombre: string): Entity | undefined {
    const nombreLower = nombre.toLowerCase();

    // Buscar por canonical name
    const id = this.registry.entitiesByName.get(nombreLower);
    if (id) return this.registry.entities.get(id);

    // Buscar por alias
    const aliasId = this.registry.aliasMap.get(nombreLower);
    if (aliasId) return this.registry.entities.get(aliasId);

    return undefined;
  }

  /** Obtiene entidades por tipo. */
  obtenerPorTipo(tipo: EntityType): Entity[] {
    const ids = this.registry.entitiesByType.get(tipo) || new Set();
    return Array.from(ids)
      .map((id) => this.registry.entities.get(id)!)
      .filter((e) => e !== undefined);
  }

  /** Lista todas las entidades activas. */
  listarActivas(): Entity[] {
    return Array.from(this.registry.entities.values()).filter((e) => e.status === 'ACTIVE');
  }

  /** Verifica si una entidad existe. */
  existe(nombre: string): boolean {
    return this.obtenerPorNombre(nombre) !== undefined;
  }

  /** Marca una entidad como supersedida. */
  marcarSupersedida(entityId: string, supersededBy: string): void {
    const entity = this.registry.entities.get(entityId);
    if (!entity) return;

    entity.status = 'SUPERSEDED';
    entity.supersededBy = supersededBy;
    entity.updatedAt = new Date().toISOString();

    this.guardar();
  }

  /** Agrega un alias a una entidad. */
  agregarAlias(entityId: string, alias: string): void {
    const entity = this.registry.entities.get(entityId);
    if (!entity) return;

    if (entity.aliases.includes(alias)) return; // Ya existe

    const aliasLower = alias.toLowerCase();
    if (this.registry.aliasMap.has(aliasLower)) {
      throw new Error(`Alias '${alias}' ya mapeado a otra entidad`);
    }

    entity.aliases.push(alias);
    this.registry.aliasMap.set(aliasLower, entityId);
    entity.updatedAt = new Date().toISOString();

    this.guardar();
  }

  /** Relaciona dos entidades. */
  relacionar(entityId1: string, entityId2: string): void {
    const e1 = this.registry.entities.get(entityId1);
    const e2 = this.registry.entities.get(entityId2);

    if (!e1 || !e2) return;

    if (!e1.relatedEntityIds.includes(entityId2)) {
      e1.relatedEntityIds.push(entityId2);
      e1.updatedAt = new Date().toISOString();
    }

    if (!e2.relatedEntityIds.includes(entityId1)) {
      e2.relatedEntityIds.push(entityId1);
      e2.updatedAt = new Date().toISOString();
    }

    this.guardar();
  }

  /** Obtiene estado. */
  obtenerEstado() {
    return {
      registryId: this.registry.registryId,
      version: this.registry.version,
      totalEntidades: this.registry.entities.size,
      porTipo: Object.fromEntries(
        Array.from(this.registry.entitiesByType.entries()).map(([t, s]) => [t, s.size])
      ),
      activas: Array.from(this.registry.entities.values()).filter((e) => e.status === 'ACTIVE')
        .length,
      supersedidas: Array.from(this.registry.entities.values()).filter(
        (e) => e.status === 'SUPERSEDED'
      ).length,
      createdAt: this.registry.createdAt,
      updatedAt: this.registry.updatedAt,
    };
  }

  /** Guarda en disco (atómico). */
  private guardar(): void {
    const datos = {
      registryId: this.registry.registryId,
      version: this.registry.version,
      entities: Array.from(this.registry.entities.values()),
      ultimaActualizacion: new Date().toISOString(),
    };

    mkdirSync(dirname(this.rutaPersistencia), { recursive: true });
    const temporal = `${this.rutaPersistencia}.tmp`;
    writeFileSync(temporal, JSON.stringify(datos, null, 2), 'utf8');
    renameSync(temporal, this.rutaPersistencia);
  }

  /** Carga desde disco. */
  private cargar(): void {
    if (!existsSync(this.rutaPersistencia)) {
      return;
    }

    try {
      const contenido = readFileSync(this.rutaPersistencia, 'utf8');
      const datos = JSON.parse(contenido);

      if (Array.isArray(datos.entities)) {
        for (const entity of datos.entities) {
          this.registry.entities.set(entity.entityId, entity);

          // Reconstruir índices
          if (!this.registry.entitiesByType.has(entity.entityType)) {
            this.registry.entitiesByType.set(entity.entityType, new Set());
          }
          this.registry.entitiesByType.get(entity.entityType)!.add(entity.entityId);

          this.registry.entitiesByName.set(entity.canonicalName.toLowerCase(), entity.entityId);

          for (const alias of entity.aliases) {
            this.registry.aliasMap.set(alias.toLowerCase(), entity.entityId);
          }
        }
      }
    } catch {
      // Archivo corrupto, comenzar vacío
    }
  }
}

/** Bootstrap data — diccionarios de KnowledgeOrganizer migrados. */
export function bootstrapEntidadesOrganizador(registry: EntityRegistry): void {
  // Instrumentos (11 items)
  const instrumentos = [
    'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
    'NZDUSD', 'EURGBP', 'BTC', 'ETH', 'SPY', 'QQQ',
  ];
  for (const nombre of instrumentos) {
    // Idempotente: solo registrar si no existe
    if (!registry.existe(nombre)) {
      registry.registrarEntidad({
        canonicalName: nombre,
        entityType: 'INSTRUMENT',
        domain: 'TRADING',
        source: 'knowledge-organizer-bootstrap',
      });
    }
  }

  // Bancos centrales (8 items)
  const centralBanks = ['FED', 'ECB', 'BOJ', 'BOE', 'SNB', 'RBA', 'RBNZ', 'BAN'];
  for (const nombre of centralBanks) {
    if (!registry.existe(nombre)) {
      registry.registrarEntidad({
        canonicalName: nombre,
        entityType: 'CENTRAL_BANK',
        domain: 'TRADING',
        source: 'knowledge-organizer-bootstrap',
      });
    }
  }

  // Países (8 items)
  const paises = ['USA', 'EUR', 'JPN', 'GBR', 'CHE', 'AUS', 'CAD', 'NZL'];
  for (const nombre of paises) {
    if (!registry.existe(nombre)) {
      registry.registrarEntidad({
        canonicalName: nombre,
        entityType: 'COUNTRY',
        domain: 'TRADING',
        source: 'knowledge-organizer-bootstrap',
      });
    }
  }

  // Instituciones (6 items)
  const instituciones = [
    'BANK', 'HEDGE_FUND', 'ASSET_MANAGER', 'CTA', 'PROP_TRADER', 'BROKER',
  ];
  for (const nombre of instituciones) {
    if (!registry.existe(nombre)) {
      registry.registrarEntidad({
        canonicalName: nombre,
        entityType: 'INSTITUTION',
        domain: 'TRADING',
        source: 'knowledge-organizer-bootstrap',
      });
    }
  }

  // Conceptos de trading (10 items)
  const conceptos = [
    'INTEREST_RATES', 'INFLATION', 'EMPLOYMENT', 'GDP', 'CPI',
    'NFP', 'PMI', 'YIELD', 'SPREAD', 'VOLATILITY',
  ];
  for (const nombre of conceptos) {
    if (!registry.existe(nombre)) {
      registry.registrarEntidad({
        canonicalName: nombre,
        entityType: 'CONCEPT',
        domain: 'TRADING',
        source: 'knowledge-organizer-bootstrap',
      });
    }
  }
}

/** Singleton global. */
let registryGlobal: EntityRegistry | null = null;

export function inicializarER(rutaPersistencia?: string): EntityRegistry {
  registryGlobal = new EntityRegistry(rutaPersistencia);
  // Bootstrap idempotente: solo registra si están vacías
  if (registryGlobal.obtenerEstado().totalEntidades === 0) {
    bootstrapEntidadesOrganizador(registryGlobal);
  }
  return registryGlobal;
}

export function obtenerER(): EntityRegistry | null {
  return registryGlobal;
}

export function asignarER(registry: EntityRegistry | null): void {
  registryGlobal = registry;
}
