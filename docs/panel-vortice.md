# Panel El Vórtice

Disponible en `http://127.0.0.1:<puerto>/panel-vortice/` cuando la API local está iniciada. Es HTML, CSS y JavaScript locales sin dependencias, CDN ni recursos remotos.

Incluye modos Simple, Ejecutivo, Avanzado, Visual y Personalizado (`data-mode` simple, executive, advanced, visual y custom); guarda el modo de forma local en el navegador. Presenta Vórtice, proveedores IA, empresa simulada, trading de solo estado, workers, memoria, alertas, video y reportes. Los valores que no existen se muestran como `UNAVAILABLE`; la UI no inventa ceros.

La actualización es polling cada cuatro segundos. SSE queda pendiente. Todo valor dinámico se construye con nodos DOM y `textContent`, sin `innerHTML` ni ejecución de código recibido.

## Apariencia local

El panel lateral de Configuración (botón de la barra superior o entrada del sidebar) permite elegir tema Oscuro, Claro o Automático. Automático sigue `prefers-color-scheme` del sistema. También ofrece acentos Carmesí, Azul, Violeta, Verde y Naranja. Tema, acento y modo de vista se guardan únicamente en `localStorage` bajo `vortice.theme`, `vortice.accent` y `vortice.modeView`; Restablecer apariencia vuelve a Automático, Carmesí y SIMPLE.

## Núcleo premium y rendimiento

El núcleo SVG local de El Vórtice usa animaciones CSS suaves (pulso, órbitas, líneas y ondas), sin CDN, WebGL, vídeo ni bucles JavaScript de animación. Refleja únicamente el dashboard local: IDLE, ACTIVE, PROCESSING, WARNING, ERROR, PAUSED u OFFLINE; los campos que la API no entrega se mantienen como `UNAVAILABLE`.

Los presets Atlas Crimson, Neon Blue, Cyber Violet, Emerald Grid e Industrial Dark se persisten en `vortice.visualStyle`. La intensidad OFF, LOW, NORMAL (predeterminada) y HIGH se persiste en `vortice.effects`. `prefers-reduced-motion` desactiva la decoración animada y una pestaña oculta pausa esas animaciones; el polling local sigue siendo uno cada cuatro segundos.

## Centro de mando

El panel funciona como un Business OS de una sola página:

- **Sidebar**: Inicio, Empresa, Finanzas, Ventas, Inventario, Nómina, Facturación, Clientes, Proveedores, Simulación, Trading, Análisis de Video, Agentes IA, El Vórtice, Reportes y Configuración. La navegación usa el hash de la URL (`#empresa`, `#trading`…), así que el botón Atrás funciona. En tablet (≤1180px) el sidebar se reduce a iconos; en móvil (≤760px) se colapsa y se abre con el botón de menú.
- **Topbar**: modos, búsqueda de módulos (`/` enfoca, Enter abre el primer resultado), alertas con contador, estado del sistema, `SIMULATED` y acceso a Configuración.
- **El Vórtice** domina la vista Inicio: el núcleo animado se conecta con Texto, Voz, Imágenes, Video, Datos y Simulación. Un canal sin fuente en la API se dibuja atenuado y marcado `UNAVAILABLE`; Datos muestra `SIMULATED` y Simulación refleja los workers reales (`EMPTY` si no hay). Junto al núcleo aparecen estado, policy, Supervisor, queue, decisiones, última acción y tiempo activo.
- **Proveedores IA**: muestra solo los proveedores que reporta `/api/dashboard` y su estado. La cuota queda `UNAVAILABLE`; no se muestran porcentajes inventados ni API keys.
- **Empresa**: KPIs Cash, Revenue, Expenses (nómina), Profit, Inventory, Employees, Suppliers y Stockouts (`UNAVAILABLE`, la API no lo entrega). Las tendencias son sparklines SVG construidas únicamente con las lecturas de la sesión actual del navegador.
- **Trading**: Trading Lab, Backtester, OOS, Walk-forward, Paper Trading, MT5 Bridge Local y MT5 Real (`PENDING`). Solo estado: sin botones de operación, sin trading real y sin dinero real.
- **Módulos**: simulación empresarial, flujo financiero, cuentas, memoria, alertas, análisis de video (`UNAVAILABLE`), workers, recursos, auditoría y reporte de sesión.

Modos: **Simple** muestra núcleo, alertas, resumen y trading; **Ejecutivo** añade KPIs y módulos; **Avanzado** añade workers, recursos y auditoría; **Visual** amplía el núcleo a todo el ancho y prioriza gráficos; **Personalizado** usa los módulos elegidos en Configuración (`vortice.customModules`) y el tamaño del núcleo (`vortice.customCore`).

Los gráficos son HTML/SVG locales clonados desde `<template>`; no hay librerías, CDN ni `createElementNS`.
