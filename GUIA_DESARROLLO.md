# Guía de Desarrollo — Cómo extender Atlas

Esta guía es para ti si quieres agregar:
- Nuevos temas al currículo
- Nuevas herramientas
- Nuevos estándares de calidad
- Nuevas capacidades

---

## Agregar un tema nuevo

**Archivo:** `src/curso.ts`, array `TEMARIO`.

### Paso 1: Definir el tema

```typescript
export const TEMARIO: Tema[] = [
  // ... temas existentes ...
  { 
    id: 'mi-tema',
    titulo: 'título corto del tema',
    nivel: 1,  // 1, 2 o 3
    requiere: ['variables'],  // IDs de temas que deben estar practicados
    objetivo: 'crear una lección sobre [qué] que enseñe [qué]'
  },
];
```

**Reglas:**
- `id`: sin espacios, kebab-case
- `nivel`: 1 (básico), 2 (intermedio), 3 (avanzado)
- `requiere`: lista de IDs existentes, en orden de dependencia
- `objetivo`: frase que activa un estándar (contiene palabra clave como "lección", "ejercicio")

### Paso 2: Escribir prueba

**Archivo:** `pruebas/prueba-curso.ts`.

```typescript
test('mi-tema se abre después de variables', () => {
  const m = nueva();
  assert.equal(disponible(m, tema('mi-tema')!), false, 'aún falta variables');
  
  registrarPractica(m, 'variables');
  assert.equal(disponible(m, tema('mi-tema')!), true, 'ahora se abre');
});
```

### Paso 3: Verificar

```bash
npm run prueba
```

### Paso 4: Generar lección

```bash
npm run atlas -- estudiar
```

El tema aparecerá en el orden correcto si sus requisitos están practicados.

---

## Agregar un estándar de calidad

**Archivo:** `src/estandares.ts`, array `ESTANDARES`.

### Ejemplo: Estándar para "ejercicio interactivo"

```typescript
{
  tipo: 'ejercicio-interactivo',
  descripcion: 'Un ejercicio pedirá entrada del usuario y procesará salida',
  senales: /\binteractivo\b|\bconsole\.read\b/i,
  exigir: () => [
    { tipo: 'contiene', valor: 'console.log', texto: 'solicita entrada al usuario' },
    { tipo: 'contiene', valor: 'readFileSync', texto: 'lee entrada (stdin)' },
    { tipo: 'min_lineas', valor: 15, texto: 'el material suma al menos 15 líneas' },
  ],
}
```

**Reglas:**
- `senales`: regex que identifica cuándo aplica este estándar
- `exigir()`: lista de comprobaciones (tipos en `src/verificacion.ts`)

**Tipos de verificación disponibles:**
- `existe`: archivo existe
- `min_bytes`: archivo ≥ N bytes
- `min_lineas`: archivo ≥ N líneas
- `contiene`: archivo contiene substring
- `no_contiene`: archivo NO contiene substring
- `sin_solucion`: enunciado no viene resuelto en el mismo archivo

### Agregarlo a `ESTANDARES`

```typescript
export const ESTANDARES: Estandar[] = [
  { ... existentes ... },
  { tipo: 'ejercicio-interactivo', ... },
];
```

### Verificar

```bash
npm run prueba
```

El estándar se aplica automáticamente si el objetivo contiene palabra clave.

---

## Agregar una herramienta nueva

**Archivo:** `src/herramientas.ts`.

### Ejemplo: Herramienta para ejecutar Node.js

```typescript
export async function ejecutar_codigo(args: { ruta: string; args_node?: string }): Promise<Resultado> {
  const destino = rutaSegura(args.ruta ?? '');
  if (!existsSync(destino)) {
    return { exito: false, error: `No existe ${args.ruta}` };
  }

  const inicio = Date.now();
  const r = spawnSync(
    process.execPath,
    ['--experimental-strip-types', destino],
    { cwd: LABORATORIO, timeout: 10000, encoding: 'utf8' },
  );
  const ms = Date.now() - inicio;

  return {
    exito: r.status === 0,
    salida: r.stdout?.trim() ?? '',
    error: r.stderr?.trim() ?? '',
    ms,
  };
}
```

### Registrarla en `HERRAMIENTAS`

**Archivo:** `src/ciclo.ts`, constante `HERRAMIENTAS`.

```typescript
const HERRAMIENTAS = {
  ejecutar_codigo: { ... descripción ... },
  // ... otras herramientas ...
};
```

### Seguridad

**SIEMPRE:**
- Llama `rutaSegura()` para validar rutas
- Usa `LABORATORIO` como `cwd`
- Filtra variables de entorno peligrosas
- Implementa timeouts

**NUNCA:**
- Ejecutes comandos shell directo (`sh -c`)
- Confíes en rutas del usuario sin validar
- Dejes datos sensibles en salida

---

## Agregar prueba de end-to-end

**Archivo:** `pruebas/prueba-ciclo.ts` (ya hay muchas).

### Ejemplo: Probar un tema completo

```typescript
test('terminal: generar → responder → evaluar → dominar', async () => {
  const m = nueva();
  const memo = new Memoria(':memory:');

  // 1. Generar lección (simula Ollama)
  const genero = await generarLeccion('terminal', 'navegar en terminal', generadorFalso);
  registrarMaterial(memo, 'terminal', genero.archivos);

  // 2. Responder
  const respuesta = plantilla('terminal', 'ejercicio');
  assert.match(respuesta, /Escribe tu solución/);

  // 3. Evaluar (día 1)
  const r1 = await evaluarRespuesta(genero.archivos[0]!, respuesta, generadorFalso);
  assert.equal(r1.aprobado, true);
  registrarPractica(memo, 'terminal', '2026-09-22');

  // 4. Evaluar (día 2)
  registrarPractica(memo, 'terminal', '2026-09-23');
  const a = avanceDe(memo, 'terminal');
  assert.equal(a.estado, 'dominado');
  
  memo.cerrar();
});
```

### Patrones útiles

**Generador falso de texto:**
```typescript
const generadorFalso = async (sistema, prompt) => JSON.stringify({
  cumple: true,
  aciertos: ['cumplió todo'],
  faltantes: [],
  pista: 'bien hecho'
});
```

**Memoria en RAM (no toca disco):**
```typescript
const m = new Memoria(':memory:');
```

---

## Modificar el ciclo central

**Archivo:** `src/ciclo.ts`.

Si necesitas cambiar cómo Atlas planifica o ejecuta objetivos:

### Estructura del `Plan`:

```typescript
export interface Plan {
  version: number;
  objetivo: string;
  pasos: Paso[];
  criterio_final: string;
  presupuesto: { tiempo_min: number; tiempo_max: number };
}

export interface Paso {
  n: number;
  nivel: 'verde' | 'amarillo' | 'rojo';
  descripcion: string;
  herramienta: string;
  argumentos: Record<string, unknown>;
  verificacion: Verificacion | null;
  ajustada?: boolean;
}
```

### Modificar prompts al modelo

**Función:** `instrucciones(objetivo)` — es donde se le dice al modelo cómo comportarse.

```typescript
export function instrucciones(objetivo: string): string {
  const estandar = estandarPara(objetivo);
  const lista = estandar?.exigir().map(e => `- ${e.texto}`).join('\n') ?? '';
  return `${SISTEMA_BASE}\n\nEstándar: ${lista}`;
}
```

Cambiar `SISTEMA_BASE` es cambiar cómo piensa Atlas.

---

## Debugging

### Ver qué está haciendo Atlas

**Registro completo:**
```bash
npm run atlas -- ver 50
```

**Memoria:**
```bash
npm run atlas -- memoria
npm run atlas -- exportar | jq .
```

**Auditar:**
```bash
npm run atlas -- auditar
```

### Logs durante ejecución

Agrega `console.log()` en el código. Atlas no los redirige al registro.

```typescript
// En src/ciclo.ts
console.log(`[DEBUG] Plan versión ${plan.version}, ${plan.pasos.length} pasos`);
console.log(`[DEBUG] Paso ${p.n}: ${p.descripcion}`);
```

Corre con:
```bash
npm run atlas -- objetivo "..." 2>&1 | grep "\[DEBUG\]"
```

---

## Testing local

```bash
# Todas las pruebas
npm run prueba

# Solo un archivo
npm run prueba -- pruebas/prueba-curso.ts

# Solo una prueba
npm run prueba -- --grep "DOMINAR"
```

---

## Pasos antes de hacer commit

1. **Pruebas pasan:**
   ```bash
   npm run prueba
   ```

2. **Auditar registro:**
   ```bash
   npm run atlas -- auditar
   ```

3. **Verificar git:**
   ```bash
   git status
   git diff --stat
   ```

4. **Commit con mensaje claro:**
   ```bash
   git add -A
   git commit -m "Atlas: [qué cambió]

   Explicación de por qué y qué afecta."
   ```

---

## Contribuir mejoras

Si quieres mejorar Atlas:

1. **Crea una rama:**
   ```bash
   git checkout -b feature/mi-mejora
   ```

2. **Haz cambios, prueba, documenta:**
   - Agrega pruebas para la mejora
   - Actualiza ESTADO.md si es significativo
   - Comenta por qué, no qué

3. **Commit limpio:**
   ```bash
   git log --oneline -5   # revisa tu trabajo
   git commit ...
   ```

4. **Integra a main:**
   ```bash
   git checkout main
   git merge feature/mi-mejora
   ```

---

## Roadmap de desarrollo

| Versión | Qué |
|---------|-----|
| **V0.6.1** (actual) | Terminal + filesystem, evaluador documentado |
| **V0.7** | Planificador con persistencia, tareas programadas |
| **V0.8** | Trading educativo, simulador de órdenes |
| **V0.9** | Interfaz web, audio, backups |
| **V1.0** | Asistente estable, documentación completa |
| **V1.1+** | Agentes especializados (trading, research, etc.) |
| **V2** | Economía simulada, mercados peer-to-peer |

---

## Recursos

- **Código:** `/home/luisangel/atlas/src/`
- **Pruebas:** `/home/luisangel/atlas/pruebas/`
- **Configuración:** `package.json` (scripts), `.gitignore`
- **Datos:** `datos/registro.jsonl`, `datos/memoria.db` (no versionados)
- **Trabajo:** `laboratorio/` (máquina de estados de Ollama, respuestas, lecciones)
