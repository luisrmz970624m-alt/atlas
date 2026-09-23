# Atlas Apps — Requisitos de Batería y Hardware

**Documento de especificación para V0.9+**

---

## 1. Protección de Batería en Apps Móviles

### Regla Principal
**La minería de criptos SOLO se activa si:**
```
bateria_porcentaje == 100%  O  conectado_a_cargador == true
```

### Estados de Batería

| Estado | Batería | Cargador | Minería | Estudio | Trading |
|--------|---------|----------|---------|---------|---------|
| Óptimo | 100% | - | ✅ Activo | ✅ Activo | ✅ Activo |
| Cargando | 0-99% | ✅ Sí | ✅ Activo | ✅ Activo | ✅ Activo |
| Desconectado | 100% | ❌ No | ✅ Activo | ✅ Activo | ✅ Activo |
| Normal | 50-99% | ❌ No | ❌ Pausado | ✅ Activo | ✅ Activo |
| Bajo | 20-49% | ❌ No | ❌ Suspendido | ⏸️ Ralentizado | ✅ Limitado |
| Crítico | <20% | ❌ No | ❌ Suspendido | ❌ Suspendido | ❌ Suspendido |

### Implementación en Apps

#### Android (Kotlin/Flutter)
```kotlin
// Verificar batería y estado de carga
val batteryManager = context.getSystemService(BatteryManager::class.java)
val batteryLevel = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER)
val isCharging = batteryManager.isCharging

// Registrar receptores
registerReceiver(
    BatteryChangedReceiver(),
    IntentFilter(Intent.ACTION_BATTERY_CHANGED)
)

// Clase receptora
class BatteryChangedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: return
        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || 
                         status == BatteryManager.BATTERY_STATUS_FULL
        
        // Actualizar estado de minería
        AtlasMiningService.updateBatteryState(level, isCharging)
    }
}
```

#### iOS (Swift)
```swift
import UIKit

class BatteryMonitor {
    static let shared = BatteryMonitor()
    
    func startMonitoring() {
        UIDevice.current.isBatteryMonitoringEnabled = true
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(batteryLevelDidChange),
            name: UIDevice.batteryLevelDidChangeNotification,
            object: nil
        )
    }
    
    @objc func batteryLevelDidChange() {
        let batteryLevel = UIDevice.current.batteryLevel
        let isCharging = UIDevice.current.batteryState == .charging || 
                        UIDevice.current.batteryState == .full
        
        AtlasMiningEngine.updateBatteryState(
            level: Int(batteryLevel * 100),
            isCharging: isCharging
        )
    }
}
```

#### Desktop (Electron/Tauri)
```typescript
// Para PC: verificar estado de carga
async function checkPowerState() {
  // Electron
  const { powerMonitor } = require('electron');
  
  // Obtener estado de carga (depende del OS)
  if (process.platform === 'win32') {
    // Windows
    const battery = require('systeminformation').battery();
    return {
      level: battery.percent,
      isCharging: battery.ischarging
    };
  } else if (process.platform === 'darwin') {
    // macOS
    const battery = require('systeminformation').battery();
    return {
      level: battery.percent,
      isCharging: battery.ischarging
    };
  }
}

// Monitorear cambios
powerMonitor.on('suspend', () => {
  miningEngine.pause('system-suspend');
});

powerMonitor.on('resume', () => {
  miningEngine.resume();
});
```

---

## 2. Estados de Minería

### MINERÍA ACTIVA ✅
```
Condiciones:
- Batería al 100% (móvil/PC)
- O conectado al cargador
- Energía asignada > 0%

Acciones:
- Genera ETH
- Incrementa nivel
- Consume energía

Notificación:
"⛏️ Minería activa • ETH/h: 0.003 • Batería: 100%"
```

### MINERÍA PAUSADA ⏸️
```
Condiciones:
- Batería 50-99%
- No conectado a cargador
- Se puede reactivar cuando suba a 100% o se conecte cargador

Acciones:
- NO genera ETH
- Notifica al usuario
- Mantiene estado

Notificación:
"⏸️ Minería pausada • Batería: 87% • Conecta cargador o espera a 100%"
```

### MINERÍA SUSPENDIDA ❌
```
Condiciones:
- Batería < 50%
- No conectado a cargador
- Solo se reanuda cuando se cumpla regla de activación

Acciones:
- NO genera ETH
- Pausas automáticas de energía
- Protege dispositivo

Notificación:
"❌ Minería suspendida • Batería baja: 32% • Conecta cargador"
```

---

## 3. Sincronización Multi-dispositivo

Si el usuario tiene apps en PC y teléfono:

```
PC: Batería 100% (conectada)     ✅ Minería activa
        ↓
   Atlas genera 0.003 ETH/h
        ↓
Teléfono: Batería 87%            ⏸️ Minería pausada
        ↓
   Sincroniza: usuario ve
   "ETH/h total: 0.003"

---

Si después el usuario conecta teléfono:

Teléfono: Conectado a cargador   ✅ Minería activa
        ↓
   Atlas genera 0.004 ETH/h
        ↓
PC + Teléfono               ✅ Minería activa (dual)
        ↓
   Sincroniza: usuario ve
   "ETH/h total: 0.007"
```

---

## 4. Notificaciones al Usuario

### Alertas de Batería
```
🔌 "Conecta el cargador para activar minería"
     (Batería 45%, minería pausada)

⚡ "Minería activa en 2 dispositivos"
     (PC + Teléfono generando)

🪫 "Batería crítica (15%) • Minería suspendida"
     (Protegiendo dispositivo)

✅ "Batería completa • Minería activada"
     (Teléfono al 100%, listo para minar)
```

### Estadísticas
```
Hoy:
⛏️ Minería: 0.045 ETH
  • PC (12h activo): 0.036 ETH
  • Teléfono (8h cargando): 0.009 ETH

Tiempo de espera promedio:
  • PC: siempre activo (conectado)
  • Teléfono: 4.2 horas/día (cargando)
```

---

## 5. Configuración de Usuario

```typescript
// atlas.config.json
{
  "mineria": {
    "habilitada": true,
    "requerimientos": {
      "bateria_min_sin_cargador": 100,  // %
      "bateria_max_sin_cargador": 100,  // %
      "permite_con_cargador": true,
      "pausa_en_bateria_baja": 50,      // %
      "suspension_en_bateria": 20       // %
    },
    "notificaciones": {
      "alertas_bateria": true,
      "resumen_diario": true,
      "alertas_sincronizacion": true
    }
  }
}
```

---

## 6. Impacto en Performance

### Consumo de CPU/GPU
```
Minería activa en teléfono:
- CPU: ~15-20% (1 core)
- GPU: ~5-10% (si disponible)
- Batería/hora: ~3-5%

Ejemplo:
- Batería 100%
- Minería activa
- Tiempo hasta 95%: ~20 minutos
- Tiempo hasta 0%: ~5-6 horas

→ Se recomienda: minar mientras cargas
```

### Impacto en Funciones
```
Mining en PC:          Gaming en PC:
✅ Estudios (normal)   ⏸️ Minería pausada
✅ Trading (normal)    ✅ Trading (reducido)
✅ Minería             ⏸️ Espera a que termines
```

---

## 7. Testing y QA

### Tests de Batería
```bash
# Simular cambios de batería
adb shell dumpsys batterymanager
adb shell cmd battery set level 50
adb shell cmd battery charging

# Verificar minería se pausa/reanuda
npm run test:mineria-bateria

# Verificar sincronización
npm run test:sync-multi-device
```

### Casos de Prueba
```
✓ Minería activa a 100%
✓ Minería pausa a 99%
✓ Minería se reanuda al conectar cargador
✓ Minería se suspende a <50%
✓ Notificaciones correctas
✓ Sincronización entre PC + teléfono
✓ Consumo de batería dentro de límites
✓ Sin ralentización en otras funciones
```

---

## Resumen

**Protección de Batería:**
- Minería solo con batería protegida
- Pausa automática si baja
- Notificaciones claras
- Sin impacto en otras funciones

**Próximas versiones:**
- V0.9.1: Apps desktop (PC)
- V0.9.2: Apps móvil (iOS/Android)
- V0.9.3: Sincronización multi-dispositivo
- V0.9.4: Optimización de consumo
