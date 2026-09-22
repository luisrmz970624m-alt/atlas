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
npm run atlas -- anotar "texto"        # escribe un evento
npm run atlas -- permiso "instalar X"  # pregunta al Supervisor
npm run atlas -- ver 20                # últimos 20 eventos
npm run atlas -- auditar               # verifica la cadena completa
npm run atlas -- limites               # límites de seguridad vigentes

npm run prueba                         # 8 pruebas
```

## Estructura

```
src/tipos.ts       Forma de los datos. Sin lógica.
src/registro.ts    Escritura solo-agregado y verificación de la cadena.
src/supervisor.ts  Única puerta al registro. Clasifica en verde/amarillo/rojo.
src/atlas.ts       Línea de comandos.
pruebas/           Pruebas, incluidas las de detección de manipulación.
datos/             registro.jsonl (no se versiona).
laboratorio/       Espacio de simulación (vacío por ahora).
respaldos/         Copias diarias (aún no automatizadas).
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

## Siguiente paso

Tres cosas, en este orden:

1. Aislar el registro con un usuario propio y permisos de solo-agregado del
   sistema de archivos (`chattr +a`), para que ni siquiera un error de código
   pueda sobrescribirlo.
2. La memoria SQLite (V0.3 en la ruta de versiones).
3. El ciclo central conectado a `qwen2.5-coder:14b` vía Ollama.
