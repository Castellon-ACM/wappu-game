// Cocina de Wapuu: amplía FOODS (state.js) con muchos más alimentos y los ordena por categorías
// para la nevera. effects: puntos que suma o resta a cada necesidad (bladder negativo = le entran ganas de ir al baño).
import { FOODS } from './state.js';
import { World } from './world.js';

// Con la nevera abierta, la vista sube un poco para que se vea a Wapuu comiendo por encima de la hoja.
// setViewOffset desplaza la imagen de la cámara; las posiciones en pantalla y los toques siguen cuadrando.
World.prototype.liftView = function (px) { this._liftTarget = Math.max(0, px); };
World.prototype.liftNow = function () { return this._lift || 0; };
const baseUpdate = World.prototype.update;
World.prototype.update = function (...args) {
  const target = this._liftTarget || 0;
  const cur = this._lift || 0;
  if (target || cur) {
    const next = Math.abs(target - cur) < 0.5 ? target : cur + (target - cur) * 0.15;
    this._lift = next;
    const w = innerWidth, h = innerHeight;
    if (next > 0) this.camera.setViewOffset(w, h, 0, next, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }
  return baseUpdate.apply(this, args);
};

export const FOOD_CATS = [
  ['fruit', '🍎 Fruta'],
  ['meals', '🍽️ Comidas'],
  ['sweets', '🍰 Dulces'],
  ['drinks', '🥤 Bebidas'],
];

// Los siete alimentos que ya existían, cada uno en su categoría.
const BASE_CAT = { cookie: 'sweets', apple: 'fruit', coffee: 'drinks', water: 'drinks', pizza: 'meals', tortilla: 'meals', paella: 'meals' };
for (const f of FOODS) f.cat = BASE_CAT[f.id] || 'meals';

const f = (cat, id, emo, name, price, effects, say) => ({ id, emo, name, price, effects, say, cat });
FOODS.push(
  // ----- fruta y verdura -----
  f('fruit', 'banana', '🍌', 'Plátano', 4, { food: 16, energy: 4 }, 'Energía en forma de plátano.'),
  f('fruit', 'grapes', '🍇', 'Uvas', 5, { food: 12, fun: 4 }, 'Una, dos, tres… ¡doce!'),
  f('fruit', 'strawberry', '🍓', 'Fresas', 6, { food: 10, fun: 8 }, '¡Qué dulces!'),
  f('fruit', 'watermelon', '🍉', 'Sandía', 6, { food: 12, fun: 4, bladder: -12 }, 'Fresquita, como en verano.'),
  f('fruit', 'orange', '🍊', 'Naranja', 4, { food: 12, energy: 4, bladder: -4 }, 'Vitamina C a tope.'),
  f('fruit', 'pear', '🍐', 'Pera', 4, { food: 13 }, 'Jugosa.'),
  f('fruit', 'cherries', '🍒', 'Cerezas', 5, { food: 8, fun: 6 }, 'Me guardo el hueso.'),
  f('fruit', 'pineapple', '🍍', 'Piña', 7, { food: 16, fun: 4 }, 'Sin pizza, gracias.'),
  f('fruit', 'mango', '🥭', 'Mango', 7, { food: 16, fun: 5 }, '¡Tropical!'),
  f('fruit', 'peach', '🍑', 'Melocotón', 5, { food: 13, fun: 3 }, 'Suavecito.'),
  f('fruit', 'kiwi', '🥝', 'Kiwi', 4, { food: 11, energy: 3 }, 'Peludo por fuera, rico por dentro.'),
  f('fruit', 'carrot', '🥕', 'Zanahoria', 3, { food: 10, hygiene: 2 }, '¡Ahora veo mejor el código!'),
  f('fruit', 'broccoli', '🥦', 'Brócoli', 4, { food: 12, fun: -2, hygiene: 2 }, 'Sano… muy sano.'),
  f('fruit', 'avocado', '🥑', 'Aguacate', 8, { food: 20 }, 'Tostada de aguacate, qué moderno.'),
  f('fruit', 'corn', '🌽', 'Mazorca', 5, { food: 15 }, '¡Pop!'),
  // ----- comidas -----
  f('meals', 'burger', '🍔', 'Hamburguesa', 12, { food: 40, fun: 6, hygiene: -4 }, '¡Doble de queso!'),
  f('meals', 'fries', '🍟', 'Patatas fritas', 7, { food: 20, fun: 6, hygiene: -3 }, 'Con kétchup, por favor.'),
  f('meals', 'hotdog', '🌭', 'Perrito caliente', 8, { food: 26, fun: 4 }, 'Ni perro ni caliente, pero rico.'),
  f('meals', 'taco', '🌮', 'Taco', 9, { food: 28, fun: 6 }, '¡Ándale!'),
  f('meals', 'burrito', '🌯', 'Burrito', 11, { food: 38 }, 'Bien enrollado, como un buen bucle.'),
  f('meals', 'spaghetti', '🍝', 'Espaguetis', 11, { food: 40, fun: 4 }, 'Código espagueti, pero del bueno.'),
  f('meals', 'ramen', '🍜', 'Ramen', 12, { food: 42, energy: 4 }, 'Sorber es de buena educación.'),
  f('meals', 'sushi', '🍣', 'Sushi', 14, { food: 34, fun: 8 }, 'Itadakimasu.'),
  f('meals', 'curry', '🍛', 'Curry', 12, { food: 42 }, '¡Pica un poquito!'),
  f('meals', 'salad', '🥗', 'Ensalada', 8, { food: 24, hygiene: 3 }, 'Ligera y fresca.'),
  f('meals', 'sandwich', '🥪', 'Bocadillo', 7, { food: 26 }, 'Para el recreo.'),
  f('meals', 'egg', '🍳', 'Huevo frito', 5, { food: 16 }, 'Con puntilla.'),
  f('meals', 'stew', '🍲', 'Cocido', 14, { food: 50, energy: 6 }, 'Como el de la abuela.'),
  f('meals', 'chicken', '🍗', 'Muslo de pollo', 9, { food: 30 }, 'Crujiente.'),
  f('meals', 'dumpling', '🥟', 'Empanadilla', 6, { food: 18 }, '¡Rellena!'),
  f('meals', 'gazpacho', '🥣', 'Gazpacho', 6, { food: 14, energy: 4, bladder: -8 }, 'Fresquito del Sur.'),
  f('meals', 'jamon', '🍖', 'Jamón serrano', 15, { food: 30, fun: 10 }, 'Esto es lujo.'),
  f('meals', 'bread', '🥖', 'Pan con tomate', 5, { food: 16 }, 'Con su aceite de oliva.'),
  f('meals', 'cheese', '🧀', 'Queso', 7, { food: 20, fun: 3 }, 'Curado, del bueno.'),
  // ----- dulces -----
  f('sweets', 'donut', '🍩', 'Dónut', 6, { food: 12, fun: 10, energy: 4 }, 'Glaseado perfecto.'),
  f('sweets', 'cake', '🍰', 'Tarta', 10, { food: 18, fun: 14 }, '¡Un trocito más!'),
  f('sweets', 'birthday', '🎂', 'Tarta de cumpleaños', 25, { food: 25, fun: 30 }, '¡Cumpleaños feliz!'),
  f('sweets', 'icecream', '🍦', 'Helado', 7, { food: 10, fun: 14 }, '¡Que se derrite!'),
  f('sweets', 'chocolate', '🍫', 'Chocolate', 6, { food: 10, fun: 12, energy: 6 }, 'Chocolate = felicidad.'),
  f('sweets', 'candy', '🍬', 'Caramelo', 2, { food: 3, fun: 6 }, 'Solo uno…'),
  f('sweets', 'lollipop', '🍭', 'Piruleta', 3, { food: 3, fun: 8 }, '¡De colores!'),
  f('sweets', 'cupcake', '🧁', 'Magdalena', 5, { food: 12, fun: 8 }, 'Para mojar en leche.'),
  f('sweets', 'croissant', '🥐', 'Cruasán', 5, { food: 14, energy: 4 }, 'Desayuno de campeones.'),
  f('sweets', 'pancakes', '🥞', 'Tortitas', 9, { food: 26, fun: 8 }, 'Con sirope, claro.'),
  f('sweets', 'pretzel', '🥨', 'Pretzel', 5, { food: 14 }, 'Retorcido como un regex.'),
  f('sweets', 'popcorn', '🍿', 'Palomitas', 5, { food: 10, fun: 10 }, '¿Vemos una peli?'),
  f('sweets', 'flan', '🍮', 'Flan', 7, { food: 14, fun: 10 }, 'Tiembla como mi código en producción.'),
  f('sweets', 'pie', '🥧', 'Tarta de manzana', 9, { food: 22, fun: 8 }, 'Recién horneada.'),
  f('sweets', 'honey', '🍯', 'Miel', 4, { food: 6, energy: 8 }, 'Dulce como un commit limpio.'),
  f('sweets', 'fondue', '🫕', 'Fondue de chocolate', 12, { food: 18, fun: 18 }, '¡Moja, moja!'),
  f('sweets', 'mooncake', '🥮', 'Pastelito de luna', 8, { food: 16, fun: 10 }, 'Ñam bajo la luna.'),
  // ----- bebidas -----
  f('drinks', 'milk', '🥛', 'Leche', 3, { food: 8, energy: 4, bladder: -8 }, 'Bigote de leche.'),
  f('drinks', 'juice', '🧃', 'Zumo', 4, { food: 6, energy: 6, bladder: -10 }, 'Con pajita.'),
  f('drinks', 'tea', '🍵', 'Té verde', 4, { energy: 10, fun: 2, bladder: -8 }, 'Zen.'),
  f('drinks', 'bubbletea', '🧋', 'Té de burbujas', 8, { food: 8, fun: 12, bladder: -12 }, '¡Bolitas!'),
  f('drinks', 'soda', '🥤', 'Refresco', 4, { energy: 6, fun: 8, bladder: -14 }, '¡Burbujas!'),
  f('drinks', 'tropical', '🍹', 'Batido tropical', 7, { food: 10, fun: 8, bladder: -10 }, 'Sabe a vacaciones.'),
  f('drinks', 'energy', '🔋', 'Bebida energética', 9, { energy: 30, fun: -2, bladder: -12 }, '¡Modo turbo!'),
  f('drinks', 'coconut', '🥥', 'Agua de coco', 6, { energy: 6, hygiene: 2, bladder: -10 }, 'Como en la playa.'),
);
