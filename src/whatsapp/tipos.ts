// Tipos para WhatsApp Business Cloud API

export interface WhatsAppConfig {
  /** Token de acceso permanente (System User) */
  accessToken: string;
  /** ID del número de teléfono de WhatsApp Business */
  phoneNumberId: string;
  /** Token de verificación para el webhook (lo defines tú) */
  verifyToken: string;
  /** App secret de Meta (para verificar X-Hub-Signature-256) */
  appSecret: string;
  /** Versión de la Graph API */
  apiVersion?: string;
}

// --- Webhook entrante ---

export interface WebhookPayload {
  object: 'whatsapp_business_account';
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: {
    messaging_product: 'whatsapp';
    metadata: { display_phone_number: string; phone_number_id: string };
    contacts?: WebhookContact[];
    messages?: WebhookMessage[];
    statuses?: WebhookStatus[];
  };
  field: 'messages';
}

export interface WebhookContact {
  profile: { name: string };
  wa_id: string;
}

export interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'document' | 'interactive' | 'button';
  text?: { body: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
}

export interface WebhookStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

// --- Mensajes salientes ---

export interface OutgoingTextMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: { preview_url: boolean; body: string };
}

export interface Boton {
  type: 'reply';
  reply: { id: string; title: string };
}

export interface OutgoingButtonMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button';
    header?: { type: 'text'; text: string };
    body: { text: string };
    footer?: { text: string };
    action: { buttons: Boton[] };
  };
}

export interface FilaLista {
  id: string;
  title: string;
  description?: string;
}

export interface SeccionLista {
  title: string;
  rows: FilaLista[];
}

export interface OutgoingListMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'list';
    header?: { type: 'text'; text: string };
    body: { text: string };
    footer?: { text: string };
    action: { button: string; sections: SeccionLista[] };
  };
}

export type OutgoingMessage = OutgoingTextMessage | OutgoingButtonMessage | OutgoingListMessage;

// --- Respuesta del router (texto simple o interactivo) ---

export interface RespuestaTexto {
  tipo: 'texto';
  texto: string;
}

export interface RespuestaBotones {
  tipo: 'botones';
  cuerpo: string;
  header?: string;
  footer?: string;
  botones: Array<{ id: string; titulo: string }>;
}

export interface RespuestaLista {
  tipo: 'lista';
  cuerpo: string;
  header?: string;
  footer?: string;
  botonTexto: string;
  secciones: Array<{ titulo: string; filas: Array<{ id: string; titulo: string; descripcion?: string }> }>;
}

export type Respuesta = RespuestaTexto | RespuestaBotones | RespuestaLista;
