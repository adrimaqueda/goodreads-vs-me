# 📚 Goodreads vs Me

Una aplicación web moderna para analizar y visualizar tu perfil de Goodreads. Descubre patrones en tus lecturas, compara tus puntuaciones con la comunidad global y obtén insights sobre tus hábitos de lectura.

Puedes probarla en este enlace [goodreads-vs-me.vercel.app](https://goodreads-vs-me.vercel.app)

## 🎯 Características

### 📊 Análisis Comparativo

- Compara tus puntuaciones con el promedio global de Goodreads
- Visualiza la diferencia entre tu opinión y la comunidad
- Identifica libros que puntuaste diferente al resto de usuarios
- Gráfico interactivo con simulación de fuerzas para tener una referencia visual

### 📈 Visualización Avanzada de Datos

- **Gráfico de dispersión interactivo**: Analiza la relación entre variables de lectura
- **Selección dinámica de ejes**: Compara páginas por libro, puntuación media, total de páginas y años
- **Tooltips con anchor-position**: Información detallada al pasar el cursor sobre los círculos
- **Escala automática de datos**: Ajustes inteligentes según el tipo de variable

### 📖 Listado de libros

- Visualiza todos tus libros en una galería moderna
- Filtra por estanterías (Leyendo, Por leer, Leído...)
- Filtra por puntuación (1-5 estrellas)
- Tarjetas interactivas con información del libro
- Etiquetas con puntuación y fecha de lectura

### 💡 Insights Inteligentes

- Descubre cuáles son los libros que puntuaste de forma más conservadora
- Identifica tus libros favoritos comparados con la media
- Estadísticas generales de tu actividad de lectura
- Análisis de géneros por año con animaciones fluidas

## 🚀 Stack Tecnológico

- **Desarrollo**: [Svelte 5](https://svelte.dev) y [SvelteKit](https://kit.svelte.dev)
- **Visualización**: [D3.js](https://d3js.org)

## 📝 Cómo Usar

1. **Copia tu perfil de Goodreads**
   - Ve a tu perfil en [goodreads.com](https://www.goodreads.com) y copia la URL (`goodreads.com/user/show/[TU_ID]-tu-nombre`)
   - Si tienes perfil de autor, usa la URL de _My Books_ (`goodreads.com/review/list/[TU_ID]`): el ID de autor no sirve

2. **Pégalo en la aplicación**
   - Vale la URL completa o sólo el número
   - Haz clic en "Buscar"
   - La dirección de la página (`?id=TU_ID`) sirve para volver a tus resultados o compartirlos

3. **Explora tus datos**
   - Visualiza el gráfico comparativo
   - Filtra libros por estantería o puntuación
   - Interactúa con el gráfico de dispersión seleccionando diferentes variables
   - Pasa el cursor sobre los círculos del gráfico para ver detalles
   - Cambia de año para ver el análisis de géneros por período

## 📦 Estructura del Proyecto

```
goodreads-vs-me/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte       # Layout principal y metaetiquetas
│   │   ├── +page.svelte         # Página principal: buscador y carga por lotes
│   │   └── scrape.remote.ts     # Remote functions: lista de libros y metadatos
│   ├── lib/
│   │   ├── server/goodreads.ts  # Scraping de Goodreads (RSS y fichas), sólo servidor
│   │   ├── books.ts             # Tipo Book y utilidades compartidas
│   │   ├── Compare.svelte       # Tus puntuaciones frente a la media
│   │   ├── YearSummary.svelte   # Géneros y resumen por año
│   │   ├── BooksList.svelte     # Galería de libros con filtros
│   │   ├── Star.svelte          # Icono de estrella
│   │   └── chartComponents/     # Formas para dibujar en canvas
│   └── app.html                 # HTML base
├── static/                      # Favicons, imagen para redes y manifest
├── package.json
├── svelte.config.js
└── vite.config.js
```

### Cómo se cargan los datos

1. `getBookList` lee el RSS público de la librería (200 libros por página) y
   devuelve los libros junto con las URLs de los libros puntuados cuyos géneros
   y número de páginas aún no conoce.
2. El navegador pide esos metadatos por lotes de 20 con `fetchMetadataBatch`,
   que sólo acepta fichas de `goodreads.com/book/show/…`, y muestra el progreso.
3. El servidor guarda en memoria la lista de cada usuario (1 hora) y los
   metadatos de cada libro (7 días, compartidos entre usuarios), así que las
   siguientes cargas son casi instantáneas.

## 🛠️ Desarrollo

```sh
npm install
npm run dev     # servidor de desarrollo
npm run check   # comprobación de tipos (svelte-check)
npm run lint    # formato (prettier)
npm run build   # build de producción (adapter de Vercel)
```

## 🤝 Contribuciones

En principio no voy a realizar un mantenimiento activo de esta página, ya que es únicamente un side-project para probar las remote functions de SvelteKit. Pero si quieres añadir alguna mejora puedes hacerlo así:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

¡Si encuentras problemas o tienes sugerencias soy todo oídos!

---

**Desarrollado con ❤️ para los amantes de los libros**
