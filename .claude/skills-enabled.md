# SKILLS HABILITADOS — FASES 2-7

**Última actualización:** 2026-09-26  
**Estado:** Todas las fases activas

---

## FASE 2 — SEGURIDAD

### Skills/Capacidades Habilitadas

| Skill | Función | Estado |
|-------|---------|--------|
| `code-review` | Análisis de seguridad + correctness | ✅ ACTIVO |
| Secret Detection | Detectar API keys, tokens, credenciales | ✅ ACTIVO |
| Dependency Check | Auditar vulnerabilidades en dependencias | ✅ ACTIVO |
| OWASP Top 10 | Validar contra Top 10 OWASP | ✅ ACTIVO |

### Uso
```bash
/code-review medium    # Revisar código con enfoque seguridad
```

### Lo que hace
- Detecta secrets expuestos (API keys, passwords, tokens)
- Valida SQL injection, XSS, command injection
- Audita dependencias de vulnerabilidades
- Revisa OWASP Top 10

---

## FASE 3 — DESARROLLO DE FUNCIONES

### Skills/Capacidades Habilitadas

| Skill | Función | Estado |
|-------|---------|--------|
| `engineering:debug` | Debugging y troubleshooting | ✅ ACTIVO |
| `engineering:documentation` | Generación automática de docs | ✅ ACTIVO |
| Testing Strategy | Diseño de tests | ✅ ACTIVO |

### Uso
```bash
npm run prueba              # Ejecutar tests
claude debug <archivo.ts>   # Debug de módulo
```

### Lo que hace
- Ayuda a debuguear errores de runtime
- Genera documentación automática
- Propone estrategias de testing

---

## FASE 4 — FRONTEND DESIGN

### Skills/Capacidades Habilitadas

| Skill | Función | Estado |
|-------|---------|--------|
| `design:design-critique` | Crítica de diseño | ✅ ACTIVO |
| Accessibility Checks | Validar accesibilidad (a11y) | ✅ ACTIVO |
| Responsive Design | Verificar mobile/tablet/desktop | ✅ ACTIVO |
| `artifact-design` | Diseño de interfaces (HTML/CSS) | ✅ ACTIVO |

### Uso
```bash
/design:design-critique        # Revisar UX/UI
npm run panel                  # Ver panel frontend
```

### Lo que hace
- Revisa diseños contra mejores prácticas
- Valida accesibilidad (WCAG 2.1)
- Verifica diseño responsive
- Genera interfaces en artifacts

---

## FASE 5 — CLAUDE COMO PROFESOR

### Skills/Capacidades Habilitadas

| Capacidad | Función | Estado |
|-----------|---------|--------|
| Explanatory Mode | Explicaciones detalladas | ✅ ACTIVO |
| Educational Output | Modo pedagógico | ✅ ACTIVO |
| Verbose Explanations | Explicaciones extensas | ✅ ACTIVO |
| Example Code | Código de ejemplo comentado | ✅ ACTIVO |

### Configuración
```json
{
  "education": {
    "explanatoryMode": true,
    "teachConcepts": true,
    "verboseOutput": true,
    "exampleCode": true
  }
}
```

### Lo que hace
- Explica el **por qué** además del **qué**
- Enseña conceptos de programación
- Proporciona código comentado
- Detalla procesos complejos

---

## FASE 6 — GIT & COMMITS

### Skills/Capacidades Habilitadas

| Skill | Función | Estado |
|-------|---------|--------|
| `commit-commands:commit` | Asistente de commits | ✅ ACTIVO |
| Branch Protection | Proteger ramas importantes | ✅ ACTIVO |
| Commit Validation | Validar mensaje de commit | ✅ ACTIVO |

### Uso
```bash
/commit                    # Asistente interactivo
git status                 # Ver cambios
git diff                   # Ver diferencias
```

### Configuración
```json
{
  "git": {
    "requireCommitMessage": true,
    "allowForcePush": false,
    "confirmDestructive": true,
    "protectedBranches": ["main", "master"]
  }
}
```

### Lo que hace
- Ayuda a redactar commits significativos
- Valida mensaje de commit (no vacío)
- Previene force push a ramas protegidas
- Requiere confirmación para operaciones destructivas

---

## FASE 7 — CODE REVIEW

### Skills/Capacidades Habilitadas

| Skill | Función | Estado |
|-------|---------|--------|
| `code-review` | Revisión completa de código | ✅ ACTIVO |
| `qodo:qodo-review` | Revisión con QA | ✅ ACTIVO |
| Correctness Check | Validar lógica | ✅ ACTIVO |
| Cleanup Analysis | Detectar código innecesario | ✅ ACTIVO |
| Efficiency Review | Optimización de performance | ✅ ACTIVO |

### Uso
```bash
/code-review low              # Mínimo detalle
/code-review medium           # Estándar (recomendado)
/code-review high             # Profundo
/code-review ultra            # Multi-agente cloud (pagado)
```

### Ángulos de Revisión
1. **Correctness** (bugs, lógica)
2. **Cleanup** (refactoring, DRY)
3. **Efficiency** (performance, I/O)
4. **Reuse** (reutilizar código existente)
5. **Simplification** (reducir complejidad)
6. **Altitude** (soluciones correctas)
7. **Conventions** (CLAUDE.md rules)

### Lo que hace
- Detecta bugs antes de producción
- Sugiere mejoras de código
- Optimiza performance
- Valida convenciones del proyecto

---

## CÓMO USAR ESTOS SKILLS

### Para cada fase:

**FASE 2 (Seguridad):**
```bash
# Revisar cambios antes de commit
/code-review medium

# Buscar secrets en código
grep -r "password\|API_KEY\|token" src/
```

**FASE 3 (Desarrollo):**
```bash
# Ejecutar tests
npm run prueba

# Debug de módulo
node --inspect src/modulo.ts
```

**FASE 4 (Frontend):**
```bash
# Iniciar panel
npm run panel

# Revisar diseño
/design:design-critique
```

**FASE 5 (Profesor):**
- Pregunta "¿por qué...?" y Claude explicará
- Usa modo educativo para aprender conceptos
- Solicita "código comentado" para ejemplos

**FASE 6 (Git):**
```bash
# Asistente de commits
/commit

# Ver cambios
git diff
```

**FASE 7 (Code Review):**
```bash
# Revisión antes de merge
/code-review medium

# Después de fixes
/code-review medium --comment   # Comentar en PR si aplica
```

---

## RESUMEN

| Fase | Skill Principal | Uso | Status |
|------|---|---|---|
| 1 | typescript-lsp | `tsc --noEmit` | ✅ |
| 2 | code-review (security) | `/code-review medium` | ✅ |
| 3 | engineering:debug | `npm run prueba` | ✅ |
| 4 | design:design-critique | `npm run panel` | ✅ |
| 5 | educativo | Preguntar y enseñar | ✅ |
| 6 | commit-commands | `/commit` | ✅ |
| 7 | code-review (full) | `/code-review medium/high` | ✅ |

---

**Todas las FASES 1-7 están ACTIVAS Y LISTAS para usar.**

Puedes comenzar con cualquiera de ellas en tu próximo request.
