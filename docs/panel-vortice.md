# Panel El Vórtice

Disponible en `http://127.0.0.1:<puerto>/panel-vortice/` cuando la API local está iniciada. Es HTML, CSS y JavaScript locales sin dependencias, CDN ni recursos remotos.

Incluye modos SIMPLE, EXECUTIVE y ADVANCED; guarda el modo de forma local en el navegador. Presenta Vórtice, empresa simulada, trading de solo estado, workers, memoria y alertas. Los valores que no existen se muestran como `UNAVAILABLE`; la UI no inventa ceros.

La actualización es polling cada cuatro segundos. SSE queda pendiente. Todo valor dinámico se construye con nodos DOM y `textContent`, sin `innerHTML` ni ejecución de código recibido.

## Apariencia local

La barra de configuración permite elegir tema Oscuro, Claro o Automático. Automático sigue `prefers-color-scheme` del sistema. También ofrece acentos Carmesí, Azul, Violeta, Verde y Naranja. Tema, acento y modo de vista se guardan únicamente en `localStorage` bajo `vortice.theme`, `vortice.accent` y `vortice.modeView`; Restablecer apariencia vuelve a Automático, Carmesí y SIMPLE.

## Núcleo premium y rendimiento

El núcleo SVG local de El Vórtice usa animaciones CSS suaves (pulso, órbitas, líneas y ondas), sin CDN, WebGL, vídeo ni bucles JavaScript de animación. Refleja únicamente el dashboard local: IDLE, ACTIVE, PROCESSING, WARNING, ERROR, PAUSED u OFFLINE; los campos que la API no entrega se mantienen como `UNAVAILABLE`.

Los presets Atlas Crimson, Neon Blue, Cyber Violet, Emerald Grid e Industrial Dark se persisten en `vortice.visualStyle`. La intensidad OFF, LOW, NORMAL (predeterminada) y HIGH se persiste en `vortice.effects`. `prefers-reduced-motion` desactiva la decoración animada y una pestaña oculta pausa esas animaciones; el polling local sigue siendo uno cada cuatro segundos.
