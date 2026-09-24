// Puerta única de Atlas hacia la IA.
//
// Nada fuera de este archivo sabe qué proveedor responde. El ciclo, la
// evaluación y el curso solo conocen el contrato `Generador`, y por eso las
// pruebas corren sin encender ningún modelo. Los proveedores concretos viven
// en src/proveedores/ y se pueden añadir o quitar sin tocar nada más.

export {
  ModeloNoDisponible,
  RespuestaIncompleta,
  alGenerar,
  type Generador,
  type Avance,
  type NombreProveedor,
  type Proveedor,
} from './proveedores/tipos.ts';

export {
  generar,
  proveedorActivo,
  proveedoresDisponibles,
  ordenConfigurado,
  PROVEEDORES,
} from './proveedores/seleccion.ts';

export { CONTEXTO, MAX_SALIDA } from './proveedores/ollama.ts';

import { proveedorActivo } from './proveedores/seleccion.ts';
import { MODELO_OLLAMA } from './proveedores/ollama.ts';

/**
 * Nombre del modelo que se está usando, para mostrarlo en pantalla y dejarlo
 * en el registro. Si no hay ninguno configurado, se nombra el local por ser
 * el que Atlas intentaría primero.
 */
export const MODELO = proveedorActivo()?.modelo ?? MODELO_OLLAMA;

export { extraerJSON } from './extraer-json.ts';
