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
import { generar, alGenerar, MODELO, MAX_SALIDA, ModeloNoDisponible, RespuestaIncompleta } from './modelo.ts';

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
        console.log(`      verificación: ${p.verificacion ? describir(p.verificacion) : '— ninguna —'}`);
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

  default:
    console.log(`Atlas V0.3

  objetivo <texto>   Planea un objetivo, lo ejecuta en el laboratorio y comprueba cada paso
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
