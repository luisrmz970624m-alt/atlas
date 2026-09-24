// Contrato que cumple cualquier proveedor de IA. Atlas habla con este
// contrato y nunca con un proveedor concreto: por eso se puede cambiar de
// Ollama a Claude o a ChatGPT sin tocar el ciclo, la evaluación ni el curso.

/** Firma de un generador de texto. Se inyecta para poder probar sin modelo. */
export type Generador = (sistema: string, usuario: string) => Promise<string>;

/** Se llama con cada trozo generado, para poder mostrar avance. */
export type Avance = (tokens: number) => void;

export class ModeloNoDisponible extends Error {}

/** La respuesta se cortó a la mitad: el modelo se quedó sin espacio. */
export class RespuestaIncompleta extends Error {}

export type NombreProveedor = 'ollama' | 'claude' | 'chatgpt';

export interface Proveedor {
  nombre: NombreProveedor;
  /** Modelo concreto que usa (para mostrarlo y registrarlo). */
  modelo: string;
  /** true si corre en tu máquina y no cuesta dinero. */
  local: boolean;
  /** Si no está configurado (falta clave, falta servicio), Atlas no lo elige. */
  disponible(): boolean;
  generar: Generador;
}

let avisar: Avance | null = null;

/** Registra un observador de avance, compartido por todos los proveedores. */
export function alGenerar(f: Avance | null): void { avisar = f; }

/** Lo usan los proveedores para reportar progreso. */
export function reportarAvance(tokens: number): void { avisar?.(tokens); }
