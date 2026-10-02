import { WhatsAppWebhook, ReplayGuard, type HandlerMensaje, type MensajeRecibido } from './webhook.ts';
import { WhatsAppSender } from './sender.ts';
import { SesionesWhatsApp, type Contexto, type EstadoSesion } from './sesiones.ts';
import { RouterWhatsApp, type ModulosAtlas } from './router.ts';
import type { WhatsAppConfig, Respuesta, RespuestaTexto, RespuestaBotones, RespuestaLista } from './tipos.ts';

export function crearWhatsApp(config: WhatsAppConfig, modulos: ModulosAtlas = {}, dbPath?: string): {
  webhook: WhatsAppWebhook;
  sender: WhatsAppSender;
  router: RouterWhatsApp;
  sesiones: SesionesWhatsApp;
} {
  const sesiones = new SesionesWhatsApp(dbPath);
  const router = new RouterWhatsApp(sesiones, modulos);
  const webhook = new WhatsAppWebhook(config);
  const sender = new WhatsAppSender(config);

  webhook.onMensaje(async (msg) => router.procesar(msg));

  return { webhook, sender, router, sesiones };
}

export function configDesdeEnv(): WhatsAppConfig | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!accessToken || !phoneNumberId || !verifyToken || !appSecret) return null;

  return { accessToken, phoneNumberId, verifyToken, appSecret };
}

export { WhatsAppWebhook, WhatsAppSender, SesionesWhatsApp, RouterWhatsApp, ReplayGuard };
export type {
  WhatsAppConfig, HandlerMensaje, MensajeRecibido,
  Contexto, EstadoSesion, ModulosAtlas,
  Respuesta, RespuestaTexto, RespuestaBotones, RespuestaLista,
};
