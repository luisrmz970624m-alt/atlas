# Panel El Vórtice

Disponible en `http://127.0.0.1:<puerto>/panel-vortice/` cuando la API local está iniciada. Es HTML, CSS y JavaScript locales sin dependencias, CDN ni recursos remotos.

Incluye modos SIMPLE, EXECUTIVE y ADVANCED; guarda el modo de forma local en el navegador. Presenta Vórtice, empresa simulada, trading de solo estado, workers, memoria y alertas. Los valores que no existen se muestran como `UNAVAILABLE`; la UI no inventa ceros.

La actualización es polling cada cuatro segundos. SSE queda pendiente. Todo valor dinámico se construye con nodos DOM y `textContent`, sin `innerHTML` ni ejecución de código recibido.
