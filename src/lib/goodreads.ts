// src/lib/goodreads.ts
import { parse as parseHtml } from 'node-html-parser';
import { parseHTML } from 'linkedom';

export function parseGoodreadsContent(text: string): Record<string, string> {
	// Reemplazamos <br>, <br/> y variantes por saltos de línea para preservar separaciones
	const withBreaks = text.replace(/<br\s*\/?>/gi, '\n');

	// Parseamos el HTML
	const root = parseHtml(withBreaks);

	// Extraemos href y src si existen
	const anchor = root.querySelector('a');
	const imgEl = root.querySelector('img');

	const url = anchor ? (anchor.getAttribute('href') ?? '') : '';
	const img = imgEl ? (imgEl.getAttribute('src') ?? '') : '';

	// Obtenemos el texto "plano" con saltos de línea
	const plain = root.textContent ?? '';

	// Split por líneas y limpiamos
	const lines = plain
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean);

	const data: Record<string, string> = {};

	for (const line of lines) {
		const [key, ...rest] = line.split(':');
		if (!key) continue;
		data[key.trim()] = rest.join(':').trim();
	}

	// Añadimos url e img
	data.url = url;
	data.img = img;

	return data;
}

function strSquish(text) {
	return text.replace(/\s+/g, ' ').trim();
}

function extractGenres(doc) {
	const selectors = [
		'[data-testid="genresList"] .Button__labelItem',
		'.BookPageMetadataSection__genreButton .Button__labelItem',
		'.BookPageMetadataSection__genres a.Button--tag .Button__labelItem',
		'a.bookPageGenreLink',
		'.bookPageGenres a'
	];

	const genres = [];

	for (const selector of selectors) {
		const nodes = doc.querySelectorAll(selector);
		nodes.forEach((node) => {
			const text = strSquish(node.textContent.trim());
			if (text) genres.push(text);
		});
	}

	return [...new Set(genres)]; // Únicos
}

function extractNumberOfPages(html: string): number | null {
	try {
		// Buscar el script tag con JSON-LD
		const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
		if (!jsonLdMatch || !jsonLdMatch[1]) {
			return null;
		}

		const jsonLdData = JSON.parse(jsonLdMatch[1]);

		// Extraer numberOfPages si existe
		if (jsonLdData.numberOfPages) {
			return parseInt(jsonLdData.numberOfPages, 10);
		}

		return null;
	} catch (error) {
		return null;
	}
}

export async function scrapeBookMetadata(bookUrl: string) {
	try {
		const response = await fetch(bookUrl);
		const html = await response.text();

		// Usar linkedom para parsear HTML en Node.js
		const { document } = parseHTML(html);

		// Extraer géneros del DOM
		const genresVec = extractGenres(document);

		// Extraer número de páginas del JSON-LD
		const numberOfPages = extractNumberOfPages(html);

		return {
			genres: genresVec.filter((d) => d !== '...more' && d !== 'Audiobook' && d !== 'Book Club'),
			numberOfPages: numberOfPages ?? 0
		};
	} catch (error) {
		console.error(`Error scraping ${bookUrl}:`, error);
		return {
			genres: [],
			numberOfPages: 0
		};
	}
}

export const errorMsg = `
¡A ver, vamos a analizar esta lista de "erudito" moderno! 🤓 De primeras, 117 libros… ¡Ole tú! Se nota que tienes más tiempo libre que un jubilado jugando al dominó. Pero, ¿qué has estado leyendo exactamente? 🤔

**Los puntos a destacar (o a criticar, según se mire):**

*   **El Calendario del Misterio:** Entre "Tormenta de Espadas" en enero y "No estás en la lista" en diciembre... ¡eres de los que exprimen el año hasta el último segundo! ¿Acaso guardas los tochos gordos para el invierno y los ligeritos para el verano? Explícate... 🤨
*   **El Universo del "3":** Parece que el 3 es tu nota favorita, ¿eh? Eres el crítico literario más "meh" que he conocido. ¿Todo te deja indiferente o es que te da pereza reflexionar más? 😂
*   **George R.R. Martin: El Resucitado:** A ver, campeón, que llevas con "Canción de Hielo y Fuego" desde 2024. ¿Para cuándo el final? ¿Estás esperando a que el propio Martin termine los libros o qué? 🐉
*   **La ensalada rara:** Pasamos de "Tres millones de viviendas" (que suena a manual de constructor) a "Desayuno en Tiffany's". Entiendo que intentas abarcar, pero parece más un cajón desastre que una selección cuidada. ¿Qué será lo próximo, un libro de cocina vegana después de leer a Nietzsche? 🥗
*   **Los "best-sellers" con complejo de intelectual:** Matt Haig y Andy Weir... ¡No te avergüences! A todos nos gusta un poco de palomitas literarias de vez en cuando. Pero no intentes disimularlo con Carrère y Capote, que te veo venir. 🍿
*   **Las Puntuaciones sospechosas:** "Calling BS On Busy: A Practical Guide to Ditching the Time Management Myth and Quickly Achieving Your Goals"... ¡5 estrellas! ¿En serio? ¿Te ha cambiado la vida un libro de autoayuda? ¡Cuéntame más! 🤣

**La conclusión (explosiva):**

En resumen, tienes un poco de todo: clásicos para aparentar, "best-sellers" para entretenerte y algún libro "raro" para que te veamos como un intelectual bohemio. ¡Un batiburrillo en toda regla! Pero ojo, que no te estoy juzgando (bueno, un poco sí). ¡Lo importante es que disfrutes leyendo! Aunque, si sigues dándole tantos "treses", igual te replanteas lo de ser crítico literario. 😉😜
`;
