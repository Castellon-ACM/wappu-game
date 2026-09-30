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

Programar cansa y da hambre, así que hay que equilibrar trabajo y descanso. La partida se guarda en el navegador.

**Crece contigo.** Wapuu empieza siendo un bebé (pequeño y con los ojos grandes) y crece con cada nivel: bebé, pequeño, joven y adulto a partir del nivel 7. Por el camino gana títulos, de *Becario del plugin* a *Leyenda del WordCamp*.

**Se ensucia.** Si su higiene baja del 55 %, le salen manchas que van a más, y cuando está muy sucio le rondan moscas. Frotarle con jabón y la ducha le dejan limpio otra vez.

**Tienda de cosméticos** (🛍️ arriba o en el salón): flor, lazo, gorro de fiesta, gafas de pasta, gafas de sol, gorra WordPress, chistera y corona. Algunos se desbloquean por nivel. Se puede llevar uno por zona (cabeza, cara y oreja).

## Tecnología

- HTML, CSS y JavaScript sin compilación.
- [three.js](https://threejs.org/) 0.160 desde jsDelivr para el 3D.
- Sonidos generados con WebAudio.
- Guardado en `localStorage`.

```
index.html
css/style.css
js/main.js    → lógica del juego e interfaz
js/world.js   → escena 3D, habitaciones y animaciones de Wapuu
js/state.js   → necesidades, niveles y guardado
js/audio.js   → efectos de sonido
```

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
