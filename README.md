# TORNEIG FUTBOLÍ 2027

Aplicación para Falla L’Alquerieta i Museu Faller. **Una única pantalla** para inscribir parejas, hacer el sorteo, introducir resultados y seguir el torneo. No utiliza vídeos.

## Abrir

Doble clic en `../ABRIR_APP.cmd`, o:

```powershell
npm install
npm run dev
```

Abre **http://localhost:5173/**. Mantén el servidor abierto durante el torneo. Usa el botón de pantalla completa para la TV. Node.js 20.19+ o 22+ y un navegador moderno son necesarios; los recursos se sirven localmente.

Para producción: `npm run build` y `npm run preview` (http://localhost:4173/). Cada dirección, puerto y perfil de navegador tiene sus propios datos: exporta/importa para trasladarlos.

## Cómo funciona

1. Inscribe entre **6 y 30 parejas**, incluidos números impares. Puedes editar o retirar parejas antes de empezar; la lista masiva acepta `Equipo; Jugador 1; Jugador 2` por línea.
2. Realiza el sorteo y revisa los tres grupos. Si una baja desequilibra las asignaciones, repite el sorteo antes de confirmar.
3. Al comenzar, aparecen los tres futbolines. **Introduce las dos partidas directamente en cada tarjeta**, pulsa Guardar y confirma. El siguiente encuentro de esa mesa comienza automáticamente.
4. La mascota reacciona a la edición, resultados y cambios de fase. La guía inferior indica cuándo resolver desempates, anunciar clasificados y avanzar.
5. En una eliminatoria con 1–1 aparece la tercera partida. Tras la final se celebra el campeón.

**Modo prueba:** el botón visible crea 30 parejas ficticias, sortea grupos y pone las tres mesas en juego, sin resultados inventados inicialmente. Puedes introducirlos tú o usar «Simular fase» para explorar las rondas. «Tornar al real» recupera la copia del torneo real anterior a la prueba.

Seguimiento, clasificación, próximos encuentros y camino a la copa son vistas de la misma aplicación. Los **tres futbolines permanecen visibles y montados** al cambiar de vista, también durante los cruces, la final y la celebración. Las mesas sin partido quedan en espera. Los modelos animados no inventan goles ni terminan encuentros por tiempo.

## Reglas

Tres grupos equilibrados con diferencia máxima de una pareja. Cada grupo juega todos contra todos; los descansos en grupos impares no generan puntos ni encuentros ficticios.

| Parejas | Grupos | Enfrentamientos de grupos |
| --- | --- | --- |
| 26 | 9 / 9 / 8 | 100 |
| 27 | 9 / 9 / 9 | 108 |
| 28 | 10 / 9 / 9 | 117 |
| 29 | 10 / 10 / 9 | 126 |
| 30 | 10 / 10 / 10 | 135 |

Cada enfrentamiento tiene dos partidas. Cada partida ganada da un punto: 2–0, 1–1 o 0–2. No hay punto adicional por ganar el enfrentamiento. Los resultados son enteros de 0 a 999; una partida individual no puede empatar.

PJ = enfrentamientos jugados; PG = partidas ganadas; PP = partidas perdidas; GF/GC = goles; DIF = diferencia; PTS = puntos. Desempates predeterminados: puntos, diferencia, goles a favor, directo y orden manual. Los criterios son configurables antes de fijar los seeds.

Pasan los seis primeros de cada grupo, o todos cuando hay menos de seis. Entre grupos desiguales se comparan por defecto puntos, diferencia y goles por enfrentamiento jugado para evitar la ventaja de tener más partidos. La organización confirma empates restantes. Dentro de cada grupo se usan totales.

Con 18 clasificados, la previa es **1 contra 18 y 2 contra 17**, con los seeds 3–16 exentos, tal como exige el documento. Después se reordenan los supervivientes por seed original y se enfrenta mejor contra peor en cada ronda. Octavos → cuartos → semifinales → final. Con menos de 18 participantes la previa se adapta a la potencia de dos inferior.

## Guardado y correcciones

- Guardado automático en el navegador y recuperación al volver a abrir.
- Historial permite corregir resultados. Una corrección en una fase anterior pide confirmar la retirada de las rondas dependientes.
- Deshacer conserva las últimas 12 acciones.
- Ajustes incluye exportación/importación JSON, copia anterior y copia periódica cada minuto. Importar valida los datos antes de sustituirlos. Reiniciar tiene doble confirmación.
- Mismo navegador, perfil y origen: sincronización entre pestañas mediante Web Locks, BroadcastChannel y `storage`. **No hay sincronización entre dispositivos.** Para el evento, usa el ordenador conectado a la TV.
- Conserva una copia externa del torneo; borrar datos del navegador elimina el almacenamiento local.

En producción se incluye una caché del programa, imágenes y fuentes tras la primera visita. El servidor local permite utilizarlo sin Internet. La primera instalación requiere descargar dependencias.

## Diseño y animación

Composición 16:9 ajustada a las referencias F1/F2/F3: fondo azul de grada, guirnaldas, título en pinceladas, escudo oficial integrado y tres columnas roja, azul y amarilla. Escala a 1080p y 4K; el móvil muestra las mesas apiladas.

Futbolines con Three.js: madera, barras cromadas, jugadores, sombras, pelota, movimiento de barras y efectos al introducir resultados. Recurso CSS de respaldo si WebGL no está disponible. La mascota oficial tiene cuatro poses transparentes y keyframes; las ceremonias anuncian una a una las parejas clasificadas. Framer Motion anima marcadores y clasificaciones. Audio de eventos opcional, inicialmente apagado. Se respeta movimiento reducido.

El fondo y las poses se generaron con ImageGen a partir de los recursos oficiales. Archivos finales: `public/assets/arena-background.png`, `public/assets/mascot-poses.png`. Prompts utilizados: `public/assets/art-prompts.txt`. Los originales siguen en la carpeta superior. Fuentes Barlow y Barlow Condensed locales; iconos Lucide; copa SVG.

## Desarrollo

React, TypeScript, Vite, Three.js, Framer Motion y Zod.

- `src/components/BroadcastApp.tsx`: interfaz única, inscripción, resultados y guía.
- `src/components/Table3D.tsx`: modelos y animación.
- `src/components/MascotActor.tsx`: poses y actuación de la mascota.
- `src/engine/`: calendario, puntuación, desempates, fases y práctica.
- `src/store.ts`: persistencia, copias y sincronización local.
- `src/arena.css`: composición y animaciones.
- `tests/engine.test.ts`: pruebas de reglas y recorridos completos.

`npm test` ejecuta 21 pruebas de calendarios pares/impares, correcciones, clasificación, previa, todas las rondas y validación de copias. `npm run build` comprueba TypeScript y genera la aplicación con caché offline.

WebMCP expone lectura del estado si el navegador admite `document.modelContext`; es opcional y no altera resultados.
