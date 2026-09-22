# Atlas V0.1

Asistente autónomo local, educativo y supervisado.

Esta primera pieza es el **registro auditable**: el cimiento sobre el que se apoya
todo lo demás. Si el historial se puede alterar en silencio, el Supervisor, los
límites y las aprobaciones no valen nada.

## Requisitos

Node.js 22 o superior. Nada más — sin dependencias, sin `npm install`, sin
compilación. TypeScript corre directo gracias a `--experimental-strip-types`.

## Uso

```bash
npm run atlas                          # ayuda
npm run atlas -- objetivo "..."        # planea, ejecuta y comprueba
npm run atlas -- memoria               # qué recuerda Atlas
npm run atlas -- memoria typescript    # buscar en la memoria
npm run atlas -- olvidar 7             # ordenar que olvide un recuerdo
npm run atlas -- exportar              # volcar la memoria en JSON
npm run atlas -- ver 20                # últimos 20 eventos del registro
npm run atlas -- auditar               # verifica la cadena completa
npm run atlas -- limites               # límites de seguridad vigentes

npm run prueba                         # 62 pruebas
```

Modelo: se elige con `ATLAS_MODELO` (por defecto `qwen2.5-coder:14b`).

```bash
ATLAS_MODELO=qwen2.5-coder:7b npm run atlas -- objetivo "..."
```

## Estructura

```
src/tipos.ts         Forma de los datos. Sin lógica.
src/registro.ts      Escritura solo-agregado y verificación de la cadena.
src/supervisor.ts    Única puerta al registro. Separa la acción del dato.
src/herramientas.ts  Las cuatro capacidades, encerradas en laboratorio/.
src/verificacion.ts  Comprobaciones que se ejecutan contra el disco.
src/estandares.ts    La vara de calidad que el modelo no puede negociar.
src/memoria.ts       Memoria persistente en SQLite, en cinco espacios.
src/modelo.ts        Conexión con Ollama, en streaming.
src/ciclo.ts         El ciclo completo, con aprendizaje del rechazo.
src/atlas.ts         Línea de comandos.
pruebas/             62 pruebas, ninguna necesita el modelo.
datos/               registro.jsonl y memoria.db (no se versionan).
laboratorio/         Donde Atlas trabaja. No puede salir de aquí.
respaldos/           Copias diarias (aún no automatizadas).
```

## Cómo funciona la cadena

Cada evento guarda la huella SHA-256 del anterior. El primero apunta a
`genesis`. Auditar recorre la cadena y comprueba tres cosas por evento:

1. Que su huella corresponda a su contenido.
2. Que apunte a la huella del anterior.
3. Que los identificadores sean consecutivos.

Cambiar una sola letra de un evento pasado rompe las tres. Borrar un evento del
medio rompe las dos últimas. No impide que alguien borre el archivo entero, pero
sí hace **imposible la alteración silenciosa**.

Compruébalo tú mismo:

```bash
npm run atlas -- anotar "prueba"
sed -i '1s/prueba/otra cosa/' datos/registro.jsonl
npm run atlas -- auditar     # 🚨 detectado
```

## Reglas de diseño que no se rompen

- En `registro.ts` no existe ninguna función que borre o edite. Esa ausencia es
  la garantía, no un descuido.
- El agente nunca escribe en el registro directo: pasa por `supervisor.ts`.
- Las huellas las calcula el Supervisor, nunca el agente.
- Un permiso negado se registra igual que uno concedido.
- Contraseñas, claves y tokens nunca entran al registro. Se anota *que* se usó
  una credencial y cuál, jamás su contenido.

## La memoria

Cinco espacios que no se mezclan: `personal`, `programacion`, `trading`,
`simulaciones`, `sistema`. Un resultado ficticio de trading no puede acabar
confundido con una operación real.

Cada recuerdo lleva origen, fuente, fecha, confianza y estado. Una deducción se
marca como deducción, nunca como hecho. Un dato nuevo **supera** al viejo en vez
de borrarlo, así que la historia se conserva. Olvidar es una orden tuya y queda
registrada. Y nunca se guardan contraseñas, claves ni tokens.

Lo que hace útil todo esto: antes de planear, Atlas consulta cómo terminaron los
intentos anteriores del mismo objetivo y se los pasa al modelo. Eso es lo que lo
hace dejar de empezar de cero.

## Siguiente paso

1. Aislar el registro con permisos de solo-agregado del sistema de archivos
   (`chattr +a`), para que ni un error de código pueda sobrescribirlo.
2. Planificador y tareas programadas (V0.5).
3. Agentes especializados: profesor de programación y de trading (V0.6).
