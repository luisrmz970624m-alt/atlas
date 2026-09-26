# API local de Atlas

La API usa `node:http`, escucha exclusivamente en `127.0.0.1` y permite `port: 0` para pruebas. No abre listeners públicos ni requiere red saliente.

## Consulta y panel

`GET /api/status`, `/api/dashboard`, `/api/simulations`, `/api/business`, `/api/business/campaigns`, `/api/business/experiments`, `/api/trading`, `/api/memory`, `/api/alerts` y `/api/vortice` son de solo lectura. `GET /` y `/panel-vortice/` sirven el panel local; los únicos assets son CSS y JavaScript con rutas fijas.

Las mutaciones permitidas son únicamente campañas, experimentos y controles de workers simulados. POST valida JSON, tamaño de cuerpo, DTO permitido, Origin y Host local. Los errores no incluyen stack y llevan correlation ID.

No hay endpoints de shell, archivos arbitrarios, pagos, órdenes de trading o escritura MT5. MT5 Real permanece `PENDIENTE`.
