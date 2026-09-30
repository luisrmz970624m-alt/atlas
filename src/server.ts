import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import express from 'express';

const app = express();
const port = 3000;

const rutaPanel = path.resolve('src', 'panel');

app.use(express.static(rutaPanel));

app.get('/', (req, res) => {
    const file = path.join(rutaPanel, 'index.html');
    if (fs.existsSync(file)) {
        res.sendFile(file);
    } else {
        res.send(`<h2 style="color:#fafafa;background-color:#121215;font-family:sans-serif;padding:40px;height:100vh;margin:0;">[ATLAS] No se encontró el index.html en la ruta: ${rutaPanel}. <br><br>Verifica que los archivos web estén en src/panel/</h2>`);
    }
});

app.get('/api/estado-real', (req: any, res: any) => {
    const rutaSnapshot = path.resolve('datos', 'atlas-state.json');
    if (fs.existsSync(rutaSnapshot)) {
        res.json(JSON.parse(fs.readFileSync(rutaSnapshot, 'utf-8')));
    } else {
        res.json({ Nivel_Atlas: 4, Energia_restante: 70, ETH_generado_hoy: 0.000793 });
    }
});

app.listen(port, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 ROSTRO IA ENCENDIDO - CONFIGURACIÓN VINCULADA`);
    console.log(`==================================================`);
    console.log(`[API] Corriendo en http://localhost:${port}`);
    
    const comandoAbrir = process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${comandoAbrir} http://localhost:${port}`);
});
