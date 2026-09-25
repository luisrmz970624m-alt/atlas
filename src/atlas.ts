#!/usr/bin/env node
// Línea de comandos de Atlas V0.3
//
//   node --experimental-strip-types src/atlas.ts auditar
//   node --experimental-strip-types src/atlas.ts anotar "texto"
//   node --experimental-strip-types src/atlas.ts permiso "instalar ffmpeg"
//   node --experimental-strip-types src/atlas.ts ver [n]

import { auditar, leerEventos } from './registro.ts';
import { registrar, pedirPermiso, LIMITES } from './supervisor.ts';
import { perseguir, describir } from './ciclo.ts';
import { Memoria } from './memoria.ts';
import { siguiente, progreso, registrarMaterial, registrarPractica, avanceDe, tema, TEMARIO } from './curso.ts';
import { evaluar as evaluarRespuesta, enunciado, plantilla } from './evaluacion.ts';
import { rutaSegura } from './herramientas.ts';
import { generar, alGenerar, MODELO, MAX_SALIDA, ModeloNoDisponible, RespuestaIncompleta } from './modelo.ts';
import { ejecutarCLIv08 } from './cli-v08.ts';
import { ejecutarCLIUsuario } from './cli-usuario.ts';

const RUTA = process.env.ATLAS_REGISTRO ?? 'datos/registro.jsonl';
const MEMORIA = process.env.ATLAS_MEMORIA ?? 'datos/memoria.db';
const [comando, ...args] = process.argv.slice(2);

const ICONO = { verde: '🟢', amarillo: '🟡', rojo: '🔴' } as const;

switch (comando) {
  case 'auditar': {
    const r = auditar(RUTA);
    const marca = r.estado === 'integra' ? '✅' : r.estado === 'rota' ? '🚨' : '⚠️ ';
    console.log(`${marca} ${r.detalle}`);
    if (r.desde) console.log(`   Desde: ${r.desde}`);
    if (r.hasta) console.log(`   Hasta: ${r.hasta}`);
    if (r.rota_en) console.log(`   Primer evento inválido: ${r.rota_en}`);
    process.exit(r.estado === 'integra' ? 0 : 1);
  }

  case 'anotar': {
    const texto = args.join(' ');
    if (!texto) { console.error('Falta el texto. Ejemplo: anotar "empecé la lección 1"'); process.exit(1); }
    const e = registrar(RUTA, { tipo: 'sistema', descripcion: texto });
    console.log(`Evento ${e.id} registrado. Huella ${e.hash.slice(0, 12)}…`);
    break;
  }

  case 'permiso': {
    const accion = args.join(' ');
    if (!accion) { console.error('Falta la acción. Ejemplo: permiso "instalar ffmpeg"'); process.exit(1); }
    const d = pedirPermiso(RUTA, accion);
    console.log(`${ICONO[d.nivel]} ${d.nivel.toUpperCase()} — ${d.permitido ? 'permitido' : 'NO permitido sin aprobación'}`);
    console.log(`   ${d.motivo}`);
    break;
  }

  case 'ver': {
    const n = Number(args[0] ?? 10);
    const eventos = leerEventos(RUTA).slice(-n);
    if (eventos.length === 0) { console.log('Registro vacío.'); break; }
    for (const e of eventos) {
      const hora = e.fecha.slice(0, 19).replace('T', ' ');
      console.log(`${String(e.id).padStart(4)} ${hora} ${ICONO[e.nivel]} [${e.tipo}] ${e.descripcion}`);
    }
    break;
  }

  case 'objetivo': {
    const objetivo = args.join(' ');
    if (!objetivo) { console.error('Falta el objetivo. Ejemplo: objetivo "estudiar 30 minutos de TypeScript"'); process.exit(1); }

    console.log(`Pensando con ${MODELO}…`);
    console.log('(un modelo local en CPU va a unos 4 tokens/s: esto tarda minutos)\n');

    // Señal de vida mientras el modelo escribe, para no mirar una pantalla muerta.
    const inicio = Date.now();
    alGenerar((n) => {
      if (n % 25 !== 0) return;
      const seg = Math.round((Date.now() - inicio) / 1000);
      process.stdout.write(`\r   ${n} tokens · ${seg}s · ${(n / Math.max(seg, 1)).toFixed(1)} t/s   `);
    });

    try {
      const memoria = new Memoria(MEMORIA);
      const { resultado: r, intentos } = await perseguir(RUTA, objetivo, generar, 2, memoria);
      memoria.cerrar();
      process.stdout.write('\r' + ' '.repeat(50) + '\r');
      const plan = r.plan;

      if (intentos > 1) console.log(`✎ ${intentos - 1} intento(s) rechazado(s) por el estándar antes de este.\n`);

      console.log(`Plan v${plan.version} — ${plan.pasos.length} paso(s)`);
      console.log(`Criterio final: ${plan.criterio_final}\n`);
      for (const p of plan.pasos) {
        console.log(`${ICONO[p.nivel]} ${p.n}. ${p.descripcion}`);
        console.log(`      herramienta:  ${p.herramienta}(${Object.keys(p.argumentos).join(', ')})`);
        const ajuste = p.ajustada ? '  (ajustada: el tamaño lo mide el estándar)' : '';
        console.log(`      verificación: ${p.verificacion ? describir(p.verificacion) : '— ninguna —'}${ajuste}`);
      }

      const marca = r.parada === 'objetivo cumplido' ? '✅' : '⚠️ ';
      console.log(`\n${marca} ${r.parada} (${r.ejecutados} paso(s) completado(s) y comprobado(s))`);
      console.log(`   ${r.detalle}`);
    } catch (e) {
      if (e instanceof ModeloNoDisponible) { console.error(`⚠️  ${e.message}`); process.exit(1); }
      if (e instanceof RespuestaIncompleta) {
        console.error(`⚠️  ${e.message}`);
        console.error(`   Tope actual: ${MAX_SALIDA} tokens. Puedes subirlo así:`);
        console.error('   ATLAS_MAX_SALIDA=12288 npm run atlas -- objetivo "…"');
        process.exit(1);
      }
      throw e;
    }
    break;
  }

  case 'estudiar': {
    const m = new Memoria(MEMORIA);
    const s = siguiente(m);

    if (!s) {
      console.log('✅ Nada pendiente por ahora. Todo practicado y sin repasos vencidos.');
      console.log('   Mira el plan completo con: npm run atlas -- progreso');
      m.cerrar();
      break;
    }

    const cabecera = {
      repaso:    `🔁 Toca repasar: ${s.tema.titulo}`,
      continuar: `▶️  Tienes material sin practicar: ${s.tema.titulo}`,
      nuevo:     `🆕 Tema nuevo: ${s.tema.titulo}`,
    }[s.motivo];
    console.log(`${cabecera}\n`);

    if (s.avance.archivos.length > 0) {
      console.log(`Material ya creado: ${s.avance.archivos.join(', ')}`);
      console.log(`Ábrelo con: cat laboratorio/${s.avance.archivos[0]}\n`);
    }

    if (s.motivo !== 'nuevo' && s.avance.archivos.length > 0) {
      console.log('Cuando hagas el ejercicio:');
      console.log(`   npm run atlas -- responder ${s.tema.id}   # crea tu plantilla`);
      console.log(`   npm run atlas -- evaluar ${s.tema.id}     # Atlas revisa tu solución`);
      m.cerrar();
      break;
    }

    // No hay material: Atlas lo genera ahora.
    console.log(`Preparando la lección con ${MODELO}…`);
    console.log('(un modelo local en CPU tarda unos minutos)\n');

    const inicio = Date.now();
    alGenerar((n) => {
      if (n % 25 !== 0) return;
      const seg = Math.round((Date.now() - inicio) / 1000);
      process.stdout.write(`\r   ${n} tokens · ${seg}s · ${(n / Math.max(seg, 1)).toFixed(1)} t/s   `);
    });

    try {
      const objetivo = s.tema.objetivo;
      const { resultado: r } = await perseguir(RUTA, objetivo, generar, 2, m);
      process.stdout.write('\r' + ' '.repeat(50) + '\r');

      if (r.parada === 'objetivo cumplido') {
        registrarMaterial(m, s.tema.id, r.producidos);
        console.log(`✅ Lección lista: ${r.producidos.join(', ')}`);
        console.log(`   Léela con: cat laboratorio/${r.producidos[0]}`);
        console.log(`\nCuando la hayas leído:`);
        console.log(`   npm run atlas -- responder ${s.tema.id}   # crea tu plantilla`);
        console.log(`   npm run atlas -- evaluar ${s.tema.id}     # Atlas revisa tu solución`);
      } else {
        console.log(`⚠️  ${r.parada}: ${r.detalle}`);
        console.log('   No se registró material: la lección no salió bien.');
      }
    } catch (e) {
      if (e instanceof ModeloNoDisponible) { console.error(`⚠️  ${e.message}`); m.cerrar(); process.exit(1); }
      if (e instanceof RespuestaIncompleta) { console.error(`⚠️  ${e.message}`); m.cerrar(); process.exit(1); }
      throw e;
    }
    m.cerrar();
    break;
  }

  case 'responder': {
    const id = args[0];
    if (!id || !tema(id)) {
      console.error(`Falta el tema. Válidos:\n   ${TEMARIO.map((t) => t.id).join(', ')}`);
      process.exit(1);
    }
    const m = new Memoria(MEMORIA);
    const a = avanceDe(m, id!);
    m.cerrar();

    if (a.archivos.length === 0) {
      console.error(`Todavía no hay lección de "${id}". Créala con: npm run atlas -- estudiar`);
      process.exit(1);
    }

    const { existsSync, readFileSync, writeFileSync, mkdirSync } = await import('node:fs');
    const { dirname } = await import('node:path');

    const leccion = rutaSegura(a.archivos[0]!);
    const texto = enunciado(readFileSync(leccion, 'utf8'));
    if (!texto) {
      console.error(`La lección ${a.archivos[0]} no tiene sección "## Ejercicio".`);
      process.exit(1);
    }

    const relativa = `respuestas/${id}.ts`;
    const destino = rutaSegura(relativa);
    if (existsSync(destino)) {
      console.log(`Ya tienes tu respuesta en laboratorio/${relativa}. No la toco.`);
    } else {
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, plantilla(id!, texto), 'utf8');
      console.log(`📝 Plantilla creada: laboratorio/${relativa}`);
    }
    console.log(`   Escribe ahí tu solución y luego: npm run atlas -- evaluar ${id}`);
    break;
  }

  case 'evaluar': {
    const id = args[0];
    if (!id || !tema(id)) {
      console.error(`Falta el tema. Válidos:\n   ${TEMARIO.map((t) => t.id).join(', ')}`);
      process.exit(1);
    }
    const m = new Memoria(MEMORIA);
    const a = avanceDe(m, id!);
    if (a.archivos.length === 0) {
      console.error(`No hay lección de "${id}" todavía.`);
      m.cerrar();
      process.exit(1);
    }

    console.log(`Revisando tu respuesta con ${MODELO}…\n`);
    const inicio = Date.now();
    alGenerar((n) => {
      if (n % 25 !== 0) return;
      const seg = Math.round((Date.now() - inicio) / 1000);
      process.stdout.write(`\r   ${n} tokens · ${seg}s   `);
    });

    try {
      const r = await evaluarRespuesta(a.archivos[0]!, `respuestas/${id}.ts`, generar);
      process.stdout.write('\r' + ' '.repeat(40) + '\r');

      if (r.ejecucion) {
        console.log(r.ejecucion.corrio
          ? `▶️  Tu código corrió en ${r.ejecucion.ms} ms.`
          : `❌ Tu código no llegó a correr.`);
        if (r.ejecucion.salida) console.log(`   Salida: ${r.ejecucion.salida.split('\n').join(' | ')}`);
        if (r.ejecucion.error)  console.log(`   Error:  ${r.ejecucion.error.split('\n')[0]}`);
        console.log('');
      }

      if (r.revision) {
        for (const x of r.revision.aciertos)  console.log(`   ✓ ${x}`);
        for (const x of r.revision.faltantes) console.log(`   ✗ ${x}`);
        if (r.revision.pista) console.log(`\n   💡 ${r.revision.pista}`);
        console.log('');
      }

      // La revisión del modelo es una opinión: se guarda como deducción.
      if (r.revision) {
        m.recordar({
          espacio: 'programacion',
          clave: `revision:${id}`,
          resumen: r.aprobado ? 'la respuesta cumple el enunciado' : `faltó: ${r.detalle || r.motivo}`,
          origen: 'deduccion',
          fuente: MODELO,
          confianza: r.ejecucion ? 0.8 : 0.6,
          datos: r.revision,
        });
      }

      registrar(RUTA, {
        tipo: r.aprobado ? 'resultado' : 'error',
        descripcion: `Evaluación del ejercicio "${id}"`,
        entrada: { tema: id, respuesta: `respuestas/${id}.ts` },
        salida: { motivo: r.motivo, corrio: r.ejecucion?.corrio ?? null, cumple: r.revision?.cumple ?? null },
        veredicto: r.aprobado ? 'exito' : 'fallo',
        razon: r.detalle || r.motivo,
      });

      if (r.aprobado) {
        const av = registrarPractica(m, id!);
        console.log(av.estado === 'dominado'
          ? `🏆 APROBADO — ${tema(id!)!.titulo}: DOMINADO (${av.practicas.length} prácticas en días distintos)`
          : `✅ APROBADO — ${tema(id!)!.titulo}: practicado (${av.practicas.length} vez/veces)`);
        console.log(`   Próximo repaso: ${av.repaso}`);
        if (av.estado !== 'dominado') console.log('   Para dominarlo, practícalo otro día.');
      } else {
        const ayuda = {
          'sin respuesta': `Crea tu respuesta con: npm run atlas -- responder ${id}`,
          'sin enunciado': 'La lección no trae ejercicio. Genera otra con: npm run atlas -- estudiar',
          'no ejecuta':    'Arregla el error de arriba y vuelve a evaluar.',
          'incompleto':    'Completa lo que falta y vuelve a evaluar.',
          'aprobado':      '',
        }[r.motivo];
        console.log(`⚠️  No aprobado (${r.motivo}). ${r.motivo !== 'no ejecuta' && r.detalle ? r.detalle : ''}`);
        if (ayuda) console.log(`   ${ayuda}`);
        console.log(`\n   Si crees que Atlas se equivoca, puedes registrarlo tú:`);
        console.log(`   npm run atlas -- practique ${id}`);
      }
    } catch (e) {
      if (e instanceof ModeloNoDisponible) { console.error(`⚠️  ${e.message}`); m.cerrar(); process.exit(1); }
      throw e;
    }
    m.cerrar();
    break;
  }

  case 'practique': {
    const id = args[0];
    if (!id || !tema(id)) {
      console.error(`Falta el tema. Los válidos son:\n   ${TEMARIO.map((t) => t.id).join(', ')}`);
      process.exit(1);
    }
    const m = new Memoria(MEMORIA);
    const a = registrarPractica(m, id!);

    registrar(RUTA, {
      tipo: 'sistema',
      descripcion: `Luis practicó "${tema(id!)!.titulo}"`,
      entrada: { tema: id },
      salida: { estado: a.estado, practicas: a.practicas.length, repaso: a.repaso },
      veredicto: 'exito',
      razon: 'práctica declarada por el usuario',
    });

    console.log(a.estado === 'dominado'
      ? `🏆 ${tema(id!)!.titulo}: DOMINADO (${a.practicas.length} prácticas en días distintos)`
      : `✔️  ${tema(id!)!.titulo}: practicado (${a.practicas.length} vez/veces)`);
    console.log(`   Próximo repaso: ${a.repaso}`);
    if (a.estado !== 'dominado') {
      console.log('   Para dominarlo hace falta practicarlo otro día, no hoy otra vez.');
    }
    m.cerrar();
    break;
  }

  case 'progreso': {
    const m = new Memoria(MEMORIA);
    const p = progreso(m);
    const icono = { dominado: '🏆', practicado: '✔️ ', material: '📄', pendiente: '  ' } as const;

    console.log(`${p.dominados} dominado(s) · ${p.practicados} practicado(s) · ${p.conMaterial} con material · ${p.pendientes} pendiente(s)`);
    if (p.repasosHoy > 0) console.log(`🔁 ${p.repasosHoy} repaso(s) vencido(s)\n`); else console.log('');

    let nivel = 0;
    for (const { tema: t, avance: a } of p.temas) {
      if (t.nivel !== nivel) { nivel = t.nivel; console.log(`── Nivel ${nivel} ──`); }
      const repaso = a.repaso ? `  repaso ${a.repaso}` : '';
      console.log(`${icono[a.estado]} ${t.id.padEnd(12)} ${t.titulo}${repaso}`);
    }
    m.cerrar();
    break;
  }

  case 'memoria': {
    const m = new Memoria(MEMORIA);
    const filtro = args.join(' ');
    if (filtro) {
      const rs = m.consultar({ texto: filtro });
      if (rs.length === 0) { console.log(`Nada recordado sobre "${filtro}".`); }
      for (const r of rs) {
        const marca = r.origen === 'deduccion' ? '≈' : '·';
        console.log(`${String(r.id).padStart(4)} ${marca} [${r.espacio}] ${r.clave}: ${r.resumen}`);
        console.log(`       fuente ${r.fuente} · confianza ${r.confianza} · ${r.fecha.slice(0, 10)}`);
      }
    } else {
      const resumen = m.resumen();
      const total = Object.values(resumen).reduce((a, b) => a + b, 0);
      console.log(`${total} recuerdo(s) vigente(s):`);
      for (const [espacio, n] of Object.entries(resumen)) console.log(`   ${espacio}: ${n}`);

      const chocan = m.contradicciones();
      if (chocan.length > 0) {
        console.log(`\n⚠️  ${chocan.length} contradicción(es) sin resolver:`);
        for (const c of chocan) console.log(`   [${c.espacio}] ${c.clave}: ${c.versiones.length} versiones`);
      }
    }
    m.cerrar();
    break;
  }

  case 'olvidar': {
    const id = Number(args[0]);
    if (!Number.isInteger(id)) { console.error('Falta el número del recuerdo. Míralos con: memoria'); process.exit(1); }
    const m = new Memoria(MEMORIA);
    const r = m.porId(id);
    if (!r) { console.error(`No existe el recuerdo ${id}.`); m.cerrar(); process.exit(1); }
    m.olvidar(id);
    registrar(RUTA, {
      tipo: 'sistema',
      descripcion: `Luis ordenó olvidar el recuerdo ${id}`,
      entrada: { id },
      salida: { clave: r!.clave, espacio: r!.espacio },
      veredicto: 'exito',
      razon: 'orden explícita del usuario',
    });
    console.log(`Olvidado: [${r!.espacio}] ${r!.clave}`);
    m.cerrar();
    break;
  }

  case 'exportar': {
    const m = new Memoria(MEMORIA);
    console.log(JSON.stringify(m.exportar(), null, 2));
    m.cerrar();
    break;
  }

  case 'limites':
    console.log(JSON.stringify(LIMITES, null, 2));
    break;

  case 'minar':
  case 'bots':
  case 'competencia':
  case 'ciclo':
  case 'estado':
  case 'respaldo':
  case 'correr':
  case 'agentes': {
    await ejecutarCLIv08(comando, args);
    break;
  }

  case 'portafolio':
  case 'comprar':
  case 'vender': {
    await ejecutarCLIUsuario(comando, args);
    break;
  }

  default:
    console.log(`Atlas V0.8 CLI

EDUCACIÓN (V0.6):
  estudiar           Qué toca hoy: repaso, terminar lo empezado o tema nuevo
  responder <tema>   Crea la plantilla para tu respuesta al ejercicio
  evaluar <tema>     Ejecuta tu respuesta y la revisa contra el enunciado
  practique <tema>   Registra a mano que hiciste el ejercicio
  progreso           Tu avance en el temario completo
  objetivo <texto>   Planea un objetivo, lo ejecuta en el laboratorio y comprueba cada paso

TU TRADING (V0.8) — compites contra los bots de Atlas:
  portafolio                            💼 Tu capital, posiciones, PnL y win rate
  comprar <simbolo> <cant> [precio]     🟢 Compra (precio de mercado si lo omites)
  vender <simbolo> <cant> [precio]      🔴 Venta

AGENTES DE IA:
  agentes                               🧠 Qué agentes hay (Ollama/Claude/ChatGPT) y cuál responde
  agentes probar [nombre]               🔌 Prueba una respuesta REAL (no simulada) de cada uno

SISTEMAS (V0.8):
  minar [estado|ejecutar|historial]     ⛏️ Motor de minería
  bots [crear|listar|ejecutar]          🤖 Bots de trading autónomos
  competencia [estado|snapshot|registrar]  🏆 Competencia Tú vs Atlas
  correr [segundos]                     🤖 Deja a Atlas corriendo solo (default 60s por ciclo)
  ciclo                                 🚀 Ejecuta un ciclo completo (minar+bots+competencia) y persiste el estado
  estado                                📸 Muestra el último snapshot persistido (datos/atlas-state.json)
  respaldo [crear|listar]               💾 Respalda datos/atlas.db a respaldos/ (retiene últimos 7)

AUDITORÍA:
  auditar            Verifica la cadena completa del registro
  anotar <texto>     Escribe un evento en el registro
  permiso <accion>   Pregunta al Supervisor si una acción está permitida
  ver [n]            Muestra los últimos n eventos (por defecto 10)
  memoria [texto]    Qué recuerda Atlas (sin texto: resumen y contradicciones)
  olvidar <id>       Ordena olvidar un recuerdo
  exportar           Vuelca toda la memoria en JSON
  limites            Muestra los límites de seguridad vigentes

Registro: ${RUTA}\nMemoria:  ${MEMORIA}`);
}
