# Estado de fases Atlas

## Correccion B 1

- Estado: verificada.
- Commit: `b1542c9`.
- Alcance: validacion persistente de experiencias, presupuesto conservador, orden por relevancia, historial y migracion de resúmenes, saneamiento de registro, proveedores inyectables y bloqueo de coste en la ruta heredada.
- Verificacion: `ATLAS_SIN_RED=true ATLAS_PERMITIR_API_PAGADA=false npm run prueba` resulto en 232 pruebas verdes.
- Limites: no se activo ninguna API de pago, no se uso secreto ni se hizo una llamada de red.

## Entrega C

- Estado: verificada; pendiente del commit de fase.
- Alcance permitido: datos históricos locales validados, estrategias declarativas y backtester reproducible.
- Excluido: recomendaciones financieras, servicios externos, broker, MT5, paper trading y cualquier orden.
- Verificacion: `npm run prueba` resulto en 237 pruebas verdes con `ATLAS_SIN_RED=true` forzado por el script.

## Entrega D

- Estado: verificada; pendiente del commit de fase.
- Alcance permitido: validacion fuera de muestra, walk-forward y observacion paper interna.
- Excluido: broker, MT5, credenciales y envio de ordenes.
- Verificacion: `npm run prueba` resulto en 240 pruebas verdes, sin red.

## Entrega E

- Estado: implementación local verificada; conexión real pendiente.
- Arquitectura: cliente Atlas de solo lectura y protocolo inyectable; el servidor real será un bridge local privado dentro de una VM Windows aislada.
- Controles: `TRADING_MODE=DEMO_ONLY`, `REAL_TRADING=false`, cuenta DEMO obligatoria, timeouts, reconexión limitada, validación de mensajes y sin métodos de escritura.
- Verificación local: fake DEMO para estado, cuenta, símbolos, tick, velas, posiciones e historial; rechaza cuenta real, datos corruptos, timeout, desconexión y operaciones no permitidas.
- Pendiente externo: crear VM Windows, instalar MT5, elegir broker/servidor DEMO, login manual y comprobar el bridge real. No se han realizado estas acciones.

## Entrega G

- Estado: verificada y comprometida (`c52fc0b`).
- Alcance: Empresa Simulator sintético y reproducible: clientes, proveedores, empleados, productos, inventario, ventas, compras, FacturaSimulada, NominaSimulada, banco interno y ledger de doble partida simplificado.
- Invariantes: sin datos personales, fiscales, bancarios ni pagos reales; no hay stock negativo y los estados financieros llevan etiqueta `SIMULACIÓN`.
- Pruebas: 249/249 verdes offline. MT5 real sigue pendiente.
- Cierre de auditoría: reservas, liberación/consumo, devoluciones, mermas e idempotencia por `eventId` implementados y probados. La idempotencia se conserva en snapshots; su retención es deliberadamente ilimitada dentro de una simulación finita.

## Entrega H

- Estado: verificada y comprometida (`5d4974f`).
- Alcance: reloj virtual sin `Date.now`, scheduler de eventos, velocidades lógicas, escenarios sintéticos y checkpoints reproducibles.
- Pruebas: 250/250 verdes offline. No se consumen servicios externos.
- Cierre de auditoría: snapshots empresariales serializables incluyen estado de empresa, inventario, reservas, ventas, devoluciones, mermas, ledger e IDs procesados. Eventos pendientes se restauran como descriptores con resolver explícito; ramas restauradas no comparten referencias.

## Entrega I

- Estado: verificada y comprometida.
- Alcance: orquestador local de workers lógicos de trading y empresa, cola con prioridades, límites globales y por dominio, perfiles `INTERACTIVE`/`NIGHT`, eventos seguros y resumen agregado.
- Invariantes: estado y configuración se clonan por worker; un fallo queda aislado; las transiciones inválidas se rechazan; `NIGHT` conserva `TRADING_MODE=DEMO_ONLY` y `REAL_TRADING=false`.
- Verificación: 254/254 pruebas verdes con `ATLAS_SIN_RED=true`; no usa procesos del SO, red, secretos ni MT5 real.

## Entrega J

- Estado: verificada y comprometida.
- Alcance: memoria empresarial SQLite aislada, experiencias con evaluación separada del resultado financiero, política configurable de evidencia, comparación con pesos explícitos e historial de resúmenes.
- Invariantes: ningún caller puede insertar `VALIDADA`; una regla crítica rota produce rechazo aun con ganancia; validar exige varias ejecuciones, seeds y escenarios.
- Verificación: 257/257 pruebas verdes offline. El esquema es nuevo y aditivo; no se migró ni alteró la memoria existente de trading.

## Entrega K

- Estado: verificada y comprometida.
- Alcance: contrato interno serializable para el panel El Vórtice, agregador de empresa, trading, simulaciones, memoria, auditoría, recursos y alertas, con polling local mínimo.
- Etiquetas: toda métrica empresarial se marca `simulated`; recursos reales quedan `UNAVAILABLE`; bridge MT5 local aparece implementado y MT5 real permanece `PENDIENTE`.
- Verificación: 259/259 pruebas verdes offline, sin frontend, red, credenciales ni datos de una cuenta MT5.

## Entrega L

- Estado: verificada y comprometida.
- Documentación: `docs/arquitectura-actual.md` distingue explícitamente implementado, probado, simulado y pendiente; MT5 real permanece pendiente.
- Auditoría final: no hay `Math.random` ni `Date.now` en los módulos de empresa/orquestador; los únicos accesos de red encontrados pertenecen a proveedores/precios opt-in y no son requisito de la suite.
- Hallazgos: un comentario heredado contiene `TODO`; no representa trabajo ejecutable pendiente. Las coincidencias de secretos son validadores, documentación o datos de prueba, sin valor sensible detectado.
- Verificación inicial: `npm run prueba` finalizó con 259/259 pruebas verdes y `ATLAS_SIN_RED=true`.
- Auditoría posterior: `16af00c` añadió regresiones de atomicidad, centavos, checkpoints, calendario y parada de workers; la suite cerró con 266/266 pruebas verdes offline.
- Cierre de hallazgos: la suite posterior de inventario completo y snapshots cerró con 271/271 pruebas verdes offline.

## Entrega N

- Estado: implementada y probada localmente.
- Alcance: cerebro empresarial estrictamente simulado. Las políticas reciben `BusinessObservation` congelada y solo pueden producir `BusinessDecisionProposal` declarativas; la única frontera de ejecución aplica validación, `Supervisor` central y handlers limitados a compra, reserva, liberación de reserva o `HOLD`.
- Vórtice: `VorticeBusinessPolicy` consume el contrato inyectable `Generador`; la suite usa únicamente un fake determinista. Ollama, Claude y OpenAI no son requisito ni se invocan.
- Seguridad: acciones no implementadas se marcan `UNAVAILABLE`; JSON inválido, IDs inexistentes, números no finitos, rechazo del Supervisor y fallos de handler no mutan la empresa. No se expone shell, red, archivos arbitrarios, MT5, banca, SAT/CFDI ni pagos reales.
- Memoria y auditoría: cada tick registra evidencia operativa concisa en memoria empresarial sin escribir `VALIDADA` directamente, y conserva un evento de auditoría sin prompts, chain-of-thought ni secretos.
- Verificación: 281/281 pruebas verdes con `ATLAS_SIN_RED=true`. Las entregas O, P, Q y R continúan pendientes.
