// Arranque oficial de El Vórtice + API local: `npm run panel`.
// Reutiliza AtlasLocalApi (no hay un segundo servidor HTTP), escucha solo en
// 127.0.0.1, no usa red externa y opera sobre una empresa simulada en memoria.
import { pathToFileURL } from 'node:url';
import { AtlasLocalApi } from './servidor.ts';
import { EstadoPanelAtlas } from '../panel/contratos.ts';
import { crearEmpresa } from '../empresa-simulator/empresa.ts';
import { MemoriaEmpresarial } from '../empresa-simulator/memoria.ts';
import { SimulationScheduler } from '../simulaciones/orquestador.ts';

export const PANEL_HOST = '127.0.0.1';
export const PANEL_PUERTO_DEFAULT = 4317;

export interface ConfigPanel { host: typeof PANEL_HOST; port: number; }
export interface PanelEnMarcha { host: string; port: number; url: string; apiUrl: string; cerrar: () => Promise<void>; }

export class ErrorPanel extends Error {}

/** Lee ATLAS_PANEL_PORT y ATLAS_PANEL_HOST; rechaza cualquier bind que no sea loopback. */
export function configPanel(env: NodeJS.ProcessEnv = process.env): ConfigPanel {
  const host = env.ATLAS_PANEL_HOST?.trim() || PANEL_HOST;
  if (host !== PANEL_HOST) throw new ErrorPanel(`ATLAS_PANEL_HOST=${host} no está permitido: El Vórtice solo escucha en ${PANEL_HOST}.`);
  const crudo = env.ATLAS_PANEL_PORT?.trim();
  if (!crudo) return { host: PANEL_HOST, port: PANEL_PUERTO_DEFAULT };
  const port = /^\d{1,5}$/.test(crudo) ? Number(crudo) : NaN;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new ErrorPanel(`ATLAS_PANEL_PORT=${crudo} no es un puerto válido (0-65535).`);
  return { host: PANEL_HOST, port };
}

export const urlPanel = (port: number): string => `http://${PANEL_HOST}:${port}/panel-vortice/`;

function empresaDemo() {
  return crearEmpresa({ nombre: 'Atlas Demo Company', moneda: 'MXN', capitalInicial: 250000, empleados: 6, seed: 7, productos: [{ id: 'p1', nombre: 'Producto Sintético', precio: 120, costo: 70, stockInicial: 300, stockMinimo: 20 }] });
}

/** Inicia la API local con el panel. Si el puerto está ocupado falla con un mensaje claro y no toca al otro proceso. */
export async function iniciarPanel(config: ConfigPanel = configPanel()): Promise<PanelEnMarcha> {
  const memoria = new MemoriaEmpresarial();
  const estado = new EstadoPanelAtlas(empresaDemo(), new SimulationScheduler({ maxConcurrentWorkers: 2, maxTradingWorkers: 1, maxBusinessWorkers: 1 }), memoria);
  let api: AtlasLocalApi;
  try {
    api = new AtlasLocalApi({ dashboard: () => estado.obtener() }, { host: config.host, port: config.port });
    await api.start();
  } catch (e) {
    memoria.cerrar();
    if ((e as NodeJS.ErrnoException).code === 'EADDRINUSE') throw new ErrorPanel(`El puerto ${config.port} ya está en uso en ${PANEL_HOST}. Atlas no detiene procesos ajenos; elige otro con ATLAS_PANEL_PORT=<puerto> npm run panel.`);
    if ((e as NodeJS.ErrnoException).code === 'EACCES') throw new ErrorPanel(`Sin permiso para escuchar en el puerto ${config.port}; usa un puerto mayor a 1023 con ATLAS_PANEL_PORT.`);
    throw e;
  }
  const { host, port } = api.address();
  let cierre: Promise<void> | null = null;
  const cerrar = () => cierre ??= api.close().finally(() => memoria.cerrar());
  return { host, port, url: urlPanel(port), apiUrl: `http://${PANEL_HOST}:${port}/api/status`, cerrar };
}

async function main(): Promise<void> {
  let panel: PanelEnMarcha;
  try {
    panel = await iniciarPanel(configPanel());
  } catch (e) {
    console.error(`ATLAS_PANEL_ERROR=${(e as Error).message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ATLAS_PANEL_URL=${panel.url}`);
  console.log(`ATLAS_API_URL=${panel.apiUrl}`);
  console.log('El Vórtice activo en loopback, sin red externa y con datos SIMULATED. Ctrl+C para detener.');

  const apagar = (senal: string) => {
    console.log(`\n${senal} recibido: cerrando El Vórtice…`);
    // Si una conexión no suelta el servidor, no dejamos el proceso colgado.
    const limite = setTimeout(() => { console.error('ATLAS_PANEL_ERROR=cierre forzado tras 5 s.'); process.exit(1); }, 5000);
    limite.unref();
    panel.cerrar().then(
      () => { process.off('SIGINT', onSigint); process.off('SIGTERM', onSigterm); console.log('ATLAS_PANEL_CERRADO=true'); },
      (e) => { console.error(`ATLAS_PANEL_ERROR=${(e as Error).message}`); process.exitCode = 1; },
    );
  };
  const onSigint = () => apagar('SIGINT'), onSigterm = () => apagar('SIGTERM');
  process.on('SIGINT', onSigint);
  process.on('SIGTERM', onSigterm);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
