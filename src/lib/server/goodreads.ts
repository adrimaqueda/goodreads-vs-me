// Scraping de Goodreads. Vive en $lib/server para que nunca acabe en el cliente.
import { error } from '@sveltejs/kit';
import { parse, type HTMLElement } from 'node-html-parser';
import Parser from 'rss-parser';
import type { Book, BookMetadata } from '$lib/books';

const PER_PAGE = 200;
// Tope de seguridad por si Goodreads ignorase la paginación (10.000 libros).
const MAX_PAGES = 50;
const TIMEOUT_MS = 10_000;
// Peticiones simultáneas a Goodreads al analizar un lote de libros.
const CONCURRENCY = 10;

const INVALID_USER_MESSAGE =
	'No he encontrado ninguna librería con ese ID. Comprueba que sea correcto. Si tienes perfil de autor, tu ID de autor no sirve: entra en "My Books" y copia el número que aparece en la URL (goodreads.com/review/list/TU_ID).';

const GENRE_SELECTOR = [
	'[data-testid="genresList"] .Button__labelItem',
	'.BookPageMetadataSection__genreButton .Button__labelItem',
	'.BookPageMetadataSection__genres a.Button--tag .Button__labelItem',
	'a.bookPageGenreLink',
	'.bookPageGenres a'
].join(', ');

// Etiquetas de la lista de géneros que no son géneros.
const NOT_GENRES = new Set(['...more', 'Audiobook', 'Book Club']);

const rssParser = new Parser();

// Cachés de la instancia: la lista de cada usuario dura poco, para que los
// libros nuevos aparezcan pronto; los metadatos de cada libro (lo lento de
// obtener) casi nunca cambian y se comparten entre usuarios.
const bookLists = createCache<Book[]>(100, 60 * 60 * 1000);
const metadataCache = createCache<BookMetadata>(20_000, 7 * 24 * 60 * 60 * 1000);

/**
 * Libros del usuario con los metadatos que ya estén en caché, y las URLs de los
 * libros puntuados (los que usan las estadísticas) que aún hay que analizar.
 */
export async function getLibrary(userId: string) {
	let list = bookLists.get(userId);
	if (!list) {
		list = await fetchBooks(userId);
		bookLists.set(userId, list);
	}

	const pending = new Set<string>();
	const books = list.map((book) => {
		const metadata = metadataCache.get(book.url);
		if (!metadata && book.url && book.rating > 0) pending.add(book.url);
		return { ...book, ...metadata };
	});

	return { books, pending: [...pending] };
}

/** Géneros y número de páginas de cada libro, con varias peticiones a la vez. */
export async function getMetadata(urls: string[]) {
	const results: (BookMetadata & { url: string })[] = [];
	let next = 0;

	async function worker() {
		while (next < urls.length) {
			const url = urls[next++];
			results.push({ url, ...(await getBookMetadata(url)) });
		}
	}

	await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
	return results;
}

/**
 * URL canónica de la ficha de un libro, o null si no es una ficha de Goodreads.
 * El servidor sólo analiza URLs así, de modo que nunca pide nada a otros sitios.
 */
export function toBookUrl(url: unknown): string | null {
	const match =
		typeof url === 'string' && url.match(/^https?:\/\/(?:www\.)?goodreads\.com\/book\/show\/(\d+)/);
	return match ? `https://www.goodreads.com/book/show/${match[1]}` : null;
}

async function fetchBooks(userId: string): Promise<Book[]> {
	const books: Book[] = [];

	for (let page = 1; page <= MAX_PAGES; page++) {
		const items = await fetchRssPage(userId, page);
		for (const item of items) books.push(toBook(item, books.length));
		if (items.length < PER_PAGE) break;
	}

	return books;
}

async function fetchRssPage(userId: string, page: number) {
	const response = await get(
		`https://www.goodreads.com/review/list_rss/${userId}?per_page=${PER_PAGE}&page=${page}`
	);

	if (response.status === 401) {
		error(403, '🔒 La librería de este usuario es privada. No puedo acceder a los libros.');
	}
	// Un 404 significa que el ID no corresponde a ningún usuario: suele pasar al
	// introducir un ID de perfil de autor, que no está ligado a la librería.
	if (response.status === 404) error(404, INVALID_USER_MESSAGE);
	if (!response.ok) {
		error(
			502,
			`Goodreads respondió con un error (HTTP ${response.status}). Inténtalo de nuevo en un rato.`
		);
	}

	const xml = await response.text();
	try {
		return (await rssParser.parseString(xml)).items;
	} catch {
		// Respuesta 200 sin RSS válido: lo tratamos como ID no válido en vez de
		// enseñar un error de parseo XML críptico.
		error(404, INVALID_USER_MESSAGE);
	}
}

function toBook(item: Parser.Item, id: number): Book {
	const fields = parseDescription(item.content ?? '');

	return {
		id,
		title: item.title ?? '',
		author: fields.author ?? '',
		url: toBookUrl(fields.url) ?? '',
		img: fields.img,
		rating: Number(fields.rating) || 0,
		average: Number(fields['average rating']) || 0,
		published: fields['book published'] ?? '',
		readAt: fields['read at'] ?? '',
		addedAt: item.isoDate ?? '',
		// Los libros que sólo están en "read" llegan sin estanterías.
		shelves: fields.shelves ? fields.shelves.split(', ') : ['read'],
		genres: [],
		numberOfPages: 0
	};
}

// La descripción de cada libro del RSS es HTML: la portada enlazada a la ficha
// y una línea "clave: valor" por dato (author, rating, read at, shelves...).
function parseDescription(html: string): Record<string, string> {
	const root = parse(html);
	const fields: Record<string, string> = {
		url: root.querySelector('a')?.getAttribute('href') ?? '',
		img: root.querySelector('img')?.getAttribute('src') ?? ''
	};

	// Los <br> se convierten en saltos de línea en textContent.
	for (const line of root.textContent.split('\n')) {
		const [key, ...value] = line.split(':');
		// La reseña va al final y puede tener líneas con ":", así que manda la
		// primera aparición de cada clave.
		if (value.length) fields[key.trim()] ??= value.join(':').trim();
	}

	return fields;
}

async function getBookMetadata(url: string): Promise<BookMetadata> {
	const cached = metadataCache.get(url);
	if (cached) return cached;

	try {
		const metadata = await scrapeBookMetadata(url);
		metadataCache.set(url, metadata);
		return metadata;
	} catch (err) {
		// Los fallos no se cachean: se reintentan en la siguiente carga.
		console.warn(`⚠️ No se pudieron obtener los metadatos de ${url}:`, err);
		return { genres: [], numberOfPages: 0 };
	}
}

async function scrapeBookMetadata(url: string): Promise<BookMetadata> {
	const response = await get(url);
	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const page = parse(await response.text());
	const genres = new Set<string>();
	for (const node of page.querySelectorAll(GENRE_SELECTOR)) {
		const genre = node.textContent.replace(/\s+/g, ' ').trim();
		if (genre && !NOT_GENRES.has(genre)) genres.add(genre);
	}

	return { genres: [...genres], numberOfPages: getNumberOfPages(page) };
}

// El número de páginas viene en los datos estructurados (JSON-LD) de la ficha.
function getNumberOfPages(page: HTMLElement): number {
	for (const script of page.querySelectorAll('script[type="application/ld+json"]')) {
		try {
			const pages = Number.parseInt(JSON.parse(script.rawText).numberOfPages, 10);
			if (pages > 0) return pages;
		} catch {
			// JSON-LD mal formado: probamos con el siguiente.
		}
	}
	return 0;
}

async function get(url: string): Promise<Response> {
	try {
		return await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
	} catch {
		error(504, 'Goodreads no responde. Inténtalo de nuevo en un rato.');
	}
}

/** Caché en memoria con caducidad y tamaño máximo (sale la entrada más antigua). */
function createCache<T>(maxEntries: number, ttlMs: number) {
	const entries = new Map<string, { value: T; expires: number }>();

	return {
		get(key: string): T | undefined {
			const entry = entries.get(key);
			if (entry && entry.expires > Date.now()) return entry.value;
			entries.delete(key);
			return undefined;
		},
		set(key: string, value: T) {
			entries.delete(key);
			if (entries.size >= maxEntries) entries.delete(entries.keys().next().value!);
			entries.set(key, { value, expires: Date.now() + ttlMs });
		}
	};
}
