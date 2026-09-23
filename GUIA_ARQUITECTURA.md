# Guía de Arquitectura — Atlas V0.6.1

Atlas está construido sobre **tres pilares**: registro auditable, supervisor de seguridad, y ciclo de aprendizaje.

---

## Arquitectura de alto nivel

```
┌─────────────────────────────────────────────────────────────┐
│                      Línea de comandos (atlas.ts)           │
│  estudiar | responder | evaluar | progreso | objetivo ...   │
└────────────────┬────────────────────────────────┬───────────┘
                 │                                │
         ┌───────▼────────┐          ┌────────────▼────┐
         │   Memoria      │          │    Registro     │
         │   (SQLite)     │          │  (SHA-256 chain)│
         │                │          │                 │
         │ 5 espacios:    │          │ Append-only,    │
         │ · personal     │          │ no borra/edita  │
         │ · programación │          │ Verifiable: ✅  │
         │ · trading      │          │                 │
         │ · simulaciones │          └─────────────────┘
         │ · sistema      │
         └────────────────┘
                 ▲
                 │
         ┌───────┴──────────────┐
         │   Supervisor         │
         │   (control de acceso)│
         │                      │
         │ Rojo (nunca)         │
         │ Amarillo (permisos)  │
         │ Verde (adelante)     │
         └───────┬──────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
  ┌───▼────┐          ┌─────▼──┐
  │ Ciclo  │          │Modelo  │
  │(núcleo)│          │(Ollama) │
  └────────┘          └─────────┘
```

---

## 1. Registro (`src/registro.ts`)

**Propósito:** Historial completo e inmodificable de todo lo que Atlas hace.

**Estructura de un evento:**
```json
{
  "id": 42,
  "fecha": "2026-09-23T04:30:00Z",
  "hash": "abc123...",
  "hash_anterior": "xyz789...",
  "nivel": "verde",
  "tipo": "resultado",
  "descripcion": "Evaluación del ejercicio 'terminal'",
  "entrada": { "tema": "terminal", "respuesta": "respuestas/terminal.ts" },
  "salida": { "motivo": "aprobado", "corrio": true, "cumple": true },
  "veredicto": "exito",
  "razon": "El código ejecutó sin errores y cumple el enunciado"
}
```

**Garantías:**
- No existe función que borre o edite eventos
- Cada evento lleva la huella SHA-256 del anterior
- `auditar()` recorre la cadena y detecta cualquier alteración

**Limitaciones:**
- Es detectable pero no inmutable: con acceso al archivo, alguien podría editar eventos y recalcular huellas
- Futuro: `chattr +a`, firmas HMAC, puntos de control

---

## 2. Supervisor (`src/supervisor.ts`)

**Propósito:** Única puerta al registro. Aplica reglas de seguridad antes de escribir.

**Tres niveles:**

| Nivel | Ejemplo | Reacción |
|-------|---------|----------|
| 🔴 Rojo (nunca) | `sudo`, `rm -rf`, `mkfs`, transferencias | **Rechazado siempre** |
| 🟡 Amarillo (permiso) | `pip install`, `npm install -g` | **Pide tu aprobación** |
| 🟢 Verde (adelante) | Crear archivo, leer, ejecutar código | **Se ejecuta directamente** |

**Detección de secretos:**
- Busca patrones de contraseñas, claves, tokens
- Los rechaza ANTES de que lleguen al registro

**Separación acción/dato:**
- Las reglas de acción se aplican a: descripción, herramienta, ruta
- Las reglas de secreto se aplican al contenido
- Así, una lección que menciona "contraseña" no queda bloqueada

---

## 3. Ciclo de aprendizaje (`src/ciclo.ts`)

**Propósito:** El flujo completo: planificar → ejecutar → verificar → aprender.

**Pasos:**
1. **Recibir** objetivo (p.ej., "generar lección de terminal")
2. **Comprender** qué pide (con estándar vigente)
3. **Consultar memoria** de intentos anteriores
4. **Planear** pasos (con huellas de seguridad)
5. **Revisar seguridad** (¿es rojo? ¿amarillo?)
6. **Actuar** (escribir archivos, ejecutar herramientas)
7. **Observar** resultados
8. **Verificar** contra estándar
9. **Aprender** (del rechazo o aprobación)
10. **Terminar** (registrar, actualizar memoria)

**Aprendizaje del rechazo:**
- Si el estándar rechaza, Atlas no repite el mismo plan
- `perseguir()` modifica el plan basado en por qué falló

---

## 4. Herramientas (`src/herramientas.ts`)

Atlas tiene 4 herramientas, todas encerradas en `laboratorio/`:

```typescript
escribir_archivo(ruta, contenido)      // Crea archivo
agregar_archivo(ruta, contenido)       // Agrega líneas
leer_archivo(ruta)                     // Lee archivo
listar_carpeta(ruta)                   // Lista directorios
```

**Garantía:** `rutaSegura()` rechaza cualquier ruta que salga de `laboratorio/`.

---

## 5. Memoria (`src/memoria.ts`)

**Almacén:** SQLite con 5 espacios nunca se mezclan.

**Campos por recuerdo:**
```sql
CREATE TABLE memoria (
  id INTEGER PRIMARY KEY,
  espacio TEXT,           -- personal | programacion | trading | simulaciones | sistema
  clave TEXT,             -- tema:terminal, revision:funciones, operacion:BTC-USD
  resumen TEXT,
  origen TEXT,            -- hecho | deduccion
  fuente TEXT,            -- usuario | qwen2.5-coder | modelo
  confianza REAL,         -- 0.0 a 1.0 (deducción puede ser 0.6, hecho es 1.0)
  fecha TEXT,             -- ISO 8601
  datos JSON              -- datos estructurados
);
```

**Principios:**
- Un dato nuevo **supera** al viejo (no lo borra)
- Deducciones se marcan como tales (nunca como hecho)
- Olvidar es una orden explícita tuya y queda registrada
- **Nunca** guarda contraseñas, claves, tokens

**Ejemplo:**
```typescript
m.recordar({
  espacio: 'programacion',
  clave: 'tema:terminal',
  resumen: 'practicado; 1 práctica; repaso el 2026-09-24',
  origen: 'hecho',
  fuente: 'supervisor',
  confianza: 1.0,
  datos: { estado: 'practicado', practicas: ['2026-09-23'], repaso: '2026-09-24' }
});
```

---

## 6. Profesor (`src/curso.ts`)

**Temario:** 15 temas en 3 niveles, con requisitos entre ellos.

**Estados de un tema:**
```
pendiente → material → practicado → dominado
```

- `pendiente`: no hay lección
- `material`: Atlas generó lección, tú no practicaste
- `practicado`: hiciste ejercicio una vez
- `dominado`: dos prácticas en días distintos

**Repasos espaciados:** 1, 3, 7, 14, 30 días.

**Requisitos:** p.ej., `filesystem` requiere `terminal`.

---

## 7. Evaluador (`src/evaluacion.ts`)

**Dos capas:**

1. **Ejecución (hecho duro):**
   - Ejecuta tu código con `spawnSync`
   - Tope: 10 segundos
   - Si revienta, no aprueba (punto)

2. **Revisión del modelo (opinión):**
   - Le pregunta al modelo si cumple enunciado
   - Se guarda como **deducción**, no como hecho
   - Confianza típica: 0.8 (código ejecutó) o 0.6 (no ejecutó)

**Resultado final:**
- Código NO ejecuta → No aprueba (sin importar opinión)
- Código ejecuta pero no cumple → No aprueba
- Código ejecuta Y cumple → Aprobado

---

## 8. Modelo (`src/modelo.ts`)

**Conexión a Ollama:**
- Streaming NDJSON
- Formato JSON para respuestas estructuradas
- Timeout adaptativo (importante: a 3.86 tokens/s, un plan largo tarda minutos)

**Limitaciones del modelo:**
- No es el juez final (el evaluador sí)
- Puede mentir (se guarda como deducción con confianza < 1.0)
- No ve archivos, solo texto pasado a través de prompts

---

## 9. Estándares (`src/estandares.ts`)

**Reglas de calidad que el modelo NO puede negociar.**

Ejemplo: una lección debe:
- ≥20 líneas
- Al menos un ejemplo de código
- Sección "## Ejercicio"
- Ejercicio sin solución resuelta
- No mandar a compilar con `tsc`
- No mandar a instalar paquetes globales

El modelo puede escribir mal, pero `verificacion.ts` comprueba estos puntos **sobre el archivo real** en disco.

---

## Flujo de datos: de punta a punta

**Ejemplo: Usuario corre `npm run atlas -- evaluar terminal`**

```
1. atlas.ts: parsea comando, carga Memoria
2. atlas.ts: llama a evaluarRespuesta(leccion, respuesta, generar)
3. evaluacion.ts:
   a. Lee leccion-01.md, extrae enunciado
   b. Lee respuesta.ts
   c. Ejecuta respuesta.ts con spawnSync → Ejecucion { corrio: true, salida: "..." }
   d. Pasa enunciado + respuesta + ejecucion al modelo
   e. Modelo devuelve Revision { cumple: true, aciertos: [...], faltantes: [], pista: "..." }
   f. Combina en Resultado { aprobado: true, motivo: "aprobado", ... }
4. atlas.ts:
   a. Si aprobado: registrarPractica(memoria, 'terminal')
   b. memoria: actualiza estado a "practicado", programa repaso
   c. supervisor.registrar() agrega evento al registro
   d. Imprime resultado
```

---

## Principio de modularización (todas las versiones)

Cada archivo en `src/` cubre una sola responsabilidad. Cuando uno empieza a mezclar más de una (ej. lógica de negocio + comandos de CLI), se divide en archivos nuevos en vez de dejarlo crecer. Ver detalle y ejemplo aplicado en `V0.8_ARQUITECTURA_COMPETENCIA.md § 9`.

## Motores adaptables (hardware real opcional)

Los motores simulados (ej. minería en `src/mineria.ts`) deben poder aceptar una fuente de datos real como alternativa (patrón adapter), sin bifurcar el código en versiones separadas. Ver diseño propuesto en `V0.8_ARQUITECTURA_COMPETENCIA.md § 2`.

---

## Límites arquitectónicos

**Lo que Atlas garantiza:**
- Registro íntegro (detectable si alguien lo altera)
- Supervisor bloquea lo rojo
- Código no sale de `laboratorio/`
- Hecho duro (ejecución) gana sobre opinión

**Lo que NO garantiza:**
- Red aislada (tu código puede acceder a Internet)
- Memoria/CPU limitada (sin cgroups del sistema)
- Symlinks bloqueados (alguien podría crear symlink a fuera)
- Código no es sandbox (fork bombs, etc.)

**Es tu máquina. Es tu responsabilidad.**

---

## Rutas de mejora

**V0.7:** Planificador con persistencia.
- Guardar tareas en SQLite
- Programar ejecución (fecha/hora)
- Notificaciones

**V0.8:** Trading educativo.
- Billetera simulada
- Órdenes ficticias
- Métricas (Sharpe, max drawdown)

**V0.9:** Interfaz web + seguridad.
- Dashboard de progreso
- Editor en navegador
- `chattr +a` en registro
- Firmas HMAC

**V1.0:** Documentación completa, estable.
