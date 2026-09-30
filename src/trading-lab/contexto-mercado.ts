/** Contratos locales para contexto macro. No descargan, predicen ni ejecutan operaciones. */
export type CategoriaContexto = 'NOTICIA' | 'EVENTO ECONÓMICO' | 'DISCURSO' | 'DATO MACRO' | 'POLÍTICA MONETARIA' | 'GEOPOLÍTICA' | 'ENERGÍA' | 'RIESGO DE MERCADO';
export type ImportanciaContexto = 'LOW' | 'MEDIUM' | 'HIGH';
export type SesgoContexto = 'POTENCIALMENTE POSITIVO' | 'POTENCIALMENTE NEGATIVO' | 'MIXTO' | 'INCIERTO' | 'SIN RELACIÓN CLARA';
export interface EventoContextoMercado { fuente: string; titular: string; fecha: string; categoria: CategoriaContexto; importancia: ImportanciaContexto; activosRelacionados: string[]; hecho: string; interpretacion: string; sesgo: SesgoContexto; }
export interface NewsProvider { listar(): Promise<readonly EventoContextoMercado[]>; }
export interface EconomicCalendarProvider { listar(): Promise<readonly EventoContextoMercado[]>; }
export class ContextoMercadoInvalido extends Error {}
const categorias = new Set<CategoriaContexto>(['NOTICIA','EVENTO ECONÓMICO','DISCURSO','DATO MACRO','POLÍTICA MONETARIA','GEOPOLÍTICA','ENERGÍA','RIESGO DE MERCADO']);
const importancias = new Set<ImportanciaContexto>(['LOW','MEDIUM','HIGH']);
const sesgos = new Set<SesgoContexto>(['POTENCIALMENTE POSITIVO','POTENCIALMENTE NEGATIVO','MIXTO','INCIERTO','SIN RELACIÓN CLARA']);
/** Una fuente, hecho e interpretación separados son obligatorios cuando existe un evento. */
export function validarEventoContexto(evento: EventoContextoMercado): void { if (!evento.fuente?.trim() || !evento.titular?.trim() || !Number.isFinite(Date.parse(evento.fecha)) || !categorias.has(evento.categoria) || !importancias.has(evento.importancia) || !sesgos.has(evento.sesgo) || !evento.hecho?.trim() || !evento.interpretacion?.trim() || !Array.isArray(evento.activosRelacionados) || evento.activosRelacionados.some(a => !a.trim())) throw new ContextoMercadoInvalido('Evento de contexto de mercado inválido.'); }
/** Cruza únicamente símbolos presentes en Atlas; un evento no crea instrumentos ni órdenes. */
export function instrumentosRelacionados(evento: EventoContextoMercado, instrumentosAtlas: readonly string[]): string[] { validarEventoContexto(evento); return [...new Set(evento.activosRelacionados.filter(activo => instrumentosAtlas.includes(activo)))]; }
