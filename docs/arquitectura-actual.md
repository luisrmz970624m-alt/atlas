# Arquitectura actual de Atlas

Estado consolidado local y offline. `IMPLEMENTADO` no significa rentable, recomendable ni conectado a un servicio real.

```text
ATLAS
├── Supervisor y auditoría                         IMPLEMENTADO / PROBADO
├── El Vórtice y providers opt-in                  IMPLEMENTADO / PROBADO
├── Trading Lab, backtest, OOS, walk-forward, paper IMPLEMENTADO / PROBADO
├── MT5
│   ├── Bridge local de solo lectura               IMPLEMENTADO / PROBADO CON FAKE
│   └── MT5 real DEMO                              PENDIENTE
├── Empresa Simulator                              IMPLEMENTADO / SIMULADO / PROBADO
│   ├── ventas, compras e inventario
│   ├── FacturaSimulada, NominaSimulada y BancoSimulado
│   ├── ledger y estados financieros simulados
│   └── tiempo, escenarios y checkpoints
├── Simulation Orchestrator                        IMPLEMENTADO / PROBADO
├── Memoria
│   ├── trading, programacion y sistema            IMPLEMENTADO / PROBADO
│   └── empresa                                    IMPLEMENTADO / PROBADO / SIMULADO
└── Dashboard Contracts                            IMPLEMENTADO / PROBADO
```

## Límites de seguridad

- No hay órdenes MT5 ni dinero real. La conexión MT5 real sigue bloqueada como `PENDIENTE`.
- Trading conserva `TRADING_MODE=DEMO_ONLY` y `REAL_TRADING=false` en el orquestador.
- Empresa usa exclusivamente IDs, personas, banco, facturas, nómina y pagos sintéticos. No es contabilidad, nómina ni facturación legal.
- La suite usa `ATLAS_SIN_RED=true`; precios, proveedores y el futuro bridge real requieren inyección o activación explícita.
- El panel etiqueta métricas de empresa como `simulated`; no fabrica métricas de recursos reales.
