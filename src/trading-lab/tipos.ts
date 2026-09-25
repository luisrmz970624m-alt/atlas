/** Trading Lab es investigación educativa: no conecta brokers ni ejecuta dinero real. */
export interface VelaHistorica { fecha: string; apertura: number; maximo: number; minimo: number; cierre: number; volumen: number; }
export interface SerieHistorica { id: string; simbolo: string; intervalo: string; origen: string; velas: VelaHistorica[]; }
export interface EstrategiaCruceMedias { tipo: 'cruce_medias'; id: string; version: number; mediaRapida: number; mediaLenta: number; riesgoPorOperacion: number; }
export type EstrategiaDeclarativa = EstrategiaCruceMedias;
export type Senal = 'comprar' | 'vender' | 'mantener';
export interface ConfiguracionBacktest { capitalInicial: number; comisionPorcentaje: number; spreadPorcentaje: number; slippagePorcentaje: number; maxRiesgoPorOperacion: number; semilla: number; }
export interface OperacionBacktest { entrada: string; salida: string; precioEntrada: number; precioSalida: number; cantidad: number; pnlNeto: number; comisiones: number; }
export interface MetricasBacktest { operaciones: number; retornoNeto: number; profitFactor: number | null; drawdownMaximo: number; ratioRiesgoBeneficio: number | null; exposicion: number; comisiones: number; benchmarkRetorno: number; }
export interface ResultadoBacktest { reproducible: true; estrategia: Pick<EstrategiaDeclarativa, 'id' | 'version' | 'tipo'>; datos: Pick<SerieHistorica, 'id' | 'simbolo' | 'intervalo' | 'origen'> & { velas: number }; semilla: number; aprobado: boolean; reglasVioladas: string[]; operaciones: OperacionBacktest[]; metricas: MetricasBacktest; }
