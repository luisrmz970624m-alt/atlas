import type { SerieHistorica, VelaHistorica } from './tipos.ts';
export class DatosHistoricosInvalidos extends Error {}
function positivo(valor: number): boolean { return Number.isFinite(valor) && valor > 0; }
/** Rechaza datos incompletos o corruptos: el laboratorio nunca inventa velas. */
export function validarSerieHistorica(serie: SerieHistorica): void {
  if (!serie.id || !serie.simbolo || !serie.intervalo || !serie.origen || serie.velas.length < 2) throw new DatosHistoricosInvalidos('La serie histórica requiere metadatos y al menos dos velas.');
  let anterior = -Infinity;
  for (const vela of serie.velas) {
    const instante = Date.parse(vela.fecha);
    if (!Number.isFinite(instante) || instante <= anterior) throw new DatosHistoricosInvalidos('Las velas deben tener fechas válidas y estrictamente crecientes.');
    anterior = instante;
    if (![vela.apertura, vela.maximo, vela.minimo, vela.cierre].every(positivo) || !Number.isFinite(vela.volumen) || vela.volumen < 0) throw new DatosHistoricosInvalidos('Una vela contiene precios o volumen inválidos.');
    if (vela.maximo < Math.max(vela.apertura, vela.cierre) || vela.minimo > Math.min(vela.apertura, vela.cierre) || vela.minimo > vela.maximo) throw new DatosHistoricosInvalidos('Una vela tiene OHLC inconsistente.');
  }
}
/** Adaptador local e inyectable; no descarga ni depende de un dataset licenciado. */
export class DatosHistoricosLocales {
  private readonly series: readonly SerieHistorica[];
  constructor(series: readonly SerieHistorica[]) { this.series = series; }
  obtener(id: string): SerieHistorica {
    const serie = this.series.find((candidata) => candidata.id === id);
    if (!serie) throw new DatosHistoricosInvalidos(`No existe la serie histórica local: ${id}.`);
    validarSerieHistorica(serie);
    return { ...serie, velas: serie.velas.map((vela: VelaHistorica) => ({ ...vela })) };
  }
}
