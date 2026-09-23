# Atlas — Estado del proyecto

**Fecha:** 23 de septiembre de 2026
**Versión del código:** V0.6.1 (núcleo educativo, producción) + V0.8 (trading educativo, CLI integrada)
**Ubicación:** `~/atlas` en tu Pop!_OS
**Pruebas:** 147 de 147 pasan, ninguna necesita Ollama encendido
**Líneas de código:** 5,537 en `src/` (11 módulos nuevos de V0.8 suman ~2,983 líneas)

---

## 1. Qué es Atlas, en una frase

Un asistente que corre en tu máquina, local por defecto, que te enseña a programar. **No puede actuar fuera de sus capacidades y permisos; todas sus acciones quedan registradas.** Todo lo demás es consecuencia de eso.

---

## 2. Las dos mitades del proyecto

| Mitad | Qué es | Dónde está | Estado |
|---|---|---|---|
| **Diseño** | Documento maestro en español + narración en audio | `Atlas_V0.1_Documento_Maestro.md`, `Atlas_V0.1_Guion_de_Audio.md`, `Atlas_V0.1_Narracion.mp3` | Completo hasta el Anexo 1. **Le faltan** los módulos de código recientes (profesor, evaluación). |
| **Código** | TypeScript sobre Node 22, cero dependencias | `~/atlas` | V0.6 funcionando |

---

## 3. El diseño — módulos escritos

| Módulo | Tema | Lo esencial |
|---|---|---|
| — | Propósito, 7 principios, 6 componentes, 3 entornos, 10 límites | La base |
| **A** | Supervisor | Tres niveles: verde (adelante), amarillo (pide permiso), rojo (nunca). 1 tarea activa, 20 acciones, 30 min, presupuesto 0, sin Internet, 3 errores seguidos, apagado de emergencia. |
| **B** | Laboratorio de simulación | Recursos ficticios. 6 requisitos para avanzar. **Una ganancia simulada obtenida rompiendo reglas cuenta como fracaso.** |
| **C** | Ciclo central | recibir → comprender → consultar memoria → planear → revisar seguridad → actuar → observar → verificar → aprender → terminar |
| **D** | Sistema de herramientas | Ficha obligatoria por herramienta: qué hace, qué recibe, qué devuelve, qué puede romper |
| **E** | Sección de estudios | Dos rutas (programación y trading educativo), sesión combinada |
| **F** | Interfaz | 8 secciones, tarjetas de aprobación, 3 modos de audio |
| **G** | Objetivos y planificación | objetivo → tarea → paso. 10 etapas. Estimaciones en rangos, nunca en un número. |
| **H** | Comparación Atlas ↔ Automaton | Qué adoptamos, qué adaptamos, qué aplazamos. Costos. |
| **I** | Registro y auditoría | Solo-agregado, 12 campos por evento, huellas encadenadas, 3 registros separados |
| **Anexo 1** | Tu equipo | Ryzen 7 5700U (8 núcleos / 16 hilos), 30 GiB RAM, gráficos integrados, 460 GB, Pop!_OS 24.04. Medido: **3.86 tokens/s** con el 14B en CPU. |

---

## 4. El código — qué hay construido

`~/atlas`, 3 768 líneas, **cero dependencias de npm**. Corre con `node --experimental-strip-types`: sin `tsc`, sin `npm install`, sin paso de compilación.

### Los módulos, en orden de importancia

**`src/registro.ts` — el cimiento (148 líneas)**
Cada evento lleva la huella SHA-256 del anterior. Cambiar un evento viejo rompe toda la cadena a partir de ahí, y `auditar()` lo detecta. La garantía no está en una regla: **no existe ninguna función que borre o edite un evento.** Esa ausencia *es* la garantía.

**`src/supervisor.ts` — la única puerta (156 líneas)**
Nada escribe en el registro sin pasar por aquí. Reglas rojas (`sudo`, `rm -rf`, `mkfs`, claves, transferencias) y detección de secretos. Distingue **acción de dato**: las reglas de acción se aplican a la descripción, la herramienta y la ruta; al contenido solo se le buscan secretos. Sin esa separación, una lección que mencionara la palabra "contraseña" quedaba bloqueada.

**`src/herramientas.ts` — las 4 capacidades (100 líneas)**
`escribir_archivo`, `agregar_archivo`, `leer_archivo`, `listar_carpeta`. Todas encerradas por `rutaSegura()`: cualquier ruta que salga de `laboratorio/` se rechaza antes de tocar el disco.

**`src/verificacion.ts` — comprobar, no creer (187 líneas)**
Tipos de comprobación: `existe`, `min_bytes`, `contiene`, `no_contiene`, `min_lineas`, `sin_solucion`. Se ejecutan contra el disco real.

**`src/estandares.ts` — la vara que el modelo no negocia (76 líneas)**
Para una lección exige: ≥20 líneas, al menos un ejemplo de código, una sección `## Ejercicio`, **que el ejercicio no venga resuelto**, y que no mande a usar `tsc` ni `npm install -g`.

**`src/modelo.ts` — Ollama (194 líneas)**
Streaming NDJSON con `format: 'json'`. El streaming no fue capricho: a 3.86 tokens/s, una respuesta larga tardaba más de los 300 s que aguanta el cliente HTTP de Node, y fallaba siempre a los 5 min 1 s.

**`src/ciclo.ts` — el ciclo completo (489 líneas)**
Planear → revisar → ejecutar → verificar → aprender. Incluye reintento cuando la respuesta viene cortada, y `perseguir()`, que aprende del rechazo en vez de repetir el mismo plan.

**`src/memoria.ts` — SQLite integrado (233 líneas)**
Cinco espacios: personal, programación, trading, simulaciones, sistema. Un dato nuevo **supera** al viejo, no lo borra. Olvidar es una orden explícita tuya y queda registrada.

**`src/curso.ts` — el profesor (208 líneas)**
14 temas con requisitos entre ellos. Cuatro estados: `pendiente → material → practicado → dominado`. Repasos a 1, 3, 7, 14 y 30 días.

**`src/evaluacion.ts` — el evaluador (207 líneas)**
Ejecuta tu ejercicio de verdad (`spawnSync`, 10 s de tope) y además le pide opinión al modelo. **Si los dos discrepan, manda el hecho duro:** si corre, corre.

**`src/atlas.ts` — la línea de comandos (433 líneas)**
Comandos del núcleo educativo: `estudiar`, `responder`, `evaluar`, `practique`, `progreso`, `objetivo`, `auditar`, `anotar`, `permiso`, `ver`, `memoria`, `olvidar`, `exportar`, `limites`. Delega los comandos de V0.8 a `cli-v08.ts` en vez de crecer con lógica de negocio ajena (regla de modularización, ver `GUIA_ARQUITECTURA.md`).

---

## 4.1 V0.8 — Trading educativo y competencia Tú vs Atlas

Sistema completo de simulación: Atlas divide 100 unidades de energía diaria entre estudiar, minar y tradear, ejecuta bots autónomos con dinero ficticio, y compite contra tus operaciones manuales en tiempo real. **Dinero 100% simulado por diseño** — no mueve fondos reales.

| Módulo | Responsabilidad |
|---|---|
| `src/energia.ts` | Reparto y consumo de las 100 unidades diarias |
| `src/mineria.ts` | Motor de minería simulado (ETH ficticio, dificultad tope 5x) |
| `src/trading.ts` | Motor base de compra/venta, portafolios, PnL |
| `src/precios-realtime.ts` | Precios reales vía CoinGecko, con fallback simulado |
| `src/bots.ts` | Bots autónomos: DCA, momentum, mean-reversion, buy-and-hold |
| `src/competencia.ts` | Snapshots y estadísticas Tú vs Atlas |
| `src/evolucion-bots.ts` | Aprende de errores de los bots y genera versiones mejoradas |
| `src/orquestador-v08.ts` | Une todo en un solo ciclo (`ejecutar_ciclo()`) |
| `src/persistencia.ts` | Snapshot de estado en `datos/atlas-state.json`, sobrevive reinicios |
| `src/respaldo.ts` | Respaldo seguro de SQLite (backup nativo, retención de 7) |
| `src/cli-v08.ts` | Comandos: `minar`, `bots`, `competencia`, `ciclo`, `estado`, `respaldo` |

**Auditoría:** 8 bugs encontrados y corregidos (3 críticos: ganancia siempre 0 en ventas, método inexistente en orquestador, win_rate falso; ver `ANALISIS_FINAL_AUDITORIA.md`).

**Pendiente:** interfaz de motor de minería adaptable a hardware real (diseño ya documentado en `V0.8_ARQUITECTURA_COMPETENCIA.md § 2`, no implementado).

---

## 5. Los laboratorios y las pruebas

### Pruebas automáticas — 147, todas pasan

| Archivo | Pruebas | Qué defiende |
|---|---|---|
| `prueba-registro.ts` | 8 | Que la cadena de huellas detecte cualquier alteración |
| `prueba-ciclo.ts` | 36 | Que el Supervisor no deje pasar lo rojo y no bloquee lo inocente |
| `prueba-json.ts` | 8 | Que una respuesta cortada del modelo se recupere |
| `prueba-memoria.ts` | 17 | Que un dato nuevo supere al viejo sin borrarlo |
| `prueba-curso.ts` | 16 | Que generar material no cuente como aprender |
| `prueba-evaluacion.ts` | 19 | Que el hecho duro gane a la opinión del modelo |
| `prueba-trading.ts`, `prueba-bots.ts`, `prueba-competencia.ts`, `prueba-orquestador.ts`, `prueba-evolucion.ts`, `prueba-cli-v08.ts` | 43 | Que el trading educativo, los bots y la competencia calculen ganancia real (no siempre 0) |
| `prueba-persistencia.ts` | 4 | Que el estado sobreviva a un reinicio del proceso |
| `prueba-respaldo.ts` | 5 | Que el respaldo no corrompa la DB y respete la retención |

Ninguna necesita Ollama: el generador de texto se inyecta como dependencia. Por eso puedes correr `npm run prueba` en el trabajo, sin encender el modelo.

Las cuatro pruebas que más peso cargan, por su nombre:

- `GENERAR MATERIAL NO CUENTA COMO APRENDER`
- `DOS PRÁCTICAS EL MISMO DÍA NO SON DOMINIO`
- `UN TEMA NO SE ABRE SIN SUS REQUISITOS`
- `un permiso negado también queda registrado`

### Laboratorio de ejecución

`~/atlas/laboratorio/` — la única carpeta donde Atlas puede escribir. Ahora mismo está vacía salvo la lección de terminal que generó. Todo lo que produzca cae aquí y nada sale de aquí.

### Pruebas vividas (las que corriste tú)

| Prueba | Resultado |
|---|---|
| Cadena de huellas contra una edición manual | Detectada |
| Ruta que intenta salir del laboratorio | Rechazada |
| Generar la lección de `terminal` con el 14B | Salió bien a la primera |
| Lección sin solución regalada | Se cumple, ya verificado |
| Lección que no mencione `tsc` | Se cumple, tras tres intentos fallidos |
| Respuesta del modelo cortada a media frase | Recuperada |

---

## 6. Dónde nos quedamos exactamente

**Cambio hecho esta sesión (V0.6.1):**

El tema `terminal` enseña comandos reales (cd, ls, pwd, mkdir, cat, rutas) y los ejercicios se responden en la terminal real. El evaluador no los ejecuta: Atlas revisa la respuesta a mano mediante el modelo. Si quieres demostrar que los entiendes, ejecutas los comandos tú en tu terminal.

Se agregó un **tema nuevo `filesystem`** con requisito `terminal`. Este tema sí usa TypeScript:
- Enseña `mkdirSync`, `writeFileSync`, `readFileSync`, `readdirSync`.
- Ejercicios ejecutables que Atlas puede verificar de verdad.
- Es el puente natural desde terminal hasta temas más avanzados.

**Temario ahora (orden de desbloques):**

1. `terminal` (nivel 1, sin requisitos) — lección y ejercicio en shell real
2. `filesystem` (nivel 1, requiere `terminal`) — mismo concepto en TypeScript/Node
3. `variables` (nivel 1, sin requisitos) — const, let, tipos
4. `condiciones` → `bucles` → `funciones` → `arrays` → `objetos` → `modulos` → `errores` → `asincronia` → `archivos-avanzado` → `pruebas` → `sqlite` → `atlas`

**Te toca a ti ahora:** volver a generar la lección de `terminal` (la anterior se hizo antes de estos cambios). Corre:

```
npm run atlas -- estudiar
```

---

## 7. La lección más importante del proyecto

Cinco veces seguidas, lo que parecía un fallo del modelo resultó ser una **contradicción en mis propias instrucciones**:

- una regla contra el estándar
- el estándar por archivo contra el reparto en varios pasos
- el Supervisor confundiendo acción con dato
- dos jueces midiendo el mismo tamaño
- "lección de TypeScript sobre la terminal" empujando a hablar de compilar

De ahí salió el principio que ahora gobierna todo:

> **Decirle algo al modelo no es hacerlo cumplir. Solo una comprobación ejecutada lo es.**

Cuando quiero que Atlas garantice algo, la pregunta ya no es "¿se lo dije?" sino "¿puedo verificarlo?". Si no puedo, es una esperanza, no una garantía.

---

## 8. Lo que sigue

**V0.6.1 — completado**

1. ✅ Separar terminal (shell) de filesystem (TypeScript)
2. ✅ Documentar que el evaluador no tiene sandboxing completo (el código puede acceder a red, FS)

**V0.8 — completado (CLI integrada, 147 tests)**

1. ✅ Energía, minería simulada, bots autónomos, competencia Tú vs Atlas
2. ✅ Auditoría exhaustiva: 8 bugs encontrados y corregidos
3. ✅ CLI integrada (`minar`, `bots`, `competencia`, `ciclo`, `estado`)
4. ✅ Persistencia de estado (`datos/atlas-state.json`)
5. ✅ Respaldo automático de SQLite + guía de Cloudflare Tunnel
6. ⏳ Motor de minería adaptable a hardware real (diseñado, no implementado)

**Después (ruta de versiones)**

- V0.7 — planificador y tareas locales programadas
- V0.9 — interfaz web/móvil + audio + motor de minería adaptable a hardware real
- V1.0 — asistente local supervisado estable
- chattr +a sobre el registro (blindaje a nivel de sistema de archivos)

---

## 9. Reglas del proyecto que siguen en pie

- Nunca guardar contraseñas, claves privadas, tokens, códigos temporales ni datos bancarios completos — ni en el registro ni en la memoria
- Atlas confinado a `laboratorio/`
- Sin `sudo`, sin dinero real, sin autorreplicación, sin Internet en V0.1
- Las acciones amarillas requieren tu aprobación
- Un permiso negado se registra igual que uno concedido
- Un resumen nunca sustituye al registro
- Olvidar es una orden explícita tuya, y queda registrada
