import type { MensajeRecibido } from './webhook.ts';
import type { Respuesta } from './tipos.ts';
import { SesionesWhatsApp, type Contexto, type EstadoSesion } from './sesiones.ts';

export interface ModulosAtlas {
  curso?: (telefono: string, texto: string, interactivoId?: string) => Promise<Respuesta | string>;
  trading?: (telefono: string, texto: string, interactivoId?: string) => Promise<Respuesta | string>;
  empresa?: (telefono: string, texto: string, interactivoId?: string) => Promise<Respuesta | string>;
}

const MENU: Respuesta = {
  tipo: 'botones',
  header: '🤖 Atlas',
  cuerpo: 'Asistente educativo autónomo.\n\nElige un módulo:',
  footer: 'Escribe "ayuda" para más info',
  botones: [
    { id: 'mod_curso', titulo: '📚 Programación' },
    { id: 'mod_trading', titulo: '📈 Trading' },
    { id: 'mod_empresa', titulo: '🏢 Empresa' },
  ],
};

const AYUDA: Respuesta = {
  tipo: 'lista',
  header: '📖 Ayuda de Atlas',
  cuerpo: 'Soy un asistente educativo que te enseña programación, trading simulado y gestión de empresas virtuales.',
  botonTexto: 'Ver opciones',
  secciones: [
    {
      titulo: 'Módulos',
      filas: [
        { id: 'mod_curso', titulo: '📚 Programación', descripcion: 'TypeScript desde cero' },
        { id: 'mod_trading', titulo: '📈 Trading', descripcion: 'Simulador con dinero ficticio' },
        { id: 'mod_empresa', titulo: '🏢 Empresa', descripcion: 'Gestiona empresas virtuales' },
      ],
    },
    {
      titulo: 'Comandos',
      filas: [
        { id: 'cmd_menu', titulo: 'Menú principal', descripcion: 'Volver al inicio' },
        { id: 'cmd_ayuda', titulo: 'Ayuda', descripcion: 'Ver esta ayuda' },
      ],
    },
  ],
};

const MAPA_INTERACTIVO: Record<string, Contexto> = {
  mod_curso: 'curso',
  mod_trading: 'trading',
  mod_empresa: 'empresa',
};

const MAPA_TEXTO: Record<string, Contexto> = {
  '1': 'curso',
  '2': 'trading',
  '3': 'empresa',
};

const COMANDOS_GLOBALES = ['menu', 'menú', '0', 'salir', 'inicio', 'start'];
const COMANDOS_AYUDA = ['ayuda', 'help', '?'];

export class RouterWhatsApp {
  private sesiones: SesionesWhatsApp;
  private modulos: ModulosAtlas;

  constructor(sesiones: SesionesWhatsApp, modulos: ModulosAtlas = {}) {
    this.sesiones = sesiones;
    this.modulos = modulos;
  }

  async procesar(msg: MensajeRecibido): Promise<Respuesta | string> {
    const texto = msg.texto.trim();
    const lower = texto.toLowerCase();
    const iid = msg.interactivo?.id;

    if (iid === 'cmd_menu' || COMANDOS_GLOBALES.includes(lower)) {
      this.sesiones.guardar(msg.from, msg.nombre, { contexto: 'menu', datos: {} });
      return MENU;
    }

    if (iid === 'cmd_ayuda' || COMANDOS_AYUDA.includes(lower)) {
      return AYUDA;
    }

    // Selección de módulo desde botón o lista interactiva
    if (iid && MAPA_INTERACTIVO[iid]) {
      return this.entrarModulo(msg, MAPA_INTERACTIVO[iid]);
    }

    const estado = this.sesiones.obtener(msg.from);

    if (estado.contexto === 'menu') {
      const destino = MAPA_TEXTO[lower];
      if (destino) return this.entrarModulo(msg, destino);
      return {
        tipo: 'botones',
        cuerpo: `No entendí "${texto}". Elige una opción:`,
        botones: [
          { id: 'mod_curso', titulo: '📚 Programación' },
          { id: 'mod_trading', titulo: '📈 Trading' },
          { id: 'mod_empresa', titulo: '🏢 Empresa' },
        ],
      };
    }

    return this.delegarModulo(msg, estado, texto, iid);
  }

  private entrarModulo(msg: MensajeRecibido, destino: Contexto): Respuesta {
    const nuevoEstado: EstadoSesion = { contexto: destino, datos: {} };
    this.sesiones.guardar(msg.from, msg.nombre, nuevoEstado);

    const disponible = this.modulos[destino as keyof ModulosAtlas];
    if (!disponible) {
      return {
        tipo: 'botones',
        cuerpo: `Este módulo aún no está conectado.`,
        botones: [{ id: 'cmd_menu', titulo: '↩️ Volver al menú' }],
      };
    }

    return BIENVENIDA_MODULO[destino] ?? {
      tipo: 'botones',
      cuerpo: `Has entrado al módulo. Escribe tu mensaje.`,
      botones: [{ id: 'cmd_menu', titulo: '↩️ Menú' }],
    };
  }

  private async delegarModulo(msg: MensajeRecibido, estado: EstadoSesion, texto: string, interactivoId?: string): Promise<Respuesta | string> {
    const handler = this.modulos[estado.contexto as keyof ModulosAtlas];
    if (!handler) {
      this.sesiones.guardar(msg.from, msg.nombre, { contexto: 'menu', datos: {} });
      return MENU;
    }

    try {
      this.sesiones.guardar(msg.from, msg.nombre, estado);
      return await handler(msg.from, texto, interactivoId);
    } catch {
      return {
        tipo: 'botones',
        cuerpo: '⚠️ Error procesando tu mensaje.',
        botones: [
          { id: 'cmd_menu', titulo: '↩️ Menú' },
        ],
      };
    }
  }

  close(): void {
    this.sesiones.close();
  }
}

// --- Pantallas de bienvenida por módulo ---

const BIENVENIDA_MODULO: Partial<Record<Contexto, Respuesta>> = {
  curso: {
    tipo: 'lista',
    header: '📚 Curso de Programación',
    cuerpo: 'Aprende TypeScript desde cero. Elige un tema o escribe tu pregunta.',
    botonTexto: 'Ver temas',
    secciones: [
      {
        titulo: 'Nivel 1 — Fundamentos',
        filas: [
          { id: 'tema_variables', titulo: 'Variables y tipos', descripcion: 'let, const, string, number' },
          { id: 'tema_funciones', titulo: 'Funciones', descripcion: 'Parámetros, retorno, arrow' },
          { id: 'tema_condicionales', titulo: 'Condicionales', descripcion: 'if, else, switch' },
        ],
      },
      {
        titulo: 'Nivel 2 — Intermedio',
        filas: [
          { id: 'tema_arrays', titulo: 'Arrays y objetos', descripcion: 'map, filter, reduce' },
          { id: 'tema_clases', titulo: 'Clases', descripcion: 'OOP básica en TypeScript' },
          { id: 'tema_async', titulo: 'Async/Await', descripcion: 'Promesas y asincronía' },
        ],
      },
    ],
  },
  trading: {
    tipo: 'botones',
    header: '📈 Trading Simulator',
    cuerpo: 'Practica trading con dinero ficticio. Sin riesgo real.',
    footer: 'Capital inicial: $10,000 simulados',
    botones: [
      { id: 'trade_portafolio', titulo: '💼 Mi portafolio' },
      { id: 'trade_comprar', titulo: '🟢 Comprar' },
      { id: 'trade_vender', titulo: '🔴 Vender' },
    ],
  },
  empresa: {
    tipo: 'botones',
    header: '🏢 Simulador de Empresa',
    cuerpo: 'Gestiona una empresa virtual. Toma decisiones y observa resultados.',
    botones: [
      { id: 'emp_estado', titulo: '📊 Estado actual' },
      { id: 'emp_nueva', titulo: '🆕 Nueva empresa' },
      { id: 'emp_decisiones', titulo: '⚡ Decisiones' },
    ],
  },
};
