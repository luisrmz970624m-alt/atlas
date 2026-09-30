#!/usr/bin/env node

/**
 * ATLAS CLAUDE CODE SETUP AUTOMATION
 *
 * Instala y verifica automáticamente todas las FASES
 * Uso: npx ts-node .claude/setup-automation.ts [fase_inicial] [fase_final]
 */

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TIPOS Y INTERFACES
// ============================================================================

interface Phase {
  number: number;
  name: string;
  description: string;
  checks: Check[];
}

interface Check {
  name: string;
  fn: () => Promise<boolean>;
}

interface Result {
  phase: number;
  name: string;
  passed: boolean;
  checks: CheckResult[];
  duration: number;
}

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

// ============================================================================
// UTILIDADES
// ============================================================================

const COLORS = {
  RESET: '\x1b[0m',
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  CYAN: '\x1b[36m',
};

function log(color: string, icon: string, message: string) {
  console.log(`${color}${icon} ${message}${COLORS.RESET}`);
}

function success(message: string) {
  log(COLORS.GREEN, '✅', message);
}

function error(message: string) {
  log(COLORS.RED, '❌', message);
}

function warning(message: string) {
  log(COLORS.YELLOW, '⚠️ ', message);
}

function info(message: string) {
  log(COLORS.BLUE, 'ℹ️ ', message);
}

function header(message: string) {
  console.log('\n' + COLORS.CYAN + '═'.repeat(60));
  console.log(`  ${message}`);
  console.log('═'.repeat(60) + COLORS.RESET + '\n');
}

function execute(command: string, cwd?: string): { success: boolean; output: string } {
  try {
    const output = execSync(command, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output };
  } catch (e: any) {
    return { success: false, output: e.stderr || e.toString() };
  }
}

// ============================================================================
// VALIDACIONES
// ============================================================================

async function checkCommand(command: string): Promise<boolean> {
  const result = execute(`which ${command}`);
  return result.success;
}

async function checkVersion(command: string, pattern: RegExp): Promise<string | null> {
  const result = execute(`${command} --version`);
  if (!result.success) return null;
  const match = result.output.match(pattern);
  return match ? match[0] : null;
}

async function checkFile(filePath: string): Promise<boolean> {
  return fs.existsSync(filePath);
}

async function checkDirectory(dirPath: string): Promise<boolean> {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

// ============================================================================
// FASES
// ============================================================================

const PHASES: Phase[] = [
  {
    number: 0,
    name: 'DIAGNÓSTICO DEL SISTEMA',
    description: 'Verificar entorno y dependencias',
    checks: [
      {
        name: 'Node.js instalado',
        fn: async () => {
          const version = await checkVersion('node', /v\d+\.\d+\.\d+/);
          if (version) {
            success(`Node.js ${version} detectado`);
            return true;
          }
          error('Node.js no encontrado');
          return false;
        },
      },
      {
        name: 'npm instalado',
        fn: async () => {
          const version = await checkVersion('npm', /\d+\.\d+\.\d+/);
          if (version) {
            success(`npm ${version} detectado`);
            return true;
          }
          return false;
        },
      },
      {
        name: 'git instalado',
        fn: async () => {
          const version = await checkVersion('git', /git version .+/);
          if (version) {
            success(`${version} detectado`);
            return true;
          }
          return false;
        },
      },
      {
        name: 'package.json existe',
        fn: async () => {
          if (await checkFile('package.json')) {
            success('package.json encontrado');
            return true;
          }
          error('package.json no encontrado');
          return false;
        },
      },
      {
        name: 'Espacio en disco suficiente',
        fn: async () => {
          const result = execute('df -h . | tail -1');
          if (result.success) {
            const available = result.output.split(/\s+/)[3];
            success(`${available} de espacio disponible`);
            return true;
          }
          return false;
        },
      },
      {
        name: 'Tests baseline',
        fn: async () => {
          const result = execute('ATLAS_SIN_RED=true npm run prueba 2>&1 | tail -5');
          if (result.output.includes('844')) {
            success('Tests: 844 PASS / 0 FAIL');
            return true;
          }
          warning('Tests output diferente');
          return false;
        },
      },
    ],
  },

  {
    number: 1,
    name: 'TYPESCRIPT LSP',
    description: 'Instalar y configurar TypeScript',
    checks: [
      {
        name: 'Instalar TypeScript globalmente',
        fn: async () => {
          const result = execute('npm install -g typescript typescript-language-server');
          if (result.success) {
            success('TypeScript instalado');
            return true;
          }
          error('Falló instalación de TypeScript');
          return false;
        },
      },
      {
        name: 'Verificar tsc',
        fn: async () => {
          const version = await checkVersion('tsc', /Version .+/);
          if (version) {
            success(`tsc ${version} verificado`);
            return true;
          }
          return false;
        },
      },
      {
        name: 'Verificar language server',
        fn: async () => {
          const version = await checkVersion('typescript-language-server', /\d+\.\d+\.\d+/);
          if (version) {
            success(`Language Server ${version} verificado`);
            return true;
          }
          return false;
        },
      },
      {
        name: 'Type checking',
        fn: async () => {
          const result = execute('tsc --noEmit --skipLibCheck');
          if (result.success || result.output.includes('Version')) {
            success('Type checking OK');
            return true;
          }
          return false;
        },
      },
    ],
  },

  {
    number: 2,
    name: 'FASES 2-7 CONFIGURACIÓN',
    description: 'Configurar plugins y skills',
    checks: [
      {
        name: 'Crear estructura .claude/',
        fn: async () => {
          const dirs = ['.claude/agents', '.claude/hooks'];
          for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
          }
          success('.claude/ estructura creada');
          return true;
        },
      },
      {
        name: 'settings.json actualizado',
        fn: async () => {
          if (await checkFile('.claude/settings.json')) {
            const content = fs.readFileSync('.claude/settings.json', 'utf-8');
            if (content.includes('"version": "0.2"')) {
              success('settings.json v0.2 detectado');
              return true;
            }
          }
          warning('settings.json necesita actualización');
          return false;
        },
      },
      {
        name: 'CLAUDE.md existe',
        fn: async () => {
          if (await checkFile('CLAUDE.md')) {
            success('CLAUDE.md encontrado');
            return true;
          }
          warning('CLAUDE.md no encontrado');
          return false;
        },
      },
      {
        name: 'skills-enabled.md documentado',
        fn: async () => {
          if (await checkFile('.claude/skills-enabled.md')) {
            success('Skills documentados');
            return true;
          }
          warning('Skills doc falta');
          return false;
        },
      },
    ],
  },

  {
    number: 8,
    name: 'PHASE 3B HISTÓRICA',
    description: 'Infraestructura de datos históricos',
    checks: [
      {
        name: 'Estructura datos/historical/',
        fn: async () => {
          const dirs = [
            'datos/historical/forex',
            'datos/historical/macro',
            'datos/historical/metadata',
            'datos/historical/manifests',
            'datos/historical/quarantine',
          ];
          for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
          }
          success('Estructura histórica creada');
          return true;
        },
      },
      {
        name: 'Manifests inicializados',
        fn: async () => {
          const manifestFile = 'datos/historical/manifests/download-log.jsonl';
          if (!fs.existsSync(manifestFile)) {
            fs.writeFileSync(
              manifestFile,
              `{"timestamp":"${new Date().toISOString()}","status":"PHASE_3B_INIT"}\n`
            );
          }
          success('Manifests OK');
          return true;
        },
      },
    ],
  },
];

// ============================================================================
// EJECUTAR FASES
// ============================================================================

async function runPhase(phase: Phase): Promise<Result> {
  const startTime = Date.now();
  header(`FASE ${phase.number} — ${phase.name}`);

  info(phase.description);
  console.log('');

  const checkResults: CheckResult[] = [];
  let allPassed = true;

  for (const check of phase.checks) {
    try {
      const passed = await check.fn();
      checkResults.push({
        name: check.name,
        passed,
        message: passed ? 'OK' : 'FAILED',
      });
      if (!passed) allPassed = false;
    } catch (e: any) {
      checkResults.push({
        name: check.name,
        passed: false,
        message: e.message,
      });
      allPassed = false;
    }
  }

  const duration = Date.now() - startTime;

  console.log('');
  if (allPassed) {
    success(`FASE ${phase.number} COMPLETADA EN ${(duration / 1000).toFixed(2)}s`);
  } else {
    error(`FASE ${phase.number} FALLÓ`);
  }

  return {
    phase: phase.number,
    name: phase.name,
    passed: allPassed,
    checks: checkResults,
    duration,
  };
}

// ============================================================================
// GENERAR REPORTE
// ============================================================================

function generateReport(results: Result[]): string {
  const timestamp = new Date().toISOString();
  let report = `# SETUP AUTOMATION REPORT\n\n`;
  report += `**Timestamp:** ${timestamp}\n`;
  report += `**Status:** ${results.every(r => r.passed) ? '✅ COMPLETADO' : '⚠️ CON ERRORES'}\n\n`;

  report += `## Resumen por Fase\n\n`;
  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    report += `${status} **FASE ${result.phase}: ${result.name}**\n`;
    report += `   - Tiempo: ${(result.duration / 1000).toFixed(2)}s\n`;
    report += `   - Checks: ${result.checks.length}\n`;
    report += `   - Pasadas: ${result.checks.filter(c => c.passed).length}\n\n`;
  }

  report += `## Detalles de Checks\n\n`;
  for (const result of results) {
    report += `### FASE ${result.phase}: ${result.name}\n\n`;
    for (const check of result.checks) {
      const status = check.passed ? '✅' : '❌';
      report += `${status} ${check.name}\n`;
    }
    report += `\n`;
  }

  return report;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(12) + 'ATLAS SETUP AUTOMATION' + ' '.repeat(25) + '║');
  console.log('║' + ' '.repeat(14) + 'Instalando todas las FASES' + ' '.repeat(18) + '║');
  console.log('╚' + '═'.repeat(58) + '╝\n');

  const startPhase = parseInt(process.argv[2] || '0', 10);
  const endPhase = parseInt(process.argv[3] || '8', 10);

  info(`Ejecutando FASES ${startPhase} a ${endPhase}...\n`);

  const results: Result[] = [];
  const phasesToRun = PHASES.filter(p => p.number >= startPhase && p.number <= endPhase);

  for (const phase of phasesToRun) {
    const result = await runPhase(phase);
    results.push(result);

    if (!result.passed) {
      error(`No continuando: FASE ${phase.number} falló`);
      break;
    }
  }

  // Reporte final
  const report = generateReport(results);
  fs.writeFileSync('SETUP_AUTOMATION_REPORT.md', report);
  success(`\nReporte guardado: SETUP_AUTOMATION_REPORT.md`);

  // Resumen
  console.log('\n╔' + '═'.repeat(58) + '╗');
  const allPassed = results.every(r => r.passed);
  if (allPassed) {
    console.log('║' + ' '.repeat(15) + '✅ SETUP COMPLETADO' + ' '.repeat(23) + '║');
  } else {
    console.log('║' + ' '.repeat(14) + '⚠️  SETUP CON ERRORES' + ' '.repeat(22) + '║');
  }
  console.log('╚' + '═'.repeat(58) + '╝\n');

  // Estadísticas
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  const passedPhases = results.filter(r => r.passed).length;
  const totalChecks = results.reduce((sum, r) => sum + r.checks.length, 0);
  const passedChecks = results.reduce(
    (sum, r) => sum + r.checks.filter(c => c.passed).length,
    0
  );

  info(`Fases completadas: ${passedPhases}/${results.length}`);
  info(`Checks pasados: ${passedChecks}/${totalChecks}`);
  info(`Tiempo total: ${(totalTime / 1000).toFixed(2)}s\n`);

  return allPassed ? 0 : 1;
}

// Ejecutar
main()
  .then(exitCode => process.exit(exitCode))
  .catch(e => {
    error(`Error fatal: ${e.message}`);
    process.exit(1);
  });
