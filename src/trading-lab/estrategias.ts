import type { EstrategiaCruceMedias, Senal, VelaHistorica } from './tipos.ts';
export class EstrategiaInvalida extends Error {}
/** Construye una estrategia declarativa; no acepta código ni texto ejecutable. */
export function crearCruceMedias(entrada: EstrategiaCruceMedias): EstrategiaCruceMedias {
  if (!entrada.id || !Number.isInteger(entrada.version) || entrada.version < 1 || !Number.isInteger(entrada.mediaRapida) || !Number.isInteger(entrada.mediaLenta) || entrada.mediaRapida < 2 || entrada.mediaRapida >= entrada.mediaLenta || !Number.isFinite(entrada.riesgoPorOperacion) || entrada.riesgoPorOperacion <= 0 || entrada.riesgoPorOperacion > 1) throw new EstrategiaInvalida('Estrategia declarativa inválida.');
  return { ...entrada };
}
function media(velas: readonly VelaHistorica[], hasta: number, periodo: number): number | null { if (hasta + 1 < periodo) return null; let suma = 0; for (let i = hasta - periodo + 1; i <= hasta; i += 1) suma += velas[i]!.cierre; return suma / periodo; }
/** Señal calculada sólo con velas cerradas; la ejecución ocurre en la siguiente apertura. */
export function senalCruceMedias(estrategia: EstrategiaCruceMedias, velas: readonly VelaHistorica[], indice: number): Senal {
  const ar = media(velas, indice, estrategia.mediaRapida); const al = media(velas, indice, estrategia.mediaLenta); const pr = media(velas, indice - 1, estrategia.mediaRapida); const pl = media(velas, indice - 1, estrategia.mediaLenta);
  if ([ar, al, pr, pl].some((valor) => valor === null)) return 'mantener';
  if (pr! <= pl! && ar! > al!) return 'comprar'; if (pr! >= pl! && ar! < al!) return 'vender'; return 'mantener';
}
