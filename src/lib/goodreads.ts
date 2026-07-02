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
