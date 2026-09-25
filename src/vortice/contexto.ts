// Gestión determinista de contexto para El Vórtice. No conoce proveedores ni
// conserva prompts completos: trabaja con fragmentos identificados y acotados.

export interface FuenteContexto {
  id: string;
  texto: string;
  origen: string;
  /** Mayor primero; ausente conserva prioridad 0 para compatibilidad. */
  prioridad?: number;
}

export interface PresupuestoContexto {
  maxCaracteres: number;
  maxTokensAproximados: number;
  /** Reserva contra la estimación caracteres/4; se descuenta antes de llamar. */
  margenSeguridadCaracteres?: number;
}

export interface ContextoPreparado {
  texto: string;
  fuentes: string[];
  caracteres: number;
  tokens_aproximados: number;
  reducido: boolean;
  resumen_utilizado: boolean;
  rechazo: boolean;
  razon_rechazo?: 'presupuesto_invalido' | 'no_reducible';
}

/** Error seguro: la causa detallada no debe terminar en un proveedor ni log. */
export class ContextoNoReducible extends Error {}

const estimarTokens = (texto: string): number => Math.ceil(texto.length / 4);

function limite(p: PresupuestoContexto): number {
  if (!Number.isInteger(p.maxCaracteres) || p.maxCaracteres <= 0 || !Number.isInteger(p.maxTokensAproximados) || p.maxTokensAproximados <= 0) return 0;
  return Math.max(0, Math.min(p.maxCaracteres, p.maxTokensAproximados * 4) - (p.margenSeguridadCaracteres ?? 0));
}

/**
 * Une fuentes por id de forma estable y conserva solo prefijos completos que
 * caben. Nunca corta una fuente ni inventa un resumen; así la reducción se
 * puede reproducir y siempre mantiene trazabilidad.
 */
export function prepararContexto(fuentes: FuenteContexto[], presupuesto: PresupuestoContexto, componentes: { sistema?: string; usuario?: string } = {}): ContextoPreparado {
  // caracteres/4 es una estimación, no un conteo exacto: se reserva margen.
  const fijos = (componentes.sistema?.length ?? 0) + (componentes.usuario?.length ?? 0);
  const maximo = limite(presupuesto) - fijos;
  if (!maximo) return { texto: '', fuentes: [], caracteres: 0, tokens_aproximados: 0, reducido: false, resumen_utilizado: false, rechazo: true, razon_rechazo: 'presupuesto_invalido' };
  const ordenadas = [...fuentes].sort((a, b) => (b.prioridad ?? 0) - (a.prioridad ?? 0) || a.id.localeCompare(b.id));
  const partes: string[] = []; const usadas: string[] = [];
  let longitud = 0; let reducido = false;
  for (const fuente of ordenadas) {
    const parte = `[${fuente.id}] ${fuente.texto}`;
    const separador = partes.length ? 1 : 0;
    if (parte.length + separador > maximo) { reducido = true; continue; }
    if (longitud + parte.length + separador > maximo) { reducido = true; continue; }
    partes.push(parte); usadas.push(fuente.id); longitud += parte.length + separador;
  }
  if (fuentes.length > 0 && partes.length === 0) {
    return { texto: '', fuentes: [], caracteres: 0, tokens_aproximados: 0, reducido: true, resumen_utilizado: false, rechazo: true, razon_rechazo: 'no_reducible' };
  }
  const texto = partes.join('\n');
  return { texto, fuentes: usadas, caracteres: texto.length, tokens_aproximados: estimarTokens(texto), reducido, resumen_utilizado: false, rechazo: false };
}
