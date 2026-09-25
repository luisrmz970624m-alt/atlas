import { MotorMineria } from './mineria.ts';
import { MotorBots, type EstrategiaBot } from './bots.ts';
import { GestorCompetencia } from './competencia.ts';
import { GestorEnergia } from './energia.ts';
import { OrquestadorV08 } from './orquestador-v08.ts';
import { respaldarTodo, listarRespaldos } from './respaldo.ts';
import { SIMBOLOS_SOPORTADOS, esSimboloSoportado } from './precios-realtime.ts';
import { ordenConfigurado, proveedorActivo, PROVEEDORES, ModeloNoDisponible, RespuestaIncompleta } from './modelo.ts';
import { apiPagadaPermitida, clasificarErrorProveedor } from './proveedores/seleccion.ts';

const DB_PATH = process.env.ATLAS_DB ?? 'datos/atlas.db';

export async function ejecutarCLIv08(comando: string, args: string[]) {
  switch (comando) {
    case 'minar': {
      return await cliMinar(args);
    }

    case 'bots': {
      return await cliBots(args);
    }

    case 'competencia': {
      return await cliCompetencia(args);
    }

    case 'ciclo': {
      return await cliCiclo();
    }

    case 'estado': {
      return await cliEstado();
    }

    case 'respaldo': {
      return await cliRespaldo(args);
    }

    case 'correr': {
      return await cliCorrer(args);
    }

    case 'agentes': {
      return await cliAgentes(args);
    }

    default:
      console.error(`Comando desconocido: ${comando}`);
      console.error('Comandos V0.8: minar, bots, competencia, ciclo, estado, respaldo, correr, agentes');
      process.exit(1);
  }
}

async function cliAgentes(args: string[]) {
  const subcomando = args[0];

  if (subcomando === 'probar') {
    return await cliProbarAgentes(args[1]);
  }

  mostrarEstadoAgentes();
}

/** Muestra qué agentes de IA hay configurados y cuál atendería ahora. */
function mostrarEstadoAgentes() {
  const orden = ordenConfigurado();
  const activo = proveedorActivo();

  console.log('\n🧠 AGENTES DE IA\n');
  console.log('  Atlas decide cuál usa. Si el primero no responde, pasa al siguiente.\n');

  for (const nombre of orden) {
    const p = PROVEEDORES[nombre];
    const listo = p.disponible();
    const marca = listo ? '✅' : '⬜';
    const costo = p.local ? 'local, gratis' : 'nube, se cobra por uso';
    const nota = listo ? '' : nombre === 'claude'
      ? '  → define ANTHROPIC_API_KEY'
      : nombre === 'chatgpt' ? '  → define OPENAI_API_KEY' : '';

    console.log(`  ${marca} ${nombre.padEnd(8)} ${p.modelo.padEnd(22)} ${costo}${nota}`);
  }

  console.log(`\n  Atendería ahora: ${activo ? `${activo.nombre} (${activo.modelo})` : 'ninguno'}`);
  console.log('  Cambia el orden con: ATLAS_PROVEEDOR=claude,ollama');
  console.log('  Prueba una respuesta real con: npm run atlas -- agentes probar\n');
}

/**
 * Manda una petición real y mínima a cada proveedor disponible (o a uno solo
 * si se pide por nombre) para confirmar que responde de verdad — no solo que
 * esté "configurado". Nunca imprime la clave, solo si la respuesta llegó bien.
 *
 * El costo es mínimo a propósito: un enunciado corto que solo puede
 * responderse con un JSON de una palabra, para no gastar de más en cada prueba.
 */
async function cliProbarAgentes(nombreFiltro?: string) {
  const nombres = nombreFiltro
    ? [nombreFiltro as keyof typeof PROVEEDORES].filter((n) => n in PROVEEDORES)
    : (Object.keys(PROVEEDORES) as (keyof typeof PROVEEDORES)[]);

  if (nombreFiltro && nombres.length === 0) {
    console.error(`\nProveedor desconocido: ${nombreFiltro}`);
    console.error(`Opciones: ${Object.keys(PROVEEDORES).join(', ')}\n`);
    process.exit(1);
  }

  console.log('\n🔌 PROBANDO CONEXIÓN REAL\n');
  console.log('  (petición mínima, no simulada — cuesta lo mínimo posible en los de pago)\n');

  let algunoFallo = false;

  for (const nombre of nombres) {
    const proveedor = PROVEEDORES[nombre];

    if (!proveedor.disponible()) {
      console.log(`  ⬜ ${nombre.padEnd(8)} sin configurar, se salta`);
      continue;
    }

    if (!proveedor.local && !apiPagadaPermitida()) {
      algunoFallo = true;
      console.log(`  🔒 ${nombre.padEnd(8)} bloqueado: API pagada no permitida`);
      continue;
    }

    process.stdout.write(`  ⏳ ${nombre.padEnd(8)} preguntando…`);
    const inicio = Date.now();

    try {
      const respuesta = await proveedor.generar(
        'Responde ÚNICAMENTE este JSON exacto, sin nada más: {"ok":true}',
        'ping',
      );
      const ms = Date.now() - inicio;
      const parece_json = respuesta.trim().includes('"ok"');

      process.stdout.write(`\r  ✅ ${nombre.padEnd(8)} respondió en ${ms}ms`);
      console.log(parece_json ? '' : '  (respuesta rara, revisar formato)');
    } catch (e) {
      algunoFallo = true;
      const motivo = clasificarErrorProveedor(e);
      process.stdout.write(`\r  ❌ ${nombre.padEnd(8)} falló: ${motivo}\n`);
    }
  }

  console.log('');
  if (algunoFallo) process.exitCode = 1;
}

/**
 * Deja a Atlas corriendo: mina, opera sus bots y actualiza la competencia
 * cada N segundos hasta que se le pida parar. Es el modo que usa el servicio
 * systemd (ver GUIA_SELFHOSTING.md).
 */
async function cliCorrer(args: string[]) {
  const segundos = Number(args[0] ?? 60);

  // El tope evita desbordar el entero de 32 bits de setInterval: por encima,
  // Node colapsa el intervalo a 1 ms y el daemon entra en bucle cerrado.
  const MAX_SEGUNDOS = 86400; // un día

  if (!Number.isFinite(segundos) || segundos < 10 || segundos > MAX_SEGUNDOS) {
    console.error('\nUso: npm run atlas -- correr [segundos]');
    console.error(`Intervalo válido: entre 10 y ${MAX_SEGUNDOS} segundos.`);
    console.error('Por debajo de 10s los ciclos se pisarían entre sí.\n');
    process.exit(1);
  }

  const orquestador = new OrquestadorV08(DB_PATH);

  console.log(`\n🤖 ATLAS EN MARCHA — un ciclo cada ${segundos}s`);
  console.log('   Detener con Ctrl+C\n');

  orquestador.iniciar_ejecucion(segundos * 1000);

  // Apagado limpio: sin esto, Ctrl+C mataría el proceso a mitad de un ciclo
  // y dejaría la base de datos con un journal a medias.
  let apagando = false;
  const apagar = async (senal: string) => {
    // Segunda señal: si el apagado se quedó atascado (un ciclo que no termina),
    // hay que poder salir sin recurrir a SIGKILL.
    if (apagando) {
      console.log(`\n⚠️  ${senal} de nuevo: salida forzada.`);
      process.exit(1);
    }
    apagando = true;
    console.log(`\n\n📴 ${senal} recibido, apagando Atlas…`);

    let limpio = true;
    try {
      await orquestador.detener_y_esperar();
    } catch (e) {
      // Un fallo al guardar el estado final no debe impedir cerrar la base
      // de datos: sin este catch sería una promesa rechazada sin manejar y
      // el proceso moriría dejando SQLite abierto.
      limpio = false;
      console.error(`⚠️  Error al guardar el estado final: ${(e as Error).message}`);
    } finally {
      orquestador.cerrar();
    }

    console.log(limpio
      ? '✅ Atlas detenido limpiamente. El estado quedó guardado.\n'
      : '⚠️  Atlas detenido, pero el último estado pudo no guardarse.\n');
    process.exit(limpio ? 0 : 1);
  };

  process.on('SIGINT', () => void apagar('SIGINT'));
  process.on('SIGTERM', () => void apagar('SIGTERM'));

  // Red de seguridad: cualquier fallo no capturado debe tumbar el proceso con
  // código de error para que systemd lo reinicie, en vez de dejarlo a medias.
  process.on('unhandledRejection', (razon) => {
    console.error('💥 Fallo no manejado en Atlas:', razon);
    process.exit(1);
  });

  // Vigilante: si un ciclo se queda atascado, el proceso sigue vivo pero deja
  // de trabajar, y systemd no tendría forma de notarlo. Salir con error deja
  // que lo reinicie.
  const MAX_SALTOS = 5;
  const vigilante = setInterval(() => {
    if (orquestador.obtener_saltos_consecutivos() >= MAX_SALTOS) {
      console.error(`\n💥 ${MAX_SALTOS} ciclos seguidos atascados: Atlas dejó de trabajar.`);
      console.error('   Saliendo con error para que el servicio se reinicie.\n');
      clearInterval(vigilante);
      process.exit(1);
    }
  }, segundos * 1000);

  // Mantener vivo el proceso: el setInterval del orquestador ya lo hace, pero
  // esta promesa nunca resuelta deja explícito que el comando no termina solo.
  await new Promise<void>(() => {});
}

async function cliRespaldo(args: string[]) {
  const subcomando = args[0] ?? 'crear';

  switch (subcomando) {
    case 'crear': {
      console.log('\n💾 CREANDO RESPALDO\n');

      const { respaldos, eliminados } = await respaldarTodo([DB_PATH]);

      for (const r of respaldos) {
        console.log(`  ✅ ${r.origen} → ${r.destino} (${(r.tamano_bytes / 1024).toFixed(1)} KB)`);
      }
      if (eliminados.length > 0) {
        console.log(`  🗑️  ${eliminados.length} respaldo(s) viejo(s) eliminado(s) (retención: 7)`);
      }
      console.log('');
      break;
    }

    case 'listar': {
      const lista = listarRespaldos();

      if (lista.length === 0) {
        console.log('\nNo hay respaldos aún. Crea uno con: npm run atlas -- respaldo crear\n');
      } else {
        console.log(`\n💾 RESPALDOS (${lista.length})\n`);
        for (const r of lista) {
          console.log(`  ${r.archivo}  (${(r.tamano_bytes / 1024).toFixed(1)} KB)  ${r.fecha}`);
        }
        console.log('');
      }
      break;
    }

    default:
      console.error(`\nSubcomando de respaldo desconocido: ${subcomando}`);
      console.error('Uso: npm run atlas -- respaldo [crear|listar]\n');
      process.exit(1);
  }
}

async function cliCiclo() {
  const orquestador = new OrquestadorV08(DB_PATH);

  console.log('\n🚀 EJECUTANDO CICLO DE ATLAS\n');

  await orquestador.ejecutar_ciclo();
  const estado = await orquestador.obtener_estado();

  console.log(`  Nivel Atlas:       ${estado.nivel}`);
  console.log(`  Energía restante:  ${estado.energia_disponible}`);
  console.log(`  ETH generado hoy:  ${estado.eth_generado_hoy.toFixed(6)}`);
  console.log(`  Tú:                $${estado.portafolio_usuario.ganancia.toFixed(2)}`);
  console.log(`  Atlas:             $${estado.portafolio_atlas.ganancia.toFixed(2)}`);
  console.log(`  Líder:             ${estado.competencia.lider}`);
  console.log(`\n  💾 Snapshot guardado en datos/atlas-state.json\n`);

  orquestador.cerrar();
}

async function cliEstado() {
  const orquestador = new OrquestadorV08(DB_PATH);
  const persistido = orquestador.obtener_estado_persistido();

  if (!persistido) {
    console.log('\nAún no hay snapshot guardado. Ejecuta primero: npm run atlas -- ciclo\n');
    orquestador.cerrar();
    return;
  }

  console.log('\n📸 ÚLTIMO ESTADO PERSISTIDO\n');
  console.log(`  Última actualización:  ${persistido.ultima_actualizacion}`);
  console.log(`  Ciclos ejecutados:     ${persistido.ciclos_ejecutados}`);
  console.log(`  Ejecución activa:      ${persistido.ejecucion_activa ? 'sí' : 'no'}`);
  console.log(`  Nivel Atlas:           ${persistido.estado.nivel}`);
  console.log(`  Tú:                    $${persistido.estado.portafolio_usuario.ganancia.toFixed(2)}`);
  console.log(`  Atlas:                 $${persistido.estado.portafolio_atlas.ganancia.toFixed(2)}`);
  console.log(`  Líder:                 ${persistido.estado.competencia.lider}\n`);

  orquestador.cerrar();
}

async function cliMinar(args: string[]) {
  const mineria = new MotorMineria(DB_PATH);
  const energia = new GestorEnergia(DB_PATH);

  const subcomando = args[0];

  switch (subcomando) {
    case 'estado': {
      const estado = mineria.obtener_estado_hoy();
      console.log('\n⛏️  ESTADO DE MINERÍA HOY\n');
      console.log(`  Energía asignada:   ${estado.energia_asignada}%`);
      console.log(`  ETH generado:       ${estado.eth_generado_hoy.toFixed(6)} ETH`);
      console.log(`  Bloques minados:    ${estado.bloques_minados}`);
      console.log(`  Dificultad:         ${estado.dificultad.toFixed(2)}x`);
      console.log(`  Velocidad mining:   ${estado.velocidad_mining.toFixed(8)} ETH/h\n`);
      mineria.cerrar();
      energia.cerrar();
      break;
    }

    case 'ejecutar': {
      const energiaDisponible = Number(args[1] ?? 10);
      const energiaAsignada = Number(args[2] ?? 50);
      const nivel = Number(args[3] ?? 1);

      console.log(`\n⛏️  EJECUTANDO MINERÍA (${energiaDisponible} energía, nivel ${nivel})\n`);

      const resultado = mineria.minar_sesion(energiaDisponible, energiaAsignada, nivel);

      console.log(`  ✅ ${resultado.bloques.length} bloque(s) minado(s)`);
      console.log(`  💰 ${resultado.eth_total.toFixed(6)} ETH generado`);
      console.log(`  ⚡ ${resultado.energia_consumida} energía usada\n`);

      energia.consumir_energia('minar', resultado.energia_consumida, {
        eth_generado: resultado.eth_total,
        bloques: resultado.bloques.length,
      });

      mineria.cerrar();
      energia.cerrar();
      break;
    }

    case 'historial': {
      const registro = mineria.obtener_registro_hoy();

      if (registro.length === 0) {
        console.log('\nSin registros de minería hoy.\n');
      } else {
        console.log(`\n⛏️  HISTORIAL (${registro.length} registro(s))\n`);
        for (const r of registro.slice(0, 5)) {
          const hora = r.timestamp.slice(11, 19);
          console.log(`  ${hora}  ${r.eth_generado.toFixed(6)} ETH  dif:${r.dificultad.toFixed(2)}x`);
        }
        if (registro.length > 5) {
          console.log(`  ... ${registro.length - 5} más`);
        }
        console.log('');
      }

      mineria.cerrar();
      energia.cerrar();
      break;
    }

    default:
      console.error(`\nSubcomando de minar desconocido: ${subcomando || '(ninguno)'}`);
      console.error('Uso: npm run atlas -- minar [estado|ejecutar|historial]\n');
      process.exit(1);
  }
}

async function cliBots(args: string[]) {
  const bots = new MotorBots(DB_PATH);

  const subcomando = args[0];

  switch (subcomando) {
    case 'crear': {
      const nombre = args[1];
      const estrategia = args[2] as EstrategiaBot;
      const capital = Number(args[3] ?? 1000);
      const simbolo = (args[4] ?? 'BTC').toUpperCase();

      if (!nombre || !estrategia) {
        console.error('\nUso: npm run atlas -- bots crear <nombre> <estrategia> [capital] [simbolo]');
        console.error('Estrategias: dca, momentum, mean-reversion, buy-and-hold');
        console.error(`Símbolos: ${SIMBOLOS_SOPORTADOS.join(', ')}\n`);
        process.exit(1);
      }

      if (!esSimboloSoportado(simbolo)) {
        console.error(`\n❌ Símbolo no soportado: ${simbolo}`);
        console.error(`Atlas solo cotiza: ${SIMBOLOS_SOPORTADOS.join(', ')}\n`);
        process.exit(1);
      }

      console.log(`\n🤖 CREANDO BOT\n`);

      const bot = bots.crear_bot({
        nombre,
        estrategia,
        capital_inicial: capital,
        simbolos: [simbolo],
        parametros: {},
      });

      console.log(`  ✅ Bot creado: ${bot.id}`);
      console.log(`  Nombre:      ${bot.nombre}`);
      console.log(`  Estrategia:  ${bot.estrategia}`);
      console.log(`  Capital:     $${bot.capital_inicial}`);
      console.log(`  Estado:      ${bot.estado}\n`);

      bots.cerrar();
      break;
    }

    case 'listar': {
      const lista = bots.listar_bots();

      if (lista.length === 0) {
        console.log('\nNo hay bots creados aún.\n');
      } else {
        console.log(`\n🤖 BOTS (${lista.length})\n`);
        for (const bot of lista) {
          console.log(`  ${bot.nombre} (${bot.estrategia}) — id: ${bot.id}`);
          console.log(`    Estado:    ${bot.estado}`);
          console.log(`    Capital:   $${bot.capital_actual.toFixed(2)} / $${bot.capital_inicial.toFixed(2)}`);
          console.log(`    Trades:    ${bot.trades_ejecutados} ejecución(es)`);
          console.log(`    Win rate:  ${bot.win_rate.toFixed(1)}%`);
          console.log(`    Ganancia:  ${bot.ganancia_total.toFixed(4)} (${bot.ganancia_porcentaje.toFixed(2)}%)\n`);
        }
      }

      bots.cerrar();
      break;
    }

    case 'ejecutar': {
      const botId = args[1];
      const tipo = args[2] as 'compra' | 'venta';
      const simbolo = args[3];
      const cantidad = Number(args[4]);
      const precio = Number(args[5]);

      if (!botId || !tipo || !simbolo || !cantidad || !precio) {
        console.error('\nUso: npm run atlas -- bots ejecutar <bot-id> <compra|venta> <simbolo> <cantidad> <precio>\n');
        process.exit(1);
      }

      console.log(`\n🤖 EJECUTANDO ORDEN\n`);

      try {
        const orden = bots.ejecutar_orden_bot(botId, tipo, simbolo, cantidad, precio);

        console.log(`  ✅ Orden ejecutada`);
        console.log(`  Tipo:       ${orden.tipo}`);
        console.log(`  Símbolo:    ${orden.simbolo}`);
        console.log(`  Cantidad:   ${orden.cantidad}`);
        console.log(`  Precio:     $${orden.precio_entrada.toFixed(2)}`);
        if (orden.ganancia !== null) {
          console.log(`  Ganancia:   ${orden.ganancia.toFixed(4)} (${orden.ganancia_porcentaje?.toFixed(2)}%)`);
        }
        console.log(`  Estado:     ${orden.estado}\n`);
      } catch (e) {
        console.error(`  ❌ Error: ${(e as Error).message}\n`);
      }

      bots.cerrar();
      break;
    }

    default:
      console.error(`\nSubcomando de bots desconocido: ${subcomando || '(ninguno)'}`);
      console.error('Uso: npm run atlas -- bots [crear|listar|ejecutar]\n');
      process.exit(1);
  }
}

async function cliCompetencia(args: string[]) {
  const competencia = new GestorCompetencia(DB_PATH);

  const subcomando = args[0];

  switch (subcomando) {
    case 'estado': {
      const dias = Number(args[1] ?? 30);
      const stats = competencia.obtener_estadisticas(dias);

      console.log('\n🏆 COMPETENCIA TÚ VS ATLAS\n');
      console.log(`  Días jugados:       ${stats.dias_jugados}`);
      console.log(`  Tu ganancia total:  ${stats.usuario_ganancias.toFixed(4)}`);
      console.log(`  Atlas ganancia:     ${stats.atlas_ganancias.toFixed(4)}`);
      console.log(`  Tus días ganados:   ${stats.usuario_win_days}`);
      console.log(`  Días de Atlas:      ${stats.atlas_win_days}`);
      console.log(`  Empates:            ${stats.empates}`);
      console.log(`  Promedio tú:        ${stats.promedio_ganancia_usuario.toFixed(4)}`);
      console.log(`  Promedio Atlas:     ${stats.promedio_ganancia_atlas.toFixed(4)}\n`);

      competencia.cerrar();
      break;
    }

    case 'snapshot': {
      const [
        usuario_capital, usuario_ganancia, usuario_trades, usuario_win_rate,
        atlas_capital, atlas_ganancia, atlas_trades, atlas_bots_activos, atlas_win_rate,
      ] = args.slice(1).map(Number);

      const snap = competencia.crear_snapshot(
        usuario_capital ?? 10000, usuario_ganancia ?? 0, usuario_trades ?? 0, usuario_win_rate ?? 0,
        atlas_capital ?? 10000, atlas_ganancia ?? 0, atlas_trades ?? 0, atlas_bots_activos ?? 0, atlas_win_rate ?? 0
      );

      console.log('\n📸 SNAPSHOT TOMADO\n');
      console.log(`  Tú:     ${snap.usuario.ganancia.toFixed(4)} (${snap.usuario.ganancia_porcentaje.toFixed(2)}%)`);
      console.log(`  Atlas:  ${snap.atlas.ganancia.toFixed(4)} (${snap.atlas.ganancia_porcentaje.toFixed(2)}%)`);
      console.log(`  Líder:  ${snap.lider}\n`);

      competencia.cerrar();
      break;
    }

    case 'registrar': {
      const usuario_ganancia = Number(args[1] ?? 0);
      const usuario_capital_inicial = Number(args[2] ?? 10000);
      const atlas_ganancia = Number(args[3] ?? 0);
      const atlas_capital_inicial = Number(args[4] ?? 10000);

      console.log(`\n📊 REGISTRANDO RESULTADO DIARIO\n`);

      competencia.registrar_resultado_diario(
        usuario_ganancia, usuario_capital_inicial, atlas_ganancia, atlas_capital_inicial
      );

      console.log(`  ✅ Resultado registrado`);
      console.log(`  Tú:     ${usuario_ganancia.toFixed(4)}`);
      console.log(`  Atlas:  ${atlas_ganancia.toFixed(4)}\n`);

      competencia.cerrar();
      break;
    }

    default:
      console.error(`\nSubcomando de competencia desconocido: ${subcomando || '(ninguno)'}`);
      console.error('Uso: npm run atlas -- competencia [estado|snapshot|registrar]\n');
      process.exit(1);
  }
}
