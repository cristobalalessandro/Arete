# Areté — Guía de instalación completa

## Qué necesitas (todo gratis)
- Cuenta en [supabase.com](https://supabase.com)
- Cuenta en [vercel.com](https://vercel.com)
- Cuenta en [github.com](https://github.com)

---

## Paso 1 — Configurar Supabase (5 min)

1. Ve a [supabase.com](https://supabase.com) → **New project**
2. Ponle nombre: `arete` → elige región más cercana (South America)
3. Una vez creado, ve a **SQL Editor** → pega el contenido de `supabase_setup.sql` → **Run**
4. Ve a **Settings → API** y copia:
   - `Project URL` → algo como `https://xxxxx.supabase.co`
   - `anon public` key → una key larga

---

## Paso 2 — Conectar la app a Supabase

Abre `src/App.jsx` y reemplaza las líneas al inicio:

```js
const SUPABASE_URL = "https://TU_PROYECTO.supabase.co";   // ← tu URL
const SUPABASE_ANON_KEY = "TU_ANON_KEY";                  // ← tu key
```

---

## Paso 3 — Subir a GitHub

1. Crea un repo nuevo en GitHub (puede ser privado)
2. Sube todos los archivos de esta carpeta

```bash
git init
git add .
git commit -m "Areté v1"
git remote add origin https://github.com/TU_USUARIO/arete-app.git
git push -u origin main
```

---

## Paso 4 — Deploy en Vercel (2 min)

1. Ve a [vercel.com](https://vercel.com) → **Add New Project**
2. Importa tu repo de GitHub
3. Vercel detecta Vite automáticamente → **Deploy**
4. En ~1 minuto tienes tu URL: `arete-app.vercel.app`

---

## Paso 5 — Instalar en iPad / Android como PWA

### iPad / iPhone
1. Abre Safari → ve a tu URL de Vercel
2. Toca el botón **Compartir** (cuadrado con flecha)
3. Toca **"Añadir a pantalla de inicio"**
4. ¡Listo! Aparece como app nativa

### Android
1. Abre Chrome → ve a tu URL
2. Toca los **3 puntos** (menú)
3. Toca **"Añadir a pantalla de inicio"**
4. ¡Listo!

---

## Cómo funciona el Elo

### Puntos diarios (máx 100 pts):
| Métrica | Puntos |
|---------|--------|
| Sueño ≥ 7h | 30 pts |
| Sueño 6–7h | 18 pts |
| Sueño < 6h | 8 pts |
| Estudio ≥ 4h | 40 pts |
| Estudio 2–4h | 20 pts |
| Estudio < 2h | 5 pts |
| Gym + sensación | 15 + (sensación × 3) pts |

### Elo semanal:
- Se calcula el **viernes** automáticamente
- Es el **promedio de puntos** de los días registrados esa semana
- Se compara con el Elo de la semana anterior
- Mensaje celebratorio si subiste, alerta si bajaste

---

## Estructura de archivos

```
arete-app/
├── src/
│   ├── App.jsx          ← lógica principal
│   └── index.css        ← estilos
├── public/
│   └── manifest.json    ← config PWA
├── index.html
├── package.json
├── vite.config.js
└── supabase_setup.sql   ← ejecutar en Supabase
```
