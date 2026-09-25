import { senalCruceMedias } from './estrategias.ts';
import type { EstrategiaDeclarativa, Senal, SerieHistorica } from './tipos.ts';
export interface EventoPaper { fecha: string; senal: Senal; modo: 'PAPER_INTERNO'; ejecutaOrden: false; }
/** Observación interna: registra señales, no envía ni representa órdenes. */
export function observarPaperInterno(serie: SerieHistorica, estrategia: EstrategiaDeclarativa): EventoPaper[] { return serie.velas.map((vela, indice) => ({ fecha: vela.fecha, senal: senalCruceMedias(estrategia, serie.velas, indice), modo: 'PAPER_INTERNO' as const, ejecutaOrden: false as const })); }
