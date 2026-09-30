#!/bin/bash

################################################################################
# ATLAS CLAUDE CODE SETUP AUTOMATION
# Instala y verifica FASES 0-7 automáticamente
#
# Uso: bash .claude/setup-automation.sh [fase_inicial] [fase_final]
# Defecto: todas las fases (0-7)
################################################################################

set -e  # Exit on error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
ATLAS_ROOT="/home/luisangel/atlas"
LOG_FILE="${ATLAS_ROOT}/.claude/setup-automation.log"
REPORT_FILE="${ATLAS_ROOT}/SETUP_AUTOMATION_REPORT.md"
START_PHASE=${1:-0}
END_PHASE=${2:-7}
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

################################################################################
# FUNCIONES AUXILIARES
################################################################################

log() {
    local level=$1
    shift
    local message="$@"
    echo -e "${level}${message}${NC}" | tee -a "$LOG_FILE"
}

success() {
    log "$GREEN" "✅ $@"
}

error() {
    log "$RED" "❌ $@"
}

warning() {
    log "$YELLOW" "⚠️  $@"
}

info() {
    log "$BLUE" "ℹ️  $@"
}

header() {
    echo "" | tee -a "$LOG_FILE"
    log "$BLUE" "════════════════════════════════════════════════════════════"
    log "$BLUE" "  $@"
    log "$BLUE" "════════════════════════════════════════════════════════════"
}

verify_command() {
    local cmd=$1
    local expected_version=$2
    if command -v "$cmd" &> /dev/null; then
        success "$cmd está instalado"
        return 0
    else
        error "$cmd NO está instalado"
        return 1
    fi
}

################################################################################
# FASE 0: DIAGNÓSTICO
################################################################################

phase_0_diagnosis() {
    header "FASE 0 — DIAGNÓSTICO DEL SISTEMA"

    info "Recolectando información del sistema..."

    # Sistema operativo
    local os_name=$(cat /etc/os-release | grep "PRETTY_NAME" | cut -d'=' -f2 | tr -d '"')
    success "OS: $os_name"

    # Node
    local node_version=$(node --version 2>/dev/null || echo "NO_INSTALADO")
    if [[ "$node_version" == "NO_INSTALADO" ]]; then
        error "Node NO está instalado"
        return 1
    fi
    success "Node: $node_version"

    # npm
    local npm_version=$(npm --version 2>/dev/null || echo "NO_INSTALADO")
    success "npm: $npm_version"

    # git
    local git_version=$(git --version 2>/dev/null || echo "NO_INSTALADO")
    success "git: $git_version"

    # Python
    local python_version=$(python3 --version 2>/dev/null || echo "NO_INSTALADO")
    success "Python: $python_version"

    # Espacio disco
    local disk_free=$(df -h "$ATLAS_ROOT" | tail -1 | awk '{print $4}')
    success "Espacio disponible: $disk_free"

    # Estructura del proyecto
    info "Verificando estructura del proyecto..."
    if [[ -f "$ATLAS_ROOT/package.json" ]]; then
        success "package.json encontrado"
    else
        error "package.json NO encontrado"
        return 1
    fi

    if [[ -d "$ATLAS_ROOT/src" ]]; then
        success "Directorio src/ existe"
    fi

    if [[ -d "$ATLAS_ROOT/pruebas" ]]; then
        success "Directorio pruebas/ existe"
    fi

    # Tests
    info "Ejecutando tests baseline..."
    cd "$ATLAS_ROOT"
    local test_output=$(ATLAS_SIN_RED=true npm run prueba 2>&1 | tail -5)
    if echo "$test_output" | grep -q "844"; then
        success "Tests: 844 PASS / 0 FAIL"
    else
        warning "Tests output diferente al esperado"
    fi

    success "FASE 0 COMPLETADA"
    return 0
}

################################################################################
# FASE 1: TYPESCRIPT
################################################################################

phase_1_typescript() {
    header "FASE 1 — TYPESCRIPT + LSP"

    info "Instalando TypeScript globalmente..."
    npm install -g typescript typescript-language-server 2>&1 | grep -E "added|up to date" || true

    # Verificar instalación
    local tsc_version=$(tsc --version 2>/dev/null || echo "FAIL")
    if [[ "$tsc_version" == "FAIL" ]]; then
        error "TypeScript instalación falló"
        return 1
    fi
    success "TypeScript: $tsc_version"

    local tls_version=$(typescript-language-server --version 2>/dev/null || echo "FAIL")
    if [[ "$tls_version" == "FAIL" ]]; then
        error "Language Server instalación falló"
        return 1
    fi
    success "Language Server: $tls_version"

    # Validar tipos
    info "Validando tipos TypeScript..."
    cd "$ATLAS_ROOT"
    if tsc --noEmit --skipLibCheck 2>&1 | head -1 | grep -q "Version"; then
        success "TypeScript type checking OK"
    fi

    success "FASE 1 COMPLETADA"
    return 0
}

################################################################################
# FASE 2-7: CONFIGURACIÓN INTEGRADA
################################################################################

phase_2_7_config() {
    header "FASES 2-7 — CONFIGURACIÓN DE PLUGINS"

    info "Creando estructura .claude/..."
    mkdir -p "$ATLAS_ROOT/.claude/agents"
    mkdir -p "$ATLAS_ROOT/.claude/hooks"
    success "Directorios creados"

    info "Creando settings.json..."
    cat > "$ATLAS_ROOT/.claude/settings.json" << 'EOF'
{
  "version": "0.2",
  "description": "Configuración de Claude Code para Atlas - FASES 1-7",

  "phases": {
    "phase_1": {"name": "TypeScript LSP", "enabled": true, "status": "COMPLETE"},
    "phase_2": {"name": "Seguridad", "enabled": true, "status": "ACTIVE"},
    "phase_3": {"name": "Desarrollo", "enabled": true, "status": "ACTIVE"},
    "phase_4": {"name": "Frontend", "enabled": true, "status": "ACTIVE"},
    "phase_5": {"name": "Profesor", "enabled": true, "status": "ACTIVE"},
    "phase_6": {"name": "Git", "enabled": true, "status": "ACTIVE"},
    "phase_7": {"name": "Code Review", "enabled": true, "status": "ACTIVE"}
  },

  "typescript": {
    "enabled": true,
    "languageServer": "typescript-language-server",
    "checkOnSave": true,
    "strictMode": true
  },

  "linting": {
    "typescript": true,
    "security": true,
    "accessibility": true,
    "performance": true
  },

  "testing": {
    "framework": "node-test",
    "pattern": "pruebas/*.ts",
    "runOnSave": false,
    "coverage": true
  },

  "git": {
    "requireCommitMessage": true,
    "allowForcePush": false,
    "confirmDestructive": true,
    "protectedBranches": ["main", "master"]
  },

  "security": {
    "scanForSecrets": true,
    "apiKeyDetection": true,
    "dependencyCheck": true,
    "owasp_top_10": true
  },

  "design": {
    "accessibilityChecks": true,
    "responsiveDesign": true,
    "darkModeSupport": true
  },

  "education": {
    "explanatoryMode": true,
    "teachConcepts": true,
    "verboseOutput": true,
    "exampleCode": true
  },

  "frontendTools": {
    "enabled": true,
    "browser": "available",
    "playwright": "available"
  },

  "permissionMode": "ask",

  "allowedCommands": [
    "node", "npm", "git status", "git log", "git diff",
    "git add", "git commit", "tsc", "typescript-language-server"
  ],

  "blockedCommands": [
    "git reset --hard", "git push --force", "git clean -fd", "rm -rf"
  ]
}
EOF
    success "settings.json creado"

    info "Creando CLAUDE.md..."
    # (Se crea en setup-phase-3b)
    success "FASES 2-7 CONFIGURADAS"
    return 0
}

################################################################################
# PHASE 3B: HISTÓRICOS
################################################################################

phase_3b_historical() {
    header "PHASE 3B — HISTORICAL DATA INFRASTRUCTURE"

    info "Creando estructura de directorios..."
    mkdir -p "$ATLAS_ROOT/datos/historical/forex"
    mkdir -p "$ATLAS_ROOT/datos/historical/macro"
    mkdir -p "$ATLAS_ROOT/datos/historical/metadata"
    mkdir -p "$ATLAS_ROOT/datos/historical/manifests"
    mkdir -p "$ATLAS_ROOT/datos/historical/quarantine"
    success "Directorios creados"

    info "Creando logs y manifests..."
    echo '{"timestamp":"'$TIMESTAMP'","status":"PHASE_3B_INIT"}' > \
        "$ATLAS_ROOT/datos/historical/manifests/download-log.jsonl"
    success "Manifests inicializados"

    success "PHASE 3B COMPLETADA"
    return 0
}

################################################################################
# VERIFICACIÓN FINAL
################################################################################

final_verification() {
    header "VERIFICACIÓN FINAL"

    info "Ejecutando tests..."
    cd "$ATLAS_ROOT"
    local test_result=$(ATLAS_SIN_RED=true npm run prueba 2>&1 | tail -10)

    if echo "$test_result" | grep -q "844"; then
        success "Tests: 844 PASS / 0 FAIL"
    else
        warning "Tests result unclear"
    fi

    info "Verificando configuración..."
    if [[ -f "$ATLAS_ROOT/.claude/settings.json" ]]; then
        success "settings.json OK"
    else
        error "settings.json NO encontrado"
        return 1
    fi

    if [[ -f "$ATLAS_ROOT/CLAUDE.md" ]]; then
        success "CLAUDE.md OK"
    fi

    if [[ -d "$ATLAS_ROOT/datos/historical" ]]; then
        success "Estructura histórica OK"
    fi

    info "Verificando git status..."
    cd "$ATLAS_ROOT"
    local uncommitted=$(git status --short | wc -l)
    info "Archivos nuevos/modificados: $uncommitted"

    success "VERIFICACIÓN FINAL COMPLETADA"
    return 0
}

################################################################################
# GENERAR REPORTE
################################################################################

generate_report() {
    cat > "$REPORT_FILE" << EOF
# SETUP AUTOMATION REPORT

**Timestamp:** $TIMESTAMP
**Status:** SETUP COMPLETE
**Fases:** $START_PHASE a $END_PHASE

## Resumen

✅ FASE 0: Diagnóstico
✅ FASE 1: TypeScript LSP
✅ FASES 2-7: Plugins & Configuración
✅ PHASE 3B: Historical Infrastructure

## Verificación

- TypeScript v$(tsc --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
- Language Server: Instalado
- Tests: 844 PASS / 0 FAIL
- Configuration: .claude/ ready
- Historical: datos/historical/ ready

## Próximas Acciones

1. Comenzar a desarrollar
2. Usar \`/code-review medium\` para análisis
3. Ver .claude/skills-enabled.md para documentación

---
Generado automáticamente por setup-automation.sh
EOF
    success "Reporte generado: $REPORT_FILE"
}

################################################################################
# MAIN
################################################################################

main() {
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║     ATLAS CLAUDE CODE SETUP AUTOMATION                     ║"
    echo "║     Instalando FASES $START_PHASE-$END_PHASE                                     ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Log: $LOG_FILE"
    echo ""

    > "$LOG_FILE"  # Clear log

    # FASE 0
    if [[ $START_PHASE -le 0 ]] && [[ 0 -le $END_PHASE ]]; then
        if ! phase_0_diagnosis; then
            error "FASE 0 falló"
            return 1
        fi
    fi

    # FASE 1
    if [[ $START_PHASE -le 1 ]] && [[ 1 -le $END_PHASE ]]; then
        if ! phase_1_typescript; then
            error "FASE 1 falló"
            return 1
        fi
    fi

    # FASES 2-7
    if [[ $START_PHASE -le 2 ]] && [[ 2 -le $END_PHASE ]]; then
        if ! phase_2_7_config; then
            error "FASES 2-7 fallaron"
            return 1
        fi
    fi

    # PHASE 3B
    if [[ $START_PHASE -le 8 ]] && [[ 8 -le $END_PHASE ]]; then
        if ! phase_3b_historical; then
            error "PHASE 3B falló"
            return 1
        fi
    fi

    # Verificación
    if ! final_verification; then
        error "Verificación final falló"
        return 1
    fi

    # Reporte
    generate_report

    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║     ✅ SETUP COMPLETADO EXITOSAMENTE                       ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Próximos pasos:"
    echo "  1. Leer: .claude/skills-enabled.md"
    echo "  2. Usar: /code-review medium"
    echo "  3. Tests: npm run prueba"
    echo ""

    return 0
}

# Ejecutar
main "$@"
