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

## 2. Exponer Atlas a internet con Cloudflare Tunnel

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

## 3. Checklist antes de lanzar

- [ ] `npm run atlas -- respaldo crear` corre sin errores
- [ ] Cron configurado para respaldo diario automático
- [ ] Respaldos también copiados a un destino externo (no solo local)
- [ ] Cloudflare Tunnel instalado y autenticado
- [ ] Dominio enrutado y resolviendo (`curl https://atlas.tudominio.com`)
- [ ] `cloudflared` corriendo como servicio systemd (sobrevive reinicios)
- [ ] Puerto del router **cerrado** (no se necesita con Cloudflare Tunnel)

---

## Referencia cruzada

- Presupuesto y comparación de opciones de hosting: ver conversación de lanzamiento (self-hosted elegido sobre VPS/serverless)
- Persistencia de estado de Atlas: `src/persistencia.ts`, comando `npm run atlas -- estado`
- Requisitos de batería para futuras apps móvil/PC: [REQUISITOS_BATERIA_APPS.md](REQUISITOS_BATERIA_APPS.md)
