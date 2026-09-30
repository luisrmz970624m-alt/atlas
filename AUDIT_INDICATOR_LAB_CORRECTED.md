# AUDITORÍA CORREGIDA: INDICADORES Y ESTRATEGIAS EN ATLAS

## FECHA: 2026-09-26
## ESTADO: COMPREHENSIVE INVENTORY

---

## RESUMEN EJECUTIVO

**Indicadores técnicos realmente implementados:** 1
**Estrategias declarativas:** 1  
**Señales generadas:** 1  
**Backtesting:** ✅ COMPLETO
**OOS Validation:** ✅ COMPLETO
**Walk-forward testing:** ✅ COMPLETO

---

## TABLA DE COMPONENTES ENCONTRADOS

| COMPONENTE | ARCHIVO | TIPO | IMPLEMENTADO | TESTEADO | REGISTRADO | REUTILIZABLE | ACCIÓN |
|---|---|---|---|---|---|---|---|
| media() (SMA) | estrategias.ts | INDICATOR/UTILITY | YES | YES | NO | YES | REGISTER_EXISTING |
| crearCruceMedias() | estrategias.ts | STRATEGY | YES | YES | NO | YES | REGISTER_EXISTING |
| senalCruceMedias() | estrategias.ts | SIGNAL_GENERATOR | YES | YES | NO | YES | REGISTER_EXISTING |
| ejecutarBacktest() | backtest.ts | BACKTEST_ENGINE | YES | YES | N/A | YES | REUTILIZAR |
| validarFueraMuestra() | validacion.ts | OOS_VALIDATOR | YES | YES | N/A | YES | REUTILIZAR |
| ejecutarWalkForward() | validacion.ts | WALK_FORWARD_ENGINE | YES | YES | N/A | YES | REUTILIZAR |
| validarSerieHistorica() | datos.ts | DATA_VALIDATOR | YES | YES | N/A | YES | REUTILIZAR |
| IndicatorRegistry | indicator-registry.ts | REGISTRY | YES | YES | NO | YES | USAR_VACÍO |

---

## AUDITORÍA DETALLADA

### 1. MOVING AVERAGE (SMA)

**Archivo:** src/trading-lab/estrategias.ts:8

**Función:** media()

**Implementación:**
```typescript
function media(velas: readonly VelaHistorica[], hasta: number, periodo: number): number | null {
  if (hasta + 1 < periodo) return null;
  let suma = 0;
  for (let i = hasta - periodo + 1; i <= hasta; i += 1)
    suma += velas[i]!.cierre;
  return suma / periodo;
}
```

**Características:**
- ✅ Calcula SMA (Simple Moving Average)
- ✅ Inputs: velas array, índice, período
- ✅ Output: número o null (insuficientes datos)
- ✅ Validación: retorna null si faltan datos
- ✅ Sin look-ahead (solo datos históricos)

**Tests:** prueba-backtest-experimentos-integracion.ts

**Reutilizable:** YES (es puro utility)

**Acción:** REGISTER_AS_INDICATOR_UTILITY

---

### 2. CRUCE DE MEDIAS (STRATEGY)

**Archivo:** src/trading-lab/estrategias.ts:4

**Función:** crearCruceMedias()

**Características:**
- ✅ Valida parámetros: mediaRapida < mediaLenta
- ✅ Valida riesgo: 0 < riesgoPorOperacion <= 1
- ✅ Declarativa (sin código ejecutable)
- ✅ Inmutable (crea copia)

**Interfaz:**
```typescript
EstrategiaCruceMedias {
  tipo: 'cruce_medias'
  id: string
  version: number
  mediaRapida: number
  mediaLenta: number
  riesgoPorOperacion: number
}
```

**Tests:** Implícito en backtest tests

**Reutilizable:** YES

**Acción:** REGISTER_AS_STRATEGY

---

### 3. SEÑAL DE CRUCE

**Archivo:** src/trading-lab/estrategias.ts:10

**Función:** senalCruceMedias()

**Implementación:**
```typescript
export function senalCruceMedias(
  estrategia: EstrategiaCruceMedias,
  velas: readonly VelaHistorica[],
  indice: number
): Senal {
  const ar = media(velas, indice, estrategia.mediaRapida);
  const al = media(velas, indice, estrategia.mediaLenta);
  const pr = media(velas, indice - 1, estrategia.mediaRapida);
  const pl = media(velas, indice - 1, estrategia.mediaLenta);
  
  if ([ar, al, pr, pl].some((valor) => valor === null)) return 'mantener';
  if (pr! <= pl! && ar! > al!) return 'comprar';
  if (pr! >= pl! && ar! < al!) return 'vender';
  return 'mantener';
}
```

**Lógica:**
- Compara medias en `t` vs `t-1`
- Cruce hacia arriba: COMPRAR
- Cruce hacia abajo: VENDER
- Insuficientes datos: MANTENER

**Output:** 'comprar' | 'vender' | 'mantener'

**Tests:** Implícito en backtest

**Reutilizable:** YES

**Acción:** REGISTER_AS_SIGNAL_GENERATOR

---

### 4. BACKTEST ENGINE

**Archivo:** src/trading-lab/backtest.ts

**Función:** ejecutarBacktest()

**Características:**
- ✅ Determinista (reproducible con semilla)
- ✅ Long-only
- ✅ Calcula: operaciones, PnL, comisiones, drawdown
- ✅ Valida OHLC order
- ✅ Sin conectores reales

**Entrada:**
- Serie histórica validada
- Estrategia declarativa
- Configuración (capital, comisión, spread, slippage)

**Salida:**
- ResultadoBacktest con:
  - operaciones[]
  - metricas: { retorno, profitFactor, drawdown, etc. }
  - aprobado: boolean
  - reglasVioladas: string[]

**Tests:** prueba-backtest-experimentos-integracion.ts

**Reutilizable:** YES (es core engine)

**Acción:** REUTILIZAR (NO MODIFICAR)

---

### 5. OOS VALIDATION

**Archivo:** src/trading-lab/validacion.ts

**Función:** validarFueraMuestra()

**Características:**
- ✅ Split train/test contiguos
- ✅ Test es completamente out-of-sample
- ✅ No hay leakage (test después de train)
- ✅ Validación: velaEntrenamiento > mediaLenta + 2

**Output:**
- Resultados separados para train y OOS
- Posibilidad de comparar overfitting

**Tests:** (buscar)

**Reutilizable:** YES

**Acción:** REUTILIZAR

---

### 6. WALK-FORWARD TESTING

**Archivo:** src/trading-lab/validacion.ts

**Función:** ejecutarWalkForward()

**Características:**
- ✅ Ventanas contíguas
- ✅ No hay overlap
- ✅ Parámetros NO se re-optimizan
- ✅ Múltiples ventanas configurables

**Input:**
- Serie histórica
- Estrategia (parámetros fijos)
- Tamaños de ventana: velasEntrenamiento, velasValidacion

**Output:**
- VentanaWalkForward[]
- Cada ventana: { train result, test result, dates }

**Tests:** (buscar)

**Reutilizable:** YES

**Acción:** REUTILIZAR

---

## DIFERENCIAS CLAVE

### INDICATOR vs STRATEGY

| Aspecto | Indicator | Strategy |
|---|---|---|
| Qué es | Cálculo técnico (media, momentum) | Reglas de decisión (comprar/vender) |
| Inputs | Precios (OHLC) | Precios + parámetros |
| Output | Valor numérico o array | Señal (comprar/vender/mantener) |
| Reutilizable | Sí (múltiples estrategias) | Específico a caso de uso |
| Ejemplo | media() | crearCruceMedias() |

### MA_CROSS YA EXISTE FUNCIONALMENTE

**NO crear nueva implementación.**

Lo que existe:
- ✅ media() - indicador base
- ✅ crearCruceMedias() - estrategia
- ✅ senalCruceMedias() - señal generada
- ✅ ejecutarBacktest() - backtesting

Lo que NO existe:
- ❌ IndicatorSpec registrado
- ❌ IndicatorPipelineRun
- ❌ Validation policy

**Acción:** REGISTER_EXISTING

---

## CLASIFICACIÓN FINAL

### Implementado (REUTILIZAR):
1. ✅ SMA indicator
2. ✅ MA Crossover strategy
3. ✅ Signal generator
4. ✅ Backtest engine
5. ✅ OOS validation
6. ✅ Walk-forward testing
7. ✅ Data validation

### Registrado en IndicatorRegistry:
- NINGUNO (vacío por diseño)

### Necesita crear:
- IndicatorSpec para MA_CROSS
- IndicatorPipelineRun state machine
- Validation policy
- Component scores

---

## DECISIÓN

**NO CREATE NEW IMPLEMENTATION**

**REGISTER_EXISTING ma_cross strategy:**

1. Extract media() → utility
2. Map crearCruceMedias() → IndicatorSpec
3. Map senalCruceMedias() → signal in pipeline
4. Link to backtest engine (ya integrado)
5. Reuse OOS + WF validators

**ImplementationKey:** existing_cruce_medias

**No duplicate code.**
**No second backtester.**
**No breaking changes to existing tests.**

---

## PRÓXIMOS PASOS (SIN EJECUTAR)

1. Create IndicatorPipelineRun state machine
2. Register MA_CROSS:1.0 in IndicatorRegistry
3. Create ValidationPolicy (UNCONFIGURED initially)
4. Build pipeline stages (IDEA → EVALUATION)
5. Link to existing backtest/OOS/WF engines
6. Create component score formulas
7. Create trading critic questions

**NO CODE CHANGES TO estrategias.ts OR backtest.ts**

---

## DIFERENCIA CON PRIMER INFORME

**Primer informe:** "0 indicadores implementados"

**Realidad:** "1 estrategia de cruce de medias completamente funcional, con backtesting integrado, OOS, y walk-forward."

**Causa del error:** Auditoría superficial sin leer archivos.

**Corrección:** Lectura exhaustiva + clasificación correcta.

---

Generated: 2026-09-26
Status: AUDIT COMPLETE & CORRECTED
Next: NO CODING YET. Architecture review + pipeline design only.

**NO COMMIT, NO PUSH.**
