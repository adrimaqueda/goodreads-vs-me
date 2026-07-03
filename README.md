# 📚 Goodreads vs Me

Una aplicación web moderna para analizar y visualizar tu perfil de Goodreads. Descubre patrones en tus lecturas, compara tus puntuaciones con la comunidad global y obtén insights sobre tus hábitos de lectura.

Puedes probarla en este enlace [goodreads-vs-me.vercel.app](goodreads-vs-me.vercel.app)

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

1. **Obtén tu ID de Goodreads**
   - Ve a tu perfil en [goodreads.com](https://www.goodreads.com)
   - Copia el número de tu URL: `goodreads.com/user/show/[TU_ID]`

2. **Ingresa tu ID**
   - Pega el ID en el campo de entrada de la aplicación
   - Haz clic en "Buscar"

3. **Explora tus datos**
   - Visualiza el gráfico comparativo
   - Filtra libros por estantería o puntuación
   - Interactúa con el gráfico de dispersión seleccionando diferentes variables
   - Pasa el cursor sobre los círculos del gráfico para ver detalles
   - Cambia de año para ver el análisis de géneros por período

## 📦 Estructura del Proyecto

```
goodreads-review/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte       # Layout principal
│   │   ├── +page.svelte         # Página principal
│   │   └── scrape.remote.ts     # Lógica de scraping
│   ├── lib/
│   │   ├── BooksList.svelte     # Componente de librería
│   │   ├── Compare.svelte       # Componente de análisis
│   │   ├── YearSummary.svelte   # Análisis por año con gráficos
│   │   ├── goodreads.ts         # Utilidades
│   │   └── chartComponents/     # Componentes D3
│   ├── app.html                 # HTML base
│   └── assets/                  # Imágenes y favicons
├── package.json
├── svelte.config.js
└── vite.config.js
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
