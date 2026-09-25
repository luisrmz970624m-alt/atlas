# Atlas — Entrega: Sistema Multiagente (Ollama + Claude + ChatGPT)

**Fecha:** 24 de septiembre de 2026
**Commits de esta entrega:** `b016074`, `cc02805`
**Estado:** ✅ Verificado, probado desde cero, listo para usar con claves reales

---

## 1. Qué se construyó

Atlas ahora es el **cerebro que decide** qué inteligencia artificial responde cada petición, en vez de estar atado únicamente a Ollama. Se agregaron tres proveedores intercambiables detrás de un mismo contrato:

| Proveedor | Motor | Costo | Necesita |
|---|---|---|---|
| **Ollama** (por defecto) | `qwen2.5-coder:14b` | Gratis, corre en tu PC | Nada — ya funciona |
| **Claude** | `claude-opus-5` | Se cobra por uso | `ANTHROPIC_API_KEY` |
| **ChatGPT** | `gpt-4o` | Se cobra por uso | `OPENAI_API_KEY` |

Comando nuevo para ver el estado de los tres:

```bash
npm run atlas -- agentes
```

---

## 2. Por qué está diseñado así (para que dure)

**Un solo contrato, tres implementaciones.** Todo el resto de Atlas (el profesor, el evaluador, el ciclo de aprendizaje) solo conoce esta firma:

```typescript
type Generador = (sistema: string, usuario: string) => Promise<string>;
```

No conoce si detrás hay Ollama, Claude o ChatGPT. **Prueba de que funciona:** al mover toda la lógica de Ollama a su propio archivo y agregar los otros dos proveedores, **ningún otro archivo del proyecto cambió una sola línea** — ni `ciclo.ts`, ni `evaluacion.ts`, ni `curso.ts`. Eso es lo que significa "código adaptable, no desechable": se puede agregar un cuarto proveedor mañana sin tocar nada de lo que ya funciona.

**Atlas decide, no adivina.** El orden de preferencia es configurable:

```bash
ATLAS_PROVEEDOR=claude,ollama npm run atlas -- estudiar
```

Si el primero falla (sin clave, sin crédito, límite de peticiones), Atlas pasa automáticamente al siguiente — pero **solo en esos casos**. Si una respuesta llega cortada por falta de espacio, Atlas **no** la reintenta en otro proveedor de pago, porque el problema es el contenido pedido, no el proveedor; reintentar ahí solo gastaría dinero para fallar igual.

---

## 3. Verificación realizada (código real, no solo tests)

Esto es lo que pediste explícitamente: probar todo de nuevo, no solo confiar en que "los tests pasan". Se hizo en dos pasos:

### Paso 1 — Suite completa desde cero
```
201/201 tests pasando, 16 segundos, sin residuos de bases de datos previas
```

### Paso 2 — Verificación línea por línea contra el SDK real instalado

Las 5 revisiones automáticas en paralelo que iban a hacer esto se cortaron por límite de la API de Anthropic (rate limit) sin producir hallazgos. En vez de dejarlo así, se hizo la verificación a mano, leyendo los tipos reales dentro de `node_modules`:

| Verificado | Resultado |
|---|---|
| `MessageStream.finalMessage()` existe en el SDK de Anthropic | ✅ Correcto |
| Evento `'text'` para reportar avance | ✅ Correcto |
| `stop_reason`, `stop_details`, `RefusalStopDetails` (Claude puede negarse a responder) | ✅ Correcto, manejado |
| Clases de error `AuthenticationError`, `RateLimitError`, `APIError` en ambos SDKs | ✅ Existen en tiempo real, verificado ejecutando código |
| `system` como texto plano en Claude | ✅ Correcto |
| `response_format: {type: 'json_object'}` en OpenAI | ✅ Correcto |
| Streaming con `for await` en ambos SDKs | ✅ Patrón estándar correcto |
| **`max_tokens` en Chat Completions de OpenAI** | ❌ **Deprecado desde 2024** — corregido a `max_completion_tokens` |

**El único problema real encontrado ya está corregido** (commit `cc02805`): OpenAI dejó de recomendar el parámetro `max_tokens` en su API de Chat Completions. Seguía funcionando hoy, pero es exactamente el tipo de cosa que "falla meses después" cuando el proveedor lo retira — se corrigió antes de que eso pasara.

### Prueba de humo final

```
claude:  claude-opus-5    disponible: false  (sin ANTHROPIC_API_KEY, correcto)
chatgpt: gpt-4o           disponible: false  (sin OPENAI_API_KEY, correcto)
ollama:  qwen2.5-coder:14b disponible: true  (funciona ahora mismo)

Atendería ahora: ollama (qwen2.5-coder:14b)
```

Los tres proveedores importan, se instancian y responden correctamente sobre su disponibilidad sin necesitar ninguna clave — tal como debe comportarse un sistema que puede fallar en producción sin romperse.

---

## 4. Lo único que falta para usar Claude o ChatGPT de verdad

No se pudo probar una respuesta **real** de Claude o ChatGPT porque este entorno no tiene `ANTHROPIC_API_KEY` ni `OPENAI_API_KEY` configuradas. Eso es correcto y esperado — no se inventaron respuestas ni se simuló nada.

Para activarlos:

```bash
export ANTHROPIC_API_KEY="tu-clave-aquí"
npm run atlas -- agentes     # debería mostrar claude como ✅ disponible
```

---

## 5. Estado general del proyecto tras esta entrega

| Métrica | Valor |
|---|---|
| Líneas de código en `src/` | 6,397 |
| Archivos de código | 30 |
| Archivos de pruebas | 16 |
| Tests totales | 201 |
| Tests pasando | 201 (100%) |
| Proveedores de IA | 3 (Ollama, Claude, ChatGPT) |
| Commits en esta sesión | 2 (`b016074`, `cc02805`) |

---

## 6. Qué NO se hizo (para que no haya sorpresas)

- No se gastó dinero real: sin claves configuradas, ninguna llamada a Claude o ChatGPT pudo ejecutarse.
- No se implementó todavía el módulo de "empresa simulada" de Atlas Business OS (nómina, facturación, inventario) — eso sigue pendiente, es un proyecto separado que reusa este mismo núcleo cuando se decida arrancarlo.
- No se hizo la revisión de 5 copias en paralelo que se había planeado — se sustituyó por verificación manual directa contra el código fuente del SDK, que es más lenta pero no depende de que la API esté disponible.
