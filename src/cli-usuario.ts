// Comandos de trading MANUAL del usuario: el lado "Tú" de la competencia
// contra los bots de Atlas. Dinero simulado, precios reales.

import { TradingEngine, USUARIO_ID, CAPITAL_INICIAL_USUARIO } from './trading.ts';
import {
  GeneradorPreciosRealtime,
  SIMBOLOS_SOPORTADOS,
  esSimboloSoportado,
} from './precios-realtime.ts';

const DB_PATH = process.env.ATLAS_DB ?? 'datos/atlas.db';

export async function ejecutarCLIUsuario(comando: string, args: string[]) {
  switch (comando) {
    case 'portafolio':
      return await cliPortafolio();
    case 'comprar':
      return await cliOperar('compra', args);
    case 'vender':
      return await cliOperar('venta', args);
    default:
      console.error(`Comando de usuario desconocido: ${comando}`);
      process.exit(1);
  }
}

async function cliPortafolio() {
  const trading = new TradingEngine(DB_PATH);
  const precios = new GeneradorPreciosRealtime(DB_PATH);

  try {
    const portafolio = trading.asegurar_portafolio(USUARIO_ID, CAPITAL_INICIAL_USUARIO);
    const posiciones = trading.obtener_posiciones(portafolio.id);
    const stats = trading.obtener_estadisticas(portafolio.id);

    // Una sola consulta para todos los símbolos en cartera: así se aprovecha
    // la caché de 60s en vez de pedir cada símbolo por separado.
    const precios_actuales: Record<string, number> = {};
    if (posiciones.length > 0) {
      const cotizaciones = await precios.obtener_precios(posiciones.map((p) => p.simbolo));
      for (const [simbolo, p] of Object.entries(cotizaciones)) {
        precios_actuales[simbolo] = p.precio;
      }
    }

    const valor_total = trading.calcular_valor_portafolio(portafolio.id, precios_actuales);
    const pnl = trading.calcular_pnl(portafolio.id, precios_actuales);
    const ganancia = valor_total - portafolio.capital_inicial;
    const pct = portafolio.capital_inicial > 0
      ? (ganancia / portafolio.capital_inicial) * 100
      : 0;

    console.log('\n💼 TU PORTAFOLIO\n');
    console.log(`  Capital inicial:   $${portafolio.capital_inicial.toFixed(2)}`);
    console.log(`  Efectivo:          $${portafolio.capital_actual.toFixed(2)}`);
    console.log(`  Valor total:       $${valor_total.toFixed(2)}`);
    console.log(`  Ganancia:          $${ganancia.toFixed(2)} (${pct.toFixed(2)}%)`);

    if (posiciones.length === 0) {
      console.log('\n  Sin posiciones abiertas.');
      console.log('  Compra con: npm run atlas -- comprar BTC 0.01\n');
    } else {
      console.log('\n  POSICIONES:');
      for (const pos of posiciones) {
        const precio_hoy = precios_actuales[pos.simbolo] ?? pos.precio_promedio;
        const valor = pos.cantidad * precio_hoy;
        const dif = (precio_hoy - pos.precio_promedio) * pos.cantidad;
        const signo = dif >= 0 ? '+' : '';
        console.log(`    ${pos.simbolo}  ${pos.cantidad}  @ $${pos.precio_promedio.toFixed(2)} → $${precio_hoy.toFixed(2)}  valor $${valor.toFixed(2)}  ${signo}$${dif.toFixed(2)}`);
      }
      console.log('');
    }

    console.log('  OPERACIONES CERRADAS:');
    console.log(`    Total:       ${stats.operaciones_cerradas}`);
    console.log(`    Ganadoras:   ${stats.ganadoras}`);
    console.log(`    Perdedoras:  ${stats.perdedoras}`);
    console.log(`    Win rate:    ${stats.win_rate.toFixed(1)}%`);
    console.log(`    PnL cerrado: $${stats.pnl_realizado.toFixed(2)}`);
    console.log(`    PnL abierto: $${pnl.pnl_no_realizado.toFixed(2)}\n`);
  } finally {
    precios.cerrar();
    trading.cerrar();
  }
}

async function cliOperar(tipo: 'compra' | 'venta', args: string[]) {
  const simbolo = args[0]?.toUpperCase();
  const cantidad = Number(args[1]);
  const precio_manual = args[2] !== undefined ? Number(args[2]) : undefined;

  const verbo = tipo === 'compra' ? 'comprar' : 'vender';

  if (!simbolo || !Number.isFinite(cantidad) || cantidad <= 0) {
    console.error(`\nUso: npm run atlas -- ${verbo} <simbolo> <cantidad> [precio]`);
    console.error(`Ejemplo: npm run atlas -- ${verbo} BTC 0.01`);
    console.error(`Símbolos: ${SIMBOLOS_SOPORTADOS.join(', ')}`);
    console.error('Si omites el precio, se usa el precio de mercado actual.\n');
    process.exit(1);
  }

  // Sin esta validación se podría comprar cualquier ticker inventado: el
  // generador le pondría un precio base de $100 y la posición quedaría fuera
  // del marcador de la competencia.
  if (!esSimboloSoportado(simbolo)) {
    console.error(`\n❌ Símbolo no soportado: ${simbolo}`);
    console.error(`Atlas solo cotiza: ${SIMBOLOS_SOPORTADOS.join(', ')}\n`);
    process.exit(1);
  }

  if (precio_manual !== undefined && (!Number.isFinite(precio_manual) || precio_manual <= 0)) {
    console.error('\nEl precio debe ser un número mayor que cero.\n');
    process.exit(1);
  }

  const trading = new TradingEngine(DB_PATH);
  const precios = new GeneradorPreciosRealtime(DB_PATH);

  try {
    const portafolio = trading.asegurar_portafolio(USUARIO_ID, CAPITAL_INICIAL_USUARIO);

    let precio = precio_manual;
    let fuente = 'manual';
    if (precio === undefined) {
      const mercado = await precios.obtener_precio(simbolo);
      precio = mercado.precio;
      fuente = mercado.fuente;
    }

    const orden = tipo === 'compra'
      ? trading.comprar(portafolio.id, simbolo, cantidad, precio)
      : trading.vender(portafolio.id, simbolo, cantidad, precio);

    const actualizado = trading.obtener_portafolio(portafolio.id)!;

    console.log(`\n${tipo === 'compra' ? '🟢 COMPRA' : '🔴 VENTA'} EJECUTADA\n`);
    console.log(`  ${orden.cantidad} ${orden.simbolo} @ $${orden.precio.toFixed(2)} (${fuente})`);
    console.log(`  Comisión:  $${orden.comision.toFixed(2)}`);
    console.log(`  Efectivo:  $${actualizado.capital_actual.toFixed(2)}\n`);
    console.log('  Mira cómo vas: npm run atlas -- portafolio\n');
  } catch (e) {
    // Errores esperables del motor: capital insuficiente, posición inexistente.
    console.error(`\n❌ No se pudo ${verbo}: ${(e as Error).message}\n`);
    process.exitCode = 1;
  } finally {
    precios.cerrar();
    trading.cerrar();
  }
}
