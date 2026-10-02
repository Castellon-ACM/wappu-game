# 🐾 Wapuu Game

Un juego de mascota virtual al estilo Pou, pero con **Wapuu**, la mascota de WordPress, en 3D.

**Juega aquí:** https://castellon-acm.github.io/wappu-game/

## Cómo se juega

Wapuu tiene cinco necesidades que bajan con el tiempo (también cuando cierras la pestaña): comida, energía, ánimo, baño e higiene. Muévete por la casa con la barra de abajo:

| Habitación | Qué puedes hacer |
|---|---|
| 🛋️ Salón | Darle mimos (o tocar a Wapuu), lanzarle la pelota, ponerle a bailar y abrir la tienda |
| 🍳 Cocina | Comprar y darle comida: cookies, café, pizza, tortilla, paella… |
| 💻 Despacho | Ponerle a programar plugins. Cada commit da monedas y, si aparecen bugs, aplástalos para ganar más |
| 🛁 Baño | Llevarle al váter, frotarle con jabón (arrastrando el jabón sobre él) y darle una ducha |
| 🛏️ Dormir | Apagar la luz para que recupere energía |

Programar cansa y da hambre, así que hay que equilibrar trabajo y descanso.

**Cuenta y guardado en la nube.** Al entrar puedes crear una cuenta con correo y contraseña (o recuperarla si la olvidas) para jugar desde varios dispositivos sin perder el progreso; también puedes jugar sin cuenta, y entonces la partida solo se guarda en ese navegador.

**Crece contigo.** Wapuu empieza siendo un bebé (pequeño y con los ojos grandes) y crece con cada nivel: bebé, pequeño, joven y adulto a partir del nivel 7. Por el camino gana títulos, de *Becario del plugin* a *Leyenda del WordCamp*.

**Se ensucia.** Si su higiene baja del 55 %, le salen manchas que van a más, y cuando está muy sucio le rondan moscas. Frotarle con jabón y la ducha le dejan limpio otra vez.

**Tienda de cosméticos** (🛍️ arriba o en el salón): flor, lazo, gorro de fiesta, gafas de pasta, gafas de sol, gorra WordPress, chistera y corona. Algunos se desbloquean por nivel. Se puede llevar uno por zona (cabeza, cara y oreja).

**Misiones diarias** (🎯 arriba o en el salón). Cada día salen tres misiones nuevas, una fácil, una media y una difícil: dar mimos, hacer commits, aplastar bugs, ducharle, mantenerle contento unos minutos… Al completarlas se reclaman y dan experiencia y monedas, y si reclamas las tres hay un premio extra. Cambian a medianoche.

**Pase de batalla infinito.** Toda la experiencia que ganas (jugando y con las misiones) sube también el pase. No tiene final: los primeros niveles salen enseguida y cada uno pide un poco más que el anterior (40 XP el primero, unos 390 el 10, unos 960 el 20…). Cada nivel da monedas; cada 5, una merienda que sube todas sus necesidades; cada 10, un cofre de monedas. En los niveles 5, 10, 20, 30 y 50 hay cosméticos exclusivos que no se venden en la tienda: estrella, monóculo, aureola, gorro de mago y gafas de oro.

**Minijuegos** (🎮 Juegos, en la barra de abajo): Lazo de pompas, Ritmo de commits y Enchufa plugins, con récords, medallas y premios.

**Ranking mundial** (🏆 dentro de Juegos): el top 50 de Wapuus por nivel y de récords en cada minijuego, y tu puesto aunque no estés entre ellos. Para salir hace falta cuenta; sin cuenta se puede ver. Solo se publica el nombre del Wapuu, un emoji, el nivel y los récords (nada de correos).

## Tecnología

- HTML, CSS y JavaScript sin compilación.
- [three.js](https://threejs.org/) 0.160 desde jsDelivr para el 3D.
- Sonidos generados con WebAudio.
- Cuentas y guardado en la nube con [Firebase](https://firebase.google.com/) (Authentication + Firestore); si no se configura, el juego sigue funcionando guardando solo en `localStorage`.

```
index.html
css/style.css
css/progress.css         → estilos de las misiones y el pase
js/main.js              → lógica del juego, interfaz y flujo de acceso
js/world.js              → escena 3D, habitaciones y animaciones de Wapuu
js/state.js              → necesidades, niveles y guardado local
js/progress.js           → misiones diarias y pase de batalla
js/pass-cosmetics.js     → cosméticos exclusivos del pase (datos y modelos 3D)
js/audio.js              → efectos de sonido
js/auth.js               → cuentas (Firebase Authentication) y guardado en Firestore
js/firebase-config.js    → claves públicas del proyecto de Firebase (no está en el repo, ver abajo)
firestore.rules           → reglas de seguridad de Firestore
```

## Configurar Firebase (cuentas y guardado en la nube)

Este repositorio ya incluye `js/firebase-config.js` con las claves del proyecto de Firebase de este juego (son públicas por diseño, ver más abajo). Si haces un fork o quieres tu propio proyecto, sustitúyelas por las tuyas. Para configurarlo desde cero, en la [consola de Firebase](https://console.firebase.google.com) (plan gratuito Spark es suficiente):

1. Crea un proyecto.
2. En **Authentication → Sign-in method**, activa el proveedor de correo y contraseña.
3. En **Authentication → Settings → Authorized domains**, añade el dominio donde publiques el juego (por ejemplo `castellon-acm.github.io`).
4. Crea la base de datos de **Firestore** y pega en **Reglas** el contenido de [`firestore.rules`](firestore.rules). Cada vez que cambie ese archivo (por ejemplo, al añadir el ranking) hay que volver a pegarlo y pulsar **Publicar**.
5. Registra una app web (icono `</>`) y copia sus claves (`apiKey`, `authDomain`, `projectId`, `appId`) en un archivo nuevo `js/firebase-config.js`:

```js
export const firebaseConfig = {
  apiKey: 'AIzaSy...',
  authDomain: 'tu-proyecto.firebaseapp.com',
  projectId: 'tu-proyecto',
  appId: '1:1234567890:web:abc123...',
};
```

Estas claves son públicas por diseño: lo que protege la partida de cada persona son las reglas de Firestore, no el secreto de estas claves.

## Probar en local

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

Si no existe `assets/wapuu/`, el juego carga el modelo directamente desde el repositorio original. Para tenerlo en local:

```bash
mkdir -p assets/wapuu
BASE=https://raw.githubusercontent.com/wckansai2016/3d-wapuu/master/models/for_the_3dcg/low_quality/obj
curl -L "$BASE/wapuu_low.obj" -o assets/wapuu/wapuu_low.obj
curl -L "$BASE/wp_logo.png"   -o assets/wapuu/wp_logo.png
```

## Publicación

La web se publica con GitHub Pages directamente desde la rama `main`: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)`**.

El modelo 3D no está en este repositorio: el juego lo descarga al arrancar desde [wckansai2016/3d-wapuu](https://github.com/wckansai2016/3d-wapuu). Si prefieres servirlo desde aquí, sube `wapuu_low.obj` y `wp_logo.png` a `assets/wapuu/` (y quita esa carpeta del `.gitignore`); el juego usa primero la copia local si existe.

## Créditos y licencia

- **Wapuu** fue diseñado por Kazuko Kaneuchi y es el personaje oficial de ja.wordpress.org ([jawordpressorg/wapuu](https://github.com/jawordpressorg/wapuu)), GPLv2 o posterior.
- **Modelo 3D de Wapuu** de Takeshi Kashihara ([wckansai2016/3d-wapuu](https://github.com/wckansai2016/3d-wapuu)), GPLv2 o posterior.
- El código de este juego se publica bajo **GPLv2 o posterior**, igual que WordPress.
