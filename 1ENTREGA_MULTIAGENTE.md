# Atlas — Entrega: Sistema Multiagente (Ollama + Claude + ChatGPT)

**Fecha:** 24-25 de septiembre de 2026
**Commits de esta entrega:** `b016074`, `cc02805`, `5bba6c7`, `45de670`
**Estado:** ✅ Verificado, probado desde cero, **y confirmado con una respuesta real de Claude de punta a punta**

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

No se pudo probar una respuesta **real** de Claude o ChatGPT porque este entorno no tiene `ANTHROPIC_API_KEY` ni `OPENAI_API_KEY` configuradas, y por seguridad nunca debo pedirte que me pegues una clave ni escribirla yo mismo — eso queda prohibido sin excepción. La verificación anterior (§3) confirmó que el código está bien construido contra el SDK real, pero **no** que una petición real de ida y vuelta funcione.

### Solución: comando de prueba de conexión real

Se agregó `npm run atlas -- agentes probar`, que manda una petición mínima y barata a cada proveedor configurado y confirma si respondió de verdad — nunca imprime la clave, solo si la conexión funcionó:

```bash
# 1. Tú defines la clave en TU terminal (yo nunca la veo ni la toco)
export ANTHROPIC_API_KEY="tu-clave-aquí"

# 2. Corres la prueba real
npm run atlas -- agentes probar claude
```

Ya probado en este entorno con Ollama (el único disponible aquí):

```
🔌 PROBANDO CONEXIÓN REAL

  (petición mínima, no simulada — cuesta lo mínimo posible en los de pago)

  ✅ ollama   respondió en 26331ms
  ⬜ claude   sin configurar, se salta
  ⬜ chatgpt  sin configurar, se salta
```

Esa fue una respuesta **real** de Ollama, no simulada — confirma que el mecanismo de prueba funciona de extremo a extremo.

---

## 4.1 Actualización: Claude verificado con una respuesta real (25 de septiembre)

Después de la entrega inicial, tú mismo configuraste `ANTHROPIC_API_KEY` en tu terminal y corriste la prueba. Resultado final, ya con la clave correcta:

```
🔌 PROBANDO CONEXIÓN REAL

  (petición mínima, no simulada — cuesta lo mínimo posible en los de pago)

  ✅ claude   respondió en 1134ms
```

Esto **no es una simulación ni una suposición**: es una respuesta HTTP 200 real de la API de Anthropic, con un modelo `claude-opus-5` real contestando. La cadena completa está confirmada:

```
Atlas → src/proveedores/claude.ts → SDK oficial de Anthropic → API real → respuesta real
```

### El camino hasta llegar ahí (con lecciones útiles)

No fue automático — hubo tres intentos fallidos, cada uno con una causa distinta, y sirve dejarlos documentados porque son errores comunes que te pueden volver a pasar con cualquier otra clave de API en el futuro:

| Intento | Qué pasó | Causa real |
|---|---|---|
| 1º | `npm error ENOENT ... package.json` | Se corrió el comando fuera de la carpeta `~/atlas` |
| 2º | "Clave inválida o ausente" | Se pegó literalmente el texto de ejemplo `"tu-clave-aquí"`, no una clave real |
| 3º | Mismo error, con clave real | El `export` se corrió en una terminal distinta a donde se ejecutó `npm run atlas` — cada ventana de terminal tiene su propia memoria de variables |
| 4º | Mismo error otra vez, en la misma terminal | La clave se copió incompleta: quedó en solo 23 caracteres en vez de ~109 |
| 5º | `curl` directo a Anthropic → `"API key is invalid"` | Confirmó que el problema no era el código de Atlas, sino el valor exacto de la clave (corrupción al copiar/pegar) |
| 6º ✅ | `curl` respondió con un mensaje real de Claude | Clave copiada de nuevo con el botón de copiar de la consola, largo correcto (109), en la misma terminal |

### ⚠️ Incidente de seguridad durante la prueba (resuelto)

Tres veces, sin querer, apareció un fragmento o el valor completo de una clave real de Anthropic pegado en la conversación (al copiar salida de terminal que incluía el comando `export` de arriba, o el historial de scroll). Cada vez que se detectó:

1. Se te avisó de inmediato, antes de continuar con cualquier otra cosa
2. Nunca se usó, escribió, ni reenvió esa clave desde este lado
3. Se te pidió confirmar que la revocabas en https://console.anthropic.com/settings/keys y crearas una nueva
4. Solo se siguió adelante después de tu confirmación explícita

**Estado final: las claves expuestas fueron revocadas por ti; la clave activa ahora nunca apareció en esta conversación.**

**Para que no se repita:** usa siempre el botón de copiar (📋) de la consola en vez de seleccionar texto a mano, y antes de pegarme cualquier salida de terminal, revisa que no aparezca `sk-ant-` ni `sk-` en ningún lado.

---

## 5. Estado general del proyecto tras esta entrega

| Métrica | Valor |
|---|---|
| Líneas de código en `src/` | 6,397 |
| Archivos de código | 30 |
| Archivos de pruebas | 16 |
| Tests totales | 203 |
| Tests pasando | 203 (100%) |
| Proveedores de IA | 3 (Ollama, Claude, ChatGPT) |
| Commits en esta sesión | 4 (`b016074`, `cc02805`, `5bba6c7`, y este) |

---

## 6. Qué se confirmó y qué sigue pendiente

**Confirmado con evidencia real:**
- ✅ Ollama responde de verdad (local, gratis, probado)
- ✅ Claude responde de verdad (`claude-opus-5`, 1134ms, probado con tu clave)
- ⬜ ChatGPT — el código está verificado igual que Claude (§3), pero no se probó con una clave real de OpenAI en esta sesión. Mismo comando cuando quieras: `npm run atlas -- agentes probar chatgpt`

**Qué NO se hizo (para que no haya sorpresas):**
- No se gastó dinero en Claude/ChatGPT más allá de la prueba mínima real que tú autorizaste al correr el comando
- En ningún momento entré, pedí ni escribí una clave de API — cuando aparecieron expuestas por accidente en el chat, se señalaron y se te pidió rotarlas, nunca se usaron
- No se implementó todavía el módulo de "empresa simulada" de Atlas Business OS (nómina, facturación, inventario) — eso sigue pendiente, es un proyecto separado que reusa este mismo núcleo cuando se decida arrancarlo
- La revisión de 5 copias en paralelo planeada originalmente se cortó por límite de la API; se sustituyó por verificación manual del código (§3) más la prueba real de conexión (§4.1), que en conjunto cubren tanto "el código está bien escrito" como "funciona de verdad"
