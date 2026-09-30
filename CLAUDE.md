# CLAUDE.md — Configuración de Trabajo para Atlas

## Objetivo del Proyecto

**Atlas** es un asistente autónomo educativo y supervisado que:

- Enseña programación desde cero mediante ejercicios prácticos
- Ejecuta simulaciones empresariales y de trading
- Desarrolla y prueba estrategias de trading en entornos simulados
- Aprende y mejora mediante experiencias
- Funciona localmente sin conexión constante a internet

## Estructura del Proyecto

```
atlas/
├── src/
│   ├── atlas.ts              # CLI principal
│   ├── api-local/            # API local + panel web
│   ├── bots.ts               # Sistema de bots
│   ├── competencia.ts        # Competencia usuario vs bots
│   ├── evolucion-bots.ts     # Evolución genética de bots
│   ├── memoria.ts            # Persistencia de datos
│   ├── business-lab/         # Simulador empresarial
│   ├── empresa-simulator/    # Motor de empresa
│   └── [otros módulos]
├── pruebas/                  # Tests con Node test runner
├── docs/                     # Documentación
├── datos/                    # Datos persistentes
└── .claude/                  # Configuración de Claude Code
```

## Lenguaje y Stack

- **Lenguaje:** TypeScript + Node.js 22+
- **Module System:** ESM (type: "module")
- **Testing:** Node built-in test runner
- **SDKs:** Anthropic SDK, OpenAI SDK
- **DB:** SQLite (better-sqlite3)
- **Frontend:** HTML/CSS/JS local

## Comandos Principales

```bash
npm run atlas              # Ejecutar CLI de Atlas
npm run prueba             # Ejecutar todos los tests
npm run auditar            # Auditar el sistema
npm run memoria            # Gestionar memoria
npm run panel              # Iniciar panel web local
npm run forex:lab          # Lab de trading forex
npm run forex:status       # Ver estado de trading
```

## Reglas de Desarrollo

### ✅ PERMITIDO

- Modificar código TypeScript
- Crear nuevas funciones
- Refactorizar
- Agregar tests
- Hacer commits con mensajes claros
- Revisar seguridad
- Ejecutar pruebas

### ❌ PROHIBIDO INICIALMENTE

- Conectar a cuentas de trading reales
- Ejecutar operaciones financieras reales
- Exposición de API keys, tokens, contraseñas
- `git push` sin revisión explícita
- `git reset --hard` sin confirmación
- Modificar sin explicar cambios

### ⚠️ REQUIERE CONFIRMACIÓN

- Instalar dependencias nuevas
- Modificar archivos de configuración críticos
- Cambios en módulos de trading
- Borrar código existente
- Force push a git

## Convenciones de Código

- **Idioma:** Español en comentarios y documentación
- **Nombrado:** camelCase para variables/funciones, PascalCase para clases
- **Imports:** ESM (import/export)
- **Tipos:** TypeScript strict
- **Tests:** Cambios importantes requieren tests nuevos
- **Commits:** Mensajes en español, breves y descriptivos

## Seguridad

### Datos Sensibles

**NUNCA exponer:**
```
- API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY)
- Contraseñas
- Tokens de acceso
- Credenciales de trading
- Archivos .env
```

### Validación

- Validar inputs de usuario
- Prevenir SQL injection (mejor-sqlite3 tiene parametrización)
- No exponer rutas internas en errores
- Logs sin información sensible

## Trading — Restricciones

### Inicialmente (FASE 13)

- ✅ Backtesting en datos históricos
- ✅ Simulaciones con dinero ficticio
- ✅ Paper trading
- ✅ MT5 DEMO (demostración)
- ❌ MT5 LIVE
- ❌ Dinero real
- ❌ Retiros
- ❌ Depósitos

## Flujo de Trabajo Recomendado

```
1. Revisar tarea/requisito
2. Diseñar solución
3. Implementar en rama
4. Tests pasan
5. Security review
6. Code review
7. Commit con mensaje claro
8. PR (si aplica)
```

## TypeScript Configuration

El proyecto usa Node experimental strip-types:
```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning src/atlas.ts
```

No requiere compilación explícita (`tsc`).

## Testing

```bash
npm run prueba    # Ejecutar todos los tests
```

Tests usan Node.js built-in test runner (no jest, no mocha).

## Documentación

- `ESTADO.md` — Estado actual del proyecto
- `GUIA_ARQUITECTURA.md` — Arquitectura general
- `GUIA_DESARROLLO.md` — Guía de desarrollo
- `docs/` — Documentación adicional

## Agentes Disponibles (FASE 10)

Cuando se creen, tendrán roles específicos:
- **architect** — Diseño de arquitectura
- **programmer** — Implementación
- **reviewer** — Revisión de código
- **tester** — Tests y QA
- **security** — Análisis de seguridad
- **professor** — Enseñanza de conceptos
- **trading-researcher** — Investigación de estrategias
- **risk-manager** — Evaluación de riesgo
- **business-analyst** — Análisis empresarial

## Próximas Fases

1. ✅ FASE 0: Diagnóstico ✓
2. ⏳ FASE 1: TypeScript LSP (en progreso)
3. ⏳ FASE 2: Seguridad
4. ⏳ FASE 3-16: Según plan

---

**Última actualización:** 2026-09-26  
**Versión:** 0.1  
**Autor:** Luis Ángel (con Claude Haiku 4.5)
