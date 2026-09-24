# Guía de Self-Hosting — Atlas en casa

Esta guía cubre los dos requisitos técnicos para lanzar Atlas desde tu propia PC: **respaldo automático** de la base de datos y **exposición segura** a internet sin abrir puertos del router.

---

## 1. Respaldo automático de `datos/atlas.db`

### Comando manual

```bash
npm run atlas -- respaldo crear    # crea un respaldo con timestamp en respaldos/
npm run atlas -- respaldo listar   # muestra los respaldos existentes
```

### Cómo funciona (`src/respaldo.ts`)

- Usa el **backup nativo de better-sqlite3** (`db.backup()`), no una copia de archivo cruda — esto es seguro incluso si Atlas está escribiendo en la base de datos al mismo tiempo. Una copia manual con `cp` podría corromper el archivo si coincide con una escritura.
- Cada respaldo queda en `respaldos/atlas-<timestamp>.db`.
- **Retención automática:** conserva los últimos 7 respaldos y borra los más viejos en cada corrida.

### Automatizar con cron (respaldo diario)

Edita tu crontab:

```bash
crontab -e
```

Agrega una línea para correr todos los días a las 3:00 AM:

```
0 3 * * * cd /home/luisangel/atlas && npm run atlas -- respaldo crear >> respaldos/log.txt 2>&1
```

### Respaldo fuera de tu PC (recomendado)

Los respaldos automáticos protegen contra corrupción de datos, pero **no** contra falla de disco o robo del equipo. Copia periódicamente la carpeta `respaldos/` a un destino externo:

```bash
# Ejemplo con rclone hacia cualquier proveedor (Backblaze B2, Google Drive, etc.)
rclone copy respaldos/ remoto:atlas-backups/ --min-age 1h
```

Agrega esta línea al mismo crontab, después del respaldo local.

---

## 2. Dejar a Atlas corriendo solo (servicio systemd)

### Comando manual

```bash
npm run atlas -- correr          # un ciclo cada 60s (default)
npm run atlas -- correr 300      # un ciclo cada 5 minutos
```

Cada ciclo: mina, ejecuta los bots, registra la competencia y guarda el estado. Se detiene con Ctrl+C, esperando a que termine el ciclo en vuelo antes de cerrar la base de datos.

### Como servicio permanente

**Primero, un enlace estable a Node.** systemd no carga nvm, y la ruta de nvm cambia en cada actualización de Node. Un symlink fijo evita que el servicio se rompa el día que actualices:

```bash
sudo ln -sf "$(which node)" /usr/local/bin/atlas-node
/usr/local/bin/atlas-node --version   # debe decir v22 o superior
```

Crea `/etc/systemd/system/atlas.service`:

```ini
[Unit]
Description=Atlas — asistente autónomo
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=luisangel
WorkingDirectory=/home/luisangel/atlas
# Se invoca node directamente, NO npm: npm no reenvía SIGTERM a su hijo, así
# que systemd mataría el proceso padre y dejaría a Atlas huérfano con la base
# de datos abierta, sin apagado limpio.
ExecStart=/usr/local/bin/atlas-node --experimental-strip-types --disable-warning=ExperimentalWarning src/atlas.ts correr 60
Restart=on-failure
RestartSec=30
# Dale tiempo a terminar el ciclo en curso antes de matarlo
KillSignal=SIGTERM
TimeoutStopSec=90

[Install]
WantedBy=multi-user.target
```

> **Por qué no `ExecStart=/usr/bin/npm`:** el npm del sistema corre sobre el Node de la distribución (a menudo v18), que no entiende `--experimental-strip-types`. El servicio fallaría en cada arranque y `Restart=on-failure` lo dejaría en un bucle de reinicios silencioso.

Activar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now atlas
sudo systemctl status atlas
journalctl -u atlas -f        # ver los ciclos en vivo
```

### Detalles que importan para que no falle con el tiempo

- **Sin ciclos solapados:** si un ciclo tarda más que el intervalo (red lenta), el siguiente turno se salta en vez de arrancar en paralelo. Dos ciclos simultáneos consumirían la energía del día dos veces.
- **Apagado limpio:** ante SIGTERM (systemd) o SIGINT (Ctrl+C), Atlas detiene el temporizador, espera al ciclo en vuelo, guarda un snapshot final y cierra SQLite. Por eso `TimeoutStopSec` debe ser holgado.
- **Un error de un ciclo no tumba el servicio:** se registra y el siguiente ciclo sigue corriendo.
- **Vigilante contra ciclos atascados:** si 5 turnos seguidos se saltan porque un ciclo no termina, Atlas sale con código de error a propósito, para que systemd lo reinicie. Sin esto, el proceso seguiría vivo sin trabajar y nadie se enteraría.
- **Cambio de día:** el estado diario de energía y minería se crea bajo demanda, así que cruzar la medianoche no detiene a Atlas.
- **Poda automática:** los históricos (snapshots de competencia, caché de precios, registros de energía y minería) se podan a 30 días en cada ciclo. Sin esto serían cientos de miles de filas al año, y cada respaldo copiaría todo.
- **Intervalo válido:** entre 10 y 86.400 segundos.

---

## 3. Exponer Atlas a internet con Cloudflare Tunnel

**Por qué no abrir puertos directo:** exponer el puerto de tu router directamente a internet expone tu IP real y convierte tu PC en blanco de escaneos automatizados constantes. Cloudflare Tunnel crea una conexión saliente cifrada desde tu PC hacia Cloudflare — nunca necesitas abrir un puerto de entrada.

### Instalación (una sola vez)

```bash
# Descargar cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Autenticar (abre el navegador, requiere cuenta gratuita de Cloudflare)
cloudflared tunnel login
```

### Crear el túnel

```bash
cloudflared tunnel create atlas
```

Esto genera un archivo de credenciales en `~/.cloudflared/<tunnel-id>.json` — **no lo compartas ni lo subas a git**.

### Configurar el túnel

Crea `~/.cloudflared/config.yml`:

```yaml
tunnel: atlas
credentials-file: /home/luisangel/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: atlas.tudominio.com
    service: http://localhost:3000
  - service: http_status:404
```

(Ajusta el puerto `3000` al que use la interfaz web de Atlas V0.9 cuando esté lista.)

### Enrutar el dominio

```bash
cloudflared tunnel route dns atlas atlas.tudominio.com
```

Requiere que tu dominio esté administrado por Cloudflare (gratis).

### Correr el túnel como servicio permanente

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

Esto asegura que el túnel se reconecte automáticamente si tu PC reinicia.

---

## 4. Checklist antes de lanzar

- [ ] `npm run atlas -- respaldo crear` corre sin errores
- [ ] Cron configurado para respaldo diario automático
- [ ] Respaldos también copiados a un destino externo (no solo local)
- [ ] Servicio systemd de Atlas activo (`systemctl status atlas`)
- [ ] Cloudflare Tunnel instalado y autenticado
- [ ] Dominio enrutado y resolviendo (`curl https://atlas.tudominio.com`)
- [ ] `cloudflared` corriendo como servicio systemd (sobrevive reinicios)
- [ ] Puerto del router **cerrado** (no se necesita con Cloudflare Tunnel)

---

## Referencia cruzada

- Presupuesto y comparación de opciones de hosting: ver conversación de lanzamiento (self-hosted elegido sobre VPS/serverless)
- Persistencia de estado de Atlas: `src/persistencia.ts`, comando `npm run atlas -- estado`
- Requisitos de batería para futuras apps móvil/PC: [REQUISITOS_BATERIA_APPS.md](REQUISITOS_BATERIA_APPS.md)
