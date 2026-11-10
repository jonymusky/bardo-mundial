# Bardo Mundial

Artillería por turnos con humanos de verdad, gratis y en el navegador.
**[Jugar →](https://bardo-mundial.jonymusky.com/)**

[![Tráiler de Bardo Mundial](public/media/poster.jpg)](https://bardo-mundial.jonymusky.com/)

🇺🇸 [English](#english) · 🇧🇷 [Português](#português)

## Qué es

Armás un equipo, elegís una de nueve ciudades y resolvés las diferencias contra la computadora con misiles
guiados, drones, perros robot, láser orbital y jetpack. Todo el terreno se rompe.

- **Equipo a medida:** país, identidad, piel, cuerpo, peinado, ropa y accesorios.
- **Nueve ciudades:** Buenos Aires, Nueva York, París, Londres, Tokio, Río, Sídney, Dubái y El Cairo.
- **Física e iluminación:** viento, rebotes, cráteres, muerte súbita y luces dinámicas con WebGL.
- **Tres idiomas:** español, inglés y portugués.

## Por qué existe

Este juego es mi banco de pruebas para modelos de IA: cada vez que sale uno nuevo, le pido que lleve el mismo
juego un paso más lejos y veo qué puede hacer de verdad.

Esta versión se hizo conversando:

- **Código:** Claude Code (Claude Fable 5.2).
- **Ilustraciones:** generador de imágenes de Codex, 82 pedidos. Las descripciones usadas están en
  [`art-src/tools`](art-src/tools).
- **Sonido y música:** sintetizados en el navegador con WebAudio, sin archivos de audio.
- **Tráiler:** capturado cuadro por cuadro del propio juego, con la banda de sonido renderizada por el mismo
  sintetizador ([`scripts/trailer`](scripts/trailer)).

## Desarrollo

Necesita Node 24 o superior.

```sh
npm install
npm run dev        # http://localhost:5173 — portada en /, juego en /play.html
npm test           # partidas CPU contra CPU: terminan y son reproducibles
npm run build      # verifica tipos y genera dist/
```

En desarrollo, `play.html?seed=42&city=tokyo` arranca directo una partida reproducible.

## Cómo está armado

| Carpeta | Qué hay |
|---|---|
| `src/sim` | Simulación sin DOM: terreno destructible, física, armas y la IA de la CPU. Avanza a paso fijo y solo cambia con comandos serializables. |
| `src/render.ts`, `src/lighting.ts` | Dibujo en Canvas 2D y pase de iluminación en WebGL2 (con respaldo si no hay WebGL2). |
| `src/avatar.ts`, `src/headArt.ts` | Personajes armados por capas y teñidos con los colores del editor. |
| `src/i18n.ts` | Todos los textos, en los tres idiomas. |
| `src/landing.ts`, `index.html` | Portada con el tráiler y sus subtítulos por idioma. |
| `public/art` | Arte que usa el juego (WebP). |
| `art-src` | Herramientas y descripciones con las que se generó y procesó el arte. |
| `scripts/trailer` | Captura y montaje del tráiler. |

La simulación es determinista a propósito: la etapa siguiente es jugar online enviando esos mismos comandos.

### Rehacer el tráiler

Con `npm run dev -- --port 5199` corriendo, Google Chrome y ffmpeg instalados:

```sh
npm run trailer
```

## Publicación

Cada push a `main` corre las pruebas, compila y publica en GitHub Pages
([workflow](.github/workflows/pages.yml)). El build usa rutas relativas, así que sirve igual en el dominio
propio y en `usuario.github.io/repo/`.

## Licencia

Código bajo [MIT](LICENSE). Los originales de las ilustraciones a resolución completa no están en el
repositorio; las versiones que usa el juego están en `public/art`.

---

## English

Turn-based artillery with actual humans, free in your browser.
**[Play →](https://bardo-mundial.jonymusky.com/)**

Build a squad, pick one of nine cities and settle your differences against the computer with guided missiles,
drones, robot dogs, an orbital laser and a jetpack. Every bit of terrain breaks.

**Why it exists.** This game is my test bench for AI models: whenever a new one comes out, I ask it to take the
same game one step further and see what it can really do. This version was built in conversation: Claude Code
(Claude Fable 5.2) wrote the code, the illustrations came from Codex image generation (82 requests), and sound
and music are synthesized in the browser. The trailer was captured frame by frame from the game itself.

**Develop.** Node 24+. `npm install`, `npm run dev`, `npm test`, `npm run build`. Code is MIT-licensed.

## Português

Artilharia por turnos com humanos de verdade, grátis no navegador.
**[Jogar →](https://bardo-mundial.jonymusky.com/)**

Monte um time, escolha uma de nove cidades e resolva as diferenças contra o computador com mísseis guiados,
drones, cães-robô, laser orbital e jetpack. Todo o terreno quebra.

**Por que existe.** Este jogo é a minha bancada de testes para modelos de IA: sempre que sai um novo, peço que
leve o mesmo jogo um passo adiante e vejo o que ele consegue fazer de verdade. Esta versão foi feita
conversando: o Claude Code (Claude Fable 5.2) escreveu o código, as ilustrações vieram do gerador de imagens do
Codex (82 pedidos), e o som e a música são sintetizados no navegador. O trailer foi capturado quadro a quadro
do próprio jogo.

**Desenvolver.** Node 24+. `npm install`, `npm run dev`, `npm test`, `npm run build`. Código sob licença MIT.
