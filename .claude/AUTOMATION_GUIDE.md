# GUÍA DE AUTOMATIZACIÓN — SETUP ATLAS

**Dos scripts para automatizar la instalación completa de FASES 0-8**

---

## OPCIÓN 1: BASH SCRIPT (Recomendado para principiantes)

### Ubicación
```
.claude/setup-automation.sh
```

### Uso

**Instalación completa (FASES 0-8):**
```bash
bash .claude/setup-automation.sh
```

**Rango específico (ej: FASES 0-5):**
```bash
bash .claude/setup-automation.sh 0 5
```

**Solo FASE 1:**
```bash
bash .claude/setup-automation.sh 1 1
```

### Output esperado
```
════════════════════════════════════════════════════════════
  FASE 0 — DIAGNÓSTICO DEL SISTEMA
════════════════════════════════════════════════════════════

ℹ️  Recolectando información del sistema...
✅ OS: Pop!_OS 24.04 LTS
✅ Node: v22.23.2
✅ npm: 10.9.8
✅ git: git version 2.43.0
✅ Python: Python 3.12.3
✅ Espacio disponible: 331G
✅ package.json encontrado
✅ Directorio src/ existe
✅ Tests: 844 PASS / 0 FAIL
✅ FASE 0 COMPLETADA

════════════════════════════════════════════════════════════
  FASE 1 — TYPESCRIPT + LSP
════════════════════════════════════════════════════════════

ℹ️  Instalando TypeScript globalmente...
✅ TypeScript: Version 7.0.2
✅ Language Server: 6.0.1
✅ TypeScript type checking OK
✅ FASE 1 COMPLETADA

... (más fases)

╔════════════════════════════════════════════════════════════╗
║     ✅ SETUP COMPLETADO EXITOSAMENTE                       ║
╚════════════════════════════════════════════════════════════╝
```

### Logs
El script guarda todos los detalles en:
```
.claude/setup-automation.log
```

### Reporte
Genera reporte en:
```
SETUP_AUTOMATION_REPORT.md
```

---

## OPCIÓN 2: TYPESCRIPT SCRIPT (Avanzado)

### Ubicación
```
.claude/setup-automation.ts
```

### Requisitos Previos
```bash
npm install -g ts-node typescript
```

### Uso

**Instalación completa:**
```bash
npx ts-node .claude/setup-automation.ts
```

**Rango específico:**
```bash
npx ts-node .claude/setup-automation.ts 0 5
```

### Ventajas
- Más validaciones detalladas
- Interfaz de color mejorada
- Mejor manejo de errores
- Salida JSON en reporte

### Output esperado
```
╔════════════════════════════════════════════════════════════╗
║           ATLAS SETUP AUTOMATION                           ║
║          Instalando todas las FASES                        ║
╚════════════════════════════════════════════════════════════╝

ℹ️  Ejecutando FASES 0 a 8...

════════════════════════════════════════════════════════════
  FASE 0 — DIAGNÓSTICO DEL SISTEMA
════════════════════════════════════════════════════════════

ℹ️  Verificar entorno y dependencias

✅ Node.js v22.23.2 detectado
✅ npm 10.9.8 detectado
✅ git version 2.43.0 detectado
✅ package.json encontrado
✅ 331G de espacio disponible
✅ Tests: 844 PASS / 0 FAIL

✅ FASE 0 COMPLETADA EN 12.34s
```

---

## COMPARACIÓN

| Característica | Bash | TypeScript |
|---|---|---|
| Requisitos | bash (built-in) | Node.js, TypeScript |
| Facilidad de uso | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Velocidad | Rápido | Más lento |
| Validaciones | Básicas | Detalladas |
| Colores | Sí | Sí (mejores) |
| Reporte | Markdown | Markdown + detalle |
| Para principiantes | ✅ Recomendado | Alternativa |
| Para automatización | ✅ Mejor | Mejor para CI/CD |

---

## QUÉ HACE CADA SCRIPT

### FASE 0 — DIAGNÓSTICO
Verifica:
- Sistema operativo
- Node.js, npm, git
- Python
- Espacio en disco
- Estructura del proyecto
- Tests baseline

### FASE 1 — TYPESCRIPT
Instala:
- TypeScript v7.0.2 (global)
- TypeScript Language Server v6.0.1
Verifica:
- Tipos sin errores
- LSP funcional

### FASES 2-7 — CONFIGURACIÓN
Crea:
- `.claude/` estructura
- `settings.json` v0.2
- Documentación de skills
Configura:
- Seguridad
- Testing
- Git safety
- Code review
- Frontend tools
- Modo educativo

### PHASE 3B — HISTÓRICOS
Crea:
- `datos/historical/` estructura
- Manifests para provenance
- Logs de descargas

---

## TROUBLESHOOTING

### El script se detiene en FASE 0
```
❌ Node.js NO está instalado

Solución:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22
nvm use 22
```

### El script se detiene en FASE 1
```
❌ TypeScript instalación falló

Solución:
npm install -g typescript typescript-language-server --force
```

### Tests fallan
```
❌ Tests: resultado inesperado

Solución:
npm install
npm run prueba
```

### Permisos denegados
```
❌ Permission denied: .claude/setup-automation.sh

Solución:
chmod +x .claude/setup-automation.sh
bash .claude/setup-automation.sh
```

---

## EJECUTAR MANUALMENTE DESPUÉS

Si necesitas re-ejecutar una FASE específica:

### FASE 0 — Diagnóstico
```bash
node --version && npm --version && git --version
npm run prueba | tail -10
```

### FASE 1 — TypeScript
```bash
npm install -g typescript typescript-language-server
tsc --version
typescript-language-server --version
tsc --noEmit
```

### FASES 2-7 — Verificar
```bash
cat .claude/settings.json | grep version
cat .claude/skills-enabled.md | head -20
```

### PHASE 3B — Históricos
```bash
ls -la datos/historical/
cat datos/historical/manifests/download-log.jsonl | head -5
```

---

## AUTOMATIZACIÓN EN CI/CD

Para GitHub Actions, use el bash script:

```yaml
name: Setup Atlas
on: push
jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - name: Run Setup
        run: bash .claude/setup-automation.sh 0 7
      - name: Archive logs
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: setup-logs
          path: .claude/setup-automation.log
```

---

## LOGS Y REPORTES

### Logs en tiempo real
```bash
tail -f .claude/setup-automation.log
```

### Ver reporte después
```bash
cat SETUP_AUTOMATION_REPORT.md
```

### Buscar errores
```bash
grep "❌" .claude/setup-automation.log
grep "ERROR" SETUP_AUTOMATION_REPORT.md
```

---

## PRÓXIMAS ACCIONES

Después que el setup complete:

1. **Leer documentación:**
   ```bash
   cat .claude/skills-enabled.md
   cat CLAUDE.md
   ```

2. **Ejecutar primera prueba:**
   ```bash
   /code-review medium
   ```

3. **Hacer un commit:**
   ```bash
   /commit
   ```

4. **Ver panel frontend:**
   ```bash
   npm run panel
   ```

---

## PREGUNTAS FRECUENTES

**P: ¿Puedo interrumpir el script?**  
R: Sí. Presiona Ctrl+C. No romperá nada.

**P: ¿Se puede ejecutar dos veces?**  
R: Sí. Es idempotente (seguro ejecutar múltiples veces).

**P: ¿Modifica el código fuente?**  
R: No. Solo crea archivos de configuración en `.claude/` y `datos/`.

**P: ¿Puedo elegir qué FASES ejecutar?**  
R: Sí. Usa: `bash setup-automation.sh INICIO FIN`

**P: ¿Qué pasa si una FASE falla?**  
R: El script se detiene. Leer `.claude/setup-automation.log` para detalles.

**P: ¿Se instala con permisos admin?**  
R: `npm install -g` usa sudo si es necesario. En sistemas sin sudo, puede fallar.

---

## SOPORTE

Si algo falla:

1. Captura logs:
   ```bash
   cat .claude/setup-automation.log > /tmp/atlas-setup.log
   ```

2. Verifica reporte:
   ```bash
   cat SETUP_AUTOMATION_REPORT.md
   ```

3. Intenta manualmente:
   ```bash
   npm install -g typescript
   tsc --version
   ```

---

**Última actualización:** 2026-09-26  
**Versión:** 1.0  
**Status:** ✅ Listo para usar
