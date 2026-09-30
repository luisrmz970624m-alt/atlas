export type IndicatorStatus = 'ACTIVE' | 'DEPRECATED' | 'EXPERIMENTAL';
export type IndicatorCategory = 'TREND' | 'MOMENTUM' | 'VOLATILITY' | 'MEAN_REVERSION' | 'MARKET_STRUCTURE' | 'VOLUME';

export interface IndicatorSpec {
  indicatorId: string;
  name: string;
  version: string;
  category: IndicatorCategory;
  description: string;
  inputs: string[];
  parameters: Record<string, unknown>;
  output: string;
  assumptions: string[];
  status: IndicatorStatus;
  createdAt: string;
  updatedAt: string;
}

export class IndicatorRegistry {
  private indicators: Map<string, IndicatorSpec> = new Map();
  private indicatorsByCategory: Map<IndicatorCategory, Set<string>> = new Map();

  registrarIndicador(spec: IndicatorSpec): void {
    if (this.indicators.has(spec.indicatorId)) {
      throw new Error(`Indicador ${spec.indicatorId} ya existe`);
    }

    this.indicators.set(spec.indicatorId, spec);

    if (!this.indicatorsByCategory.has(spec.category)) {
      this.indicatorsByCategory.set(spec.category, new Set());
    }
    this.indicatorsByCategory.get(spec.category)!.add(spec.indicatorId);
  }

  obtenerIndicador(indicatorId: string): IndicatorSpec | undefined {
    return this.indicators.get(indicatorId);
  }

  obtenerPorCategoria(categoria: IndicatorCategory): IndicatorSpec[] {
    const ids = this.indicatorsByCategory.get(categoria) || new Set();
    return Array.from(ids)
      .map((id) => this.indicators.get(id)!)
      .filter((ind) => ind !== undefined);
  }

  listarActivos(): IndicatorSpec[] {
    return Array.from(this.indicators.values()).filter((ind) => ind.status === 'ACTIVE');
  }

  deprecarIndicador(indicatorId: string): void {
    const ind = this.indicators.get(indicatorId);
    if (ind) {
      ind.status = 'DEPRECATED';
      ind.updatedAt = new Date().toISOString();
    }
  }

  estado() {
    return {
      totalIndicadores: this.indicators.size,
      activos: Array.from(this.indicators.values()).filter((ind) => ind.status === 'ACTIVE')
        .length,
      porCategoria: Object.fromEntries(
        Array.from(this.indicatorsByCategory.entries()).map(([cat, set]) => [cat, set.size])
      ),
    };
  }
}

/** Bootstrap MA_CROSS indicador existente. */
export function bootstrapMACrossIndicador(registry: IndicatorRegistry): void {
  const ahora = new Date().toISOString();

  // Verificar si ya existe (idempotente)
  if (registry.obtenerIndicador('MA_CROSS')) {
    return;
  }

  const spec: IndicatorSpec = {
    indicatorId: 'MA_CROSS',
    name: 'Moving Average Crossover',
    version: '1.0',
    category: 'TREND',
    description: 'Simple Moving Average crossover strategy (existing implementation)',
    inputs: ['OHLC'],
    parameters: {
      fastPeriod: 9,
      slowPeriod: 21,
      riskPerOperation: 0.01,
    },
    output: 'signal: comprar|vender|mantener',
    assumptions: [
      'Trend-following strategy',
      'Works on multiple timeframes',
      'Declarative (no dynamic code)',
    ],
    status: 'ACTIVE',
    createdAt: ahora,
    updatedAt: ahora,
  };

  registry.registrarIndicador(spec);
}

/** Singleton global. */
let registryGlobal: IndicatorRegistry | null = null;

export function inicializarIR(rutaPersistencia?: string): IndicatorRegistry {
  registryGlobal = new IndicatorRegistry(rutaPersistencia);
  // Bootstrap MA_CROSS al inicializar (idempotente)
  bootstrapMACrossIndicador(registryGlobal);
  return registryGlobal;
}

export function obtenerIR(): IndicatorRegistry | null {
  return registryGlobal;
}

export function asignarIR(registry: IndicatorRegistry | null): void {
  registryGlobal = registry;
}
