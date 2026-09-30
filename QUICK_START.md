# 🚀 QUICK START — ATLAS SETUP AUTOMATION

## TL;DR — En 30 segundos

```bash
bash .claude/setup-automation.sh
```

**Eso es todo.** El script instala y verifica FASES 0-8 automáticamente.

---

## ✅ Qué hace el script

Instala y verifica:

| Componente | Estado |
|---|---|
| **Node.js, npm, git** | ✅ Verificado |
| **TypeScript + LSP** | ✅ Instalado |
| **Code Review** | ✅ Activo |
| **Seguridad** | ✅ Activa |
| **Frontend Tools** | ✅ Activos |
| **Modo Educativo** | ✅ Activo |
| **Git Safety** | ✅ Activa |
| **Tests (844)** | ✅ PASS/FAIL |
| **Infraestructura Histórica** | ✅ Lista |

---

## 📋 Opciones de Ejecución

### 1. Instalación Completa (Defecto)
```bash
bash .claude/setup-automation.sh
```

### 2. Rango de Fases
```bash
# Fases 0-5
bash .claude/setup-automation.sh 0 5

# Solo Fase 1
bash .claude/setup-automation.sh 1 1

# Fases 5-8
bash .claude/setup-automation.sh 5 8
```

### 3. Script TypeScript Avanzado
```bash
npm install -g ts-node typescript
npx ts-node .claude/setup-automation.ts
```

---

## 📈 Output Esperado

```
╔════════════════════════════════════════════════════════════╗
║     ATLAS CLAUDE CODE SETUP AUTOMATION                     ║
║     Instalando FASES 0-8                                   ║
╚════════════════════════════════════════════════════════════╝

✅ FASE 0 — DIAGNÓSTICO
✅ FASE 1 — TYPESCRIPT
✅ FASES 2-7 — CONFIGURACIÓN
✅ PHASE 3B — HISTÓRICOS
✅ VERIFICACIÓN FINAL

╔════════════════════════════════════════════════════════════╗
║     ✅ SETUP COMPLETADO EXITOSAMENTE                       ║
╚════════════════════════════════════════════════════════════╝

Próximos pasos:
  1. Leer: .claude/skills-enabled.md
  2. Usar: /code-review medium
  3. Tests: npm run prueba
```

---

## 🔍 Verificación Post-Setup

```bash
# Ver logs
tail -20 .claude/setup-automation.log

# Ver reporte
cat SETUP_AUTOMATION_REPORT.md

# Ejecutar tests
npm run prueba

# Verificar TypeScript
tsc --version

# Revisar configuración
cat .claude/settings.json
```

---

## 📚 Documentación

| Archivo | Propósito |
|---------|-----------|
| **AUTOMATION_GUIDE.md** | Guía detallada |
| **AUTOMATION_COMPLETE.md** | Reporte completo |
| **QUICK_START.md** | Este archivo |
| **.claude/AUTOMATION_GUIDE.md** | Guía técnica |
| **.claude/settings.json** | Configuración |
| **.claude/skills-enabled.md** | Skills activos |
| **CLAUDE.md** | Reglas del proyecto |

---

## 🎯 Próximas Acciones

Después del setup:

```bash
# 1. Revisar código
/code-review medium

# 2. Hacer un commit
/commit

# 3. Ver panel frontend
npm run panel

# 4. Leer guía de skills
cat .claude/skills-enabled.md
```

---

## ❌ Si algo falla

1. **Leer logs:**
   ```bash
   cat .claude/setup-automation.log | grep "❌"
   ```

2. **Verificar reporte:**
   ```bash
   cat SETUP_AUTOMATION_REPORT.md
   ```

3. **Intentar manualmente:**
   ```bash
   npm install -g typescript
   tsc --version
   ```

4. **Necesitas ayuda:**
   - Ver `.claude/AUTOMATION_GUIDE.md`
   - Ver `AUTOMATION_COMPLETE.md`
   - Ver `CLAUDE.md` (reglas del proyecto)

---

## 💡 Tips

- ✅ El script es **idempotente** (seguro ejecutar múltiples veces)
- ✅ Los logs se guardan en `.claude/setup-automation.log`
- ✅ El reporte se genera en `SETUP_AUTOMATION_REPORT.md`
- ✅ Puedes interrumpir con Ctrl+C (no romperá nada)
- ✅ No modifica código fuente, solo configuración

---

**Status:** ✅ **READY_TO_USE**

¡Ejecuta el script y disfruta de Atlas completamente configurado!
