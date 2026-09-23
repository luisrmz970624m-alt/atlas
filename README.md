# Atlas V0.6.1

Asistente local, educativo y supervisado. Corre en tu máquina, enseña a programar, registra todo lo que hace.

Esta primera pieza es el **registro auditable**: el cimiento sobre el que se apoya
todo lo demás. Si el historial se puede alterar en silencio, el Supervisor, los
límites y las aprobaciones no valen nada.

## Requisitos

Node.js 22 o superior. Nada más — sin dependencias, sin `npm install`, sin
compilación. TypeScript corre directo gracias a `--experimental-strip-types`.

## Uso

```bash
npm run atlas                          # ayuda
npm run atlas -- estudiar              # qué toca hoy (y crea la lección)
npm run atlas -- responder funciones   # crea la plantilla de tu respuesta
npm run atlas -- evaluar funciones     # ejecuta tu código y lo revisa
npm run atlas -- practique funciones   # registro manual, si Atlas se equivoca
npm run atlas -- progreso              # tu avance en el temario
npm run atlas -- objetivo "..."        # planea, ejecuta y comprueba
npm run atlas -- memoria               # qué recuerda Atlas
npm run atlas -- memoria typescript    # buscar en la memoria
npm run atlas -- olvidar 7             # ordenar que olvide un recuerdo
npm run atlas -- exportar              # volcar la memoria en JSON
npm run atlas -- ver 20                # últimos 20 eventos del registro
npm run atlas -- auditar               # verifica la cadena completa
npm run atlas -- limites               # límites de seguridad vigentes

npm run prueba                         # 104 pruebas
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
src/curso.ts         Temario, progreso y repasos espaciados.
src/evaluacion.ts    Ejecuta tu respuesta y la revisa contra el enunciado.
src/modelo.ts        Conexión con Ollama, en streaming.
src/ciclo.ts         El ciclo completo, con aprendizaje del rechazo.
src/atlas.ts         Línea de comandos.
pruebas/             101 pruebas, ninguna necesita el modelo.
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
sí hace **detectable cualquier alteración**. Por eso es un registro resistente, no inmutable.

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

## El profesor

Catorce temas en tres niveles, de la terminal a modificar el propio Atlas. Cada
tema declara sus requisitos, y un tema no se abre hasta que los suyos están
practicados.

Dos distinciones que sostienen todo:

**Generar material no es aprenderlo.** Atlas puede escribir una lección
impecable sin que tú la hayas leído. Por eso "material" (Atlas hizo la lección)
y "practicado" (tú hiciste el ejercicio y lo dijiste) son estados distintos, y
solo el segundo desbloquea lo que viene después.

**Practicar una vez no es dominar.** Hacen falta dos prácticas en días
distintos. Dos veces el mismo día cuentan como una: eso separa "lo entendí en el
momento" de "me quedó".

Los repasos se espacian 1, 3, 7, 14 y 30 días. Un repaso vencido siempre gana al
tema nuevo: lo ya aprendido se pierde si no se refresca.

## La evaluación

Si el modelo fuera el único juez del ejercicio, volveríamos al problema de
siempre: alguien poniéndose su propia nota. Para código hay algo mejor que una
opinión — **ejecutarlo**.

Por eso la evaluación tiene dos capas, y no valen lo mismo:

1. **Ejecución** — hecho comprobable. Tu código corre o no corre, con tope de
   diez segundos para que un bucle sin fin no cuelgue nada. Si revienta, no hay
   discusión: el ejercicio no cuenta.
2. **Revisión del modelo** — opinión. Dice si tu respuesta hace lo que pedía el
   enunciado. Se guarda en la memoria como **deducción**, nunca como hecho, con
   su nivel de confianza.

Un código que corre pero no resuelve el ejercicio no aprueba. Un código que
resuelve el ejercicio pero no compila, tampoco. Hacen falta las dos.

Cuando apruebas, la práctica se registra sola. Si crees que Atlas se equivocó,
`practique <tema>` la registra a mano: la última palabra es tuya, y queda en el
registro que fue tuya.

## Siguiente paso

**V0.6.1 (actual):** Terminal simulada. Tema nuevo `filesystem` con node:fs.

**V0.7:** Planificador y tareas programadas. Especificar objetivos, ejecutarlos paso a paso, verificar resultado.

**V0.8:** Asistente de trading educativo con capital ficticio. Simulación completa, sin dinero real.

**V0.9:** Interfaz web/móvil. Audio de lecciones. Copias de seguridad automáticas.

**V1.0:** Asistente estable. Documentación completa. Listo para uso prolongado.

**Largo plazo:** `chattr +a` sobre registro, firmas HMAC, copias externas.
