# Guía de Usuario — Atlas V0.6.1

Atlas es un asistente que corre en tu máquina y te enseña a programar. Todo lo que hace queda registrado. No necesita Internet, no cuesta dinero, y no puede hacer nada fuera de sus capacidades y permisos.

## Requisitos

- Node.js 22 o superior
- Ollama corriendo (por defecto en `http://localhost:11434`)
- Modelo disponible (por defecto `qwen2.5-coder:14b`)

## Inicio rápido

```bash
cd ~/atlas
npm run atlas -- estudiar              # Qué toca hoy
npm run atlas -- responder terminal    # Crea plantilla de respuesta
npm run atlas -- evaluar terminal      # Evalúa tu solución
npm run atlas -- progreso              # Tu avance
```

---

## Comandos principales

### `estudiar` — Qué toca hoy

```bash
npm run atlas -- estudiar
```

**Qué hace:**
- Te dice qué tema practicar hoy
- Si hay repasos vencidos, los prioriza (lo ya aprendido se olvida si no repasas)
- Si hay material sin practicar, te lo recuerda
- Si es un tema nuevo, Atlas genera la lección con Ollama (tarda minutos)

**Estados de un tema:**
- `pendiente` — no has visto material
- `material` — Atlas creó la lección, tú no la practicaste
- `practicado` — hiciste el ejercicio una vez
- `dominado` — practicaste en dos días distintos

---

### `responder <tema>` — Crea tu plantilla

```bash
npm run atlas -- responder terminal
```

Crea `laboratorio/respuestas/terminal.ts` con el enunciado del ejercicio comentado. **Tú escribes ahí tu solución.**

---

### `evaluar <tema>` — Atlas revisa tu respuesta

```bash
npm run atlas -- evaluar terminal
```

**Qué pasa:**
1. Si tu código es `.ts` o `.js`: Atlas lo ejecuta (máx 10 segundos)
2. Atlas le pide al modelo que revise si resuelve el enunciado
3. Te muestra el resultado: ✅ APROBADO o ⚠️ No aprobado

**Si apruebas:**
- La práctica se registra automáticamente
- Próximo repaso programado (1, 3, 7, 14 o 30 días)
- Si practicaste en otro día, el tema pasa a "dominado"

**Si no apruebas:**
- Atlas te sugiere qué falta (si es hecho duro: no ejecuta; si es opinión: "cumple menos de lo que pide")
- Puedes corregir y evaluar de nuevo
- O usar `practique` si crees que Atlas se equivocó

---

### `progreso` — Tu avance

```bash
npm run atlas -- progreso
```

Muestra:
- Cuántos temas dominados, practicados, con material, pendientes
- Cuántos repasos vencidos hoy
- Lista de todos los temas por nivel

Ejemplo:
```
0 dominado(s) · 1 practicado(s) · 1 con material · 13 pendiente(s)
🔁 0 repaso(s) vencido(s)

── Nivel 1 ──
🏆 terminal      la terminal y el sistema de archivos  repaso 2026-09-24
📄 filesystem    archivos desde código TypeScript
   variables    variables y tipos básicos
...
```

---

### `objetivo "<descripción>"` — Planifica y ejecuta

```bash
npm run atlas -- objetivo "crear una función que sume dos números"
```

Atlas:
1. Entiende qué quieres hacer
2. Planifica pasos
3. Ejecuta cada paso (escribe código, crea archivos)
4. Verifica el resultado

**Usa esto para tareas fuera del temario, o para practicar objetivos propios.**

---

### `memoria [busca]` — Qué recuerda Atlas

```bash
npm run atlas -- memoria              # Resumen
npm run atlas -- memoria typescript   # Busca sobre TypeScript
```

Atlas recuerda:
- Lo que ya practicaste
- Lo que deduce sobre ti (con baja confianza)
- En 5 espacios separados: personal, programación, trading, simulaciones, sistema

Un resultado ficticio de trading NO se mezcla con operaciones reales.

---

### `olvidar <id>` — Ordena que olvide

```bash
npm run atlas -- olvidar 7
```

Borra un recuerdo específico. La orden queda registrada (no se puede borrar en silencio).

---

### `exportar` — Volca la memoria en JSON

```bash
npm run atlas -- exportar
```

Imprime toda tu memoria (prácticas, deducciones, fecha) en JSON limpio. Úsalo para respaldar o analizar.

---

### `auditar` — Verifica la cadena del registro

```bash
npm run atlas -- auditar
```

Comprueba que el registro (histórico de eventos) no ha sido alterado en silencio:
- Cada evento tiene la huella SHA-256 del anterior
- Si cambias una letra de un evento viejo, se detecta
- Si borras un evento del medio, se detecta

Ejemplo:
```bash
npm run atlas -- anotar "prueba"
sed -i '1s/prueba/otra cosa/' datos/registro.jsonl
npm run atlas -- auditar     # 🚨 detectado
```

---

### `ver [n]` — Últimos eventos

```bash
npm run atlas -- ver 20
```

Muestra los últimos 20 eventos del registro: qué hiciste, cuándo, con qué resultado.

---

### `practique <tema>` — Registra a mano

```bash
npm run atlas -- practique terminal
```

Si crees que Atlas se equivocó al evaluar, registra tú mismo que practicaste. La última palabra es tuya. Queda anotado que fuiste tú.

---

### `limites` — Límites de seguridad

```bash
npm run atlas -- limites
```

Muestra los límites que Atlas respeta:
- Acciones roja (nunca): `sudo`, `rm -rf`, `mkfs`, transferencias de dinero
- Acciones amarilla (con tu permiso): instalar, cambiar config
- Acciones verde (adelante): leer, escribir en laboratorio

---

### `anotar <texto>` — Evento manual

```bash
npm run atlas -- anotar "empecé a estudiar trading"
```

Escribe un evento en el registro. Queda registrado que lo escribiste tú, no Atlas.

---

## Flujo típico de aprendizaje

**Día 1:**
```bash
npm run atlas -- estudiar              # → "estudia terminal"
# Lees laboratorio/leccion-01.md
npm run atlas -- responder terminal    # Creas respuestas/terminal.ts
# Escribes tu solución
npm run atlas -- evaluar terminal      # ✅ APROBADO — practicado (1 vez)
```

**Día 2:**
```bash
npm run atlas -- estudiar              # → "repasa terminal" o "estudia filesystem"
# Si es repaso: relees y repites el ejercicio
# Si es nuevo tema: generas lección y ejercicio
npm run atlas -- responder filesystem
npm run atlas -- evaluar filesystem
```

**Después de 2 prácticas en días distintos:**
```bash
npm run atlas -- progreso              # 🏆 terminal: DOMINADO
```

---

## Configuración

### Cambiar modelo

```bash
ATLAS_MODELO=qwen2.5-coder:7b npm run atlas -- objetivo "..."
```

Por defecto: `qwen2.5-coder:14b` (más lento pero mejor).

### Ubicaciones

| Qué | Dónde |
|-----|-------|
| Lecciones | `laboratorio/leccion-01.md`, etc. |
| Tus respuestas | `laboratorio/respuestas/` |
| Registro de eventos | `datos/registro.jsonl` |
| Memoria SQLite | `datos/memoria.db` |
| Donde Atlas trabaja | `laboratorio/` (no puede salir) |

---

## Limitaciones honestas

**Atlas SÍ puede:**
- Registrar TODO lo que hace
- Ejecutar tu código (con tope de 10 segundos)
- Leer/escribir en `laboratorio/`
- Usar el modelo local para generar lecciones

**Atlas NO puede:**
- Usar `sudo` o comandos administrativos
- Transferir dinero real
- Acceder a la red (en V0.1)
- Salir de `laboratorio/`
- Borrar eventos del registro (solo agregar)

**Código que ejecutas:**
- Es TU código, en TU máquina
- Atlas lo ejecuta porque lo pediste
- Corre con máximo 10 segundos de timeout
- PERO: puede acceder a red, archivos fuera de laboratorio (es tu responsabilidad)

---

## Troubleshooting

**"Ollama no está corriendo"**
```bash
ollama serve          # En otra terminal
```

**"El modelo no está descargado"**
```bash
ollama pull qwen2.5-coder:14b
```

**"El ejercicio no se evalúa"**
- Verifica que está en `laboratorio/respuestas/<tema>.ts`
- Corre: `npm run atlas -- responder <tema>` primero
- El archivo debe tener TypeScript válido

**"Creo que Atlas se equivocó"**
```bash
npm run atlas -- practique <tema>    # Registra a mano
npm run atlas -- ver 10              # Revisa el evento
npm run atlas -- auditar             # Verifica cadena
```

---

## Próximos pasos

- **V0.7:** Planificador de tareas. Guardar objetivos, programar ejecución.
- **V0.8:** Simulador de trading educativo. Capital ficticio, órdenes sin dinero real.
- **V0.9:** Interfaz web. Dashboard, editor en navegador, copias de seguridad automáticas.
- **V1.0:** Asistente estable con documentación completa.
