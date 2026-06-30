import { command } from '$app/server';
import Parser from 'rss-parser';
import { parseGoodreadsContent, scrapeBookMetadata } from '$lib/goodreads';

class PrivateShelfError extends Error {
	constructor(message: string = "That person's shelf is private") {
		super(message);
		this.name = 'PrivateShelfError';
	}
}

interface GoodreadsRSSItem {
	title?: string;
	pubDate?: string;
	isoDate?: string;
	content?: string;
	contentSnippet?: string;
	link?: string;
	guid?: string;
}

interface CachedData {
	lastUpdate: string | undefined;
	books: any[];
	shelves: string[];
	timestamp: number;
	userId: string;
}

const parser = new Parser({});

// Caché de datos completos por usuario (libros + metadatos ya scrapeados).
const caches = new Map<string, CachedData>();
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 1 día

// Caché de metadatos por URL de libro: el mismo libro (compartido entre
// usuarios y entre recargas) sólo se scrapea una vez por instancia.
type BookMetadata = Awaited<ReturnType<typeof scrapeBookMetadata>>;
const metadataCache = new Map<string, BookMetadata>();

// Límite de peticiones simultáneas al scrapear metadatos dentro de un lote.
const SCRAPE_CONCURRENCY = 10;

async function getBookMetadata(url: string): Promise<BookMetadata> {
	const cached = metadataCache.get(url);
	if (cached) return cached;

	const metadata = await scrapeBookMetadata(url);
	metadataCache.set(url, metadata);
	return metadata;
}

async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let cursor = 0;

	async function worker() {
		while (cursor < items.length) {
			const index = cursor++;
			results[index] = await fn(items[index], index);
		}
	}

	const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
	await Promise.all(workers);
	return results;
}

async function fetchRssPage(userId: string, page: number, perPage: number) {
	const url = `https://www.goodreads.com/review/list_rss/${userId}?per_page=${perPage}&page=${page}`;
	const response = await fetch(url);
	const xml = await response.text();

	if (response.status === 401 && xml.includes("Sorry, that person's shelf is private")) {
		throw new PrivateShelfError();
	}

	return parser.parseString(xml);
}

// Construye un libro con los datos del RSS, sin los metadatos (géneros y número
// de páginas), que requieren scrapear la página individual de cada libro.
function buildBasicBook(item: GoodreadsRSSItem, i: number) {
	const parsed = parseGoodreadsContent(item.content ?? '');

	return {
		title: item.title ?? '',
		pubDate: item.pubDate ?? '',
		isoDate: item.isoDate ?? '',
		id: i,
		url: parsed.url,
		img: parsed.img,
		author: parsed['author'] ?? '',
		average: +parsed['average rating'] || 0,
		'book published': parsed['book published'] ?? '',
		rating: +parsed['rating'] || 0,
		'read at': parsed['read at'] ?? '',
		'date added': parsed['date added'] ? new Date(parsed['date added']) : null,
		shelves: parsed['shelves'] === '' ? ['read'] : parsed['shelves'].split(', '),
		genres: [] as string[],
		numberOfPages: 0
	};
}

async function fetchBookList(userId: string) {
	const per_page = 200;
	let page = 1;

	const allItems: GoodreadsRSSItem[] = [];
	let lastUpdate: string | undefined = undefined;

	// La comprobación de librería privada va incluida en la primera página,
	// así evitamos una petición extra de ida y vuelta a Goodreads.
	while (true) {
		const rss = await fetchRssPage(userId, page, per_page);

		if (page === 1) {
			lastUpdate = (rss as { lastBuildDate?: string }).lastBuildDate;
		}

		allItems.push(...(rss.items as GoodreadsRSSItem[]));

		if (rss.items.length < per_page) break;

		page++;
	}

	const books = allItems.map((item, i) => buildBasicBook(item, i));
	const shelves = [...new Set(books.flatMap((d) => d.shelves))];

	return { lastUpdate, books, shelves };
}

function isValidUserId(userId: unknown): userId is string {
	return typeof userId === 'string' && userId.length > 0;
}

// Paso 1 — Lista de libros (RSS). Es rápido: no scrapea metadatos. Si hay datos
// completos en caché para el usuario, se devuelven directamente.
export const getBookList = command('unchecked', async (userId: string) => {
	if (!isValidUserId(userId)) {
		return {
			success: false,
			isPrivateShelf: false,
			message: 'userId es requerido y debe ser un string'
		};
	}

	const cache = caches.get(userId);
	if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
		console.log('📦 Sirviendo datos completos desde caché para usuario:', userId);
		return {
			success: true,
			complete: true,
			lastUpdate: cache.lastUpdate,
			books: cache.books,
			shelves: cache.shelves
		};
	}

	try {
		const data = await fetchBookList(userId);
		return { success: true, complete: false, ...data };
	} catch (err) {
		if (err instanceof PrivateShelfError) {
			console.error(`🔒 La librería del usuario ${userId} es privada`);
			return { success: false, isPrivateShelf: true, message: err.message };
		}
		return {
			success: false,
			isPrivateShelf: false,
			message: err instanceof Error ? err.message : 'Error desconocido'
		};
	}
});

// Paso 2 — Metadatos de un lote de libros. El cliente lo llama por tandas para
// mostrar progreso y mantener cada petición muy por debajo del tiempo límite de
// la función serverless.
export const fetchMetadataBatch = command('unchecked', async (urls: string[]) => {
	if (!Array.isArray(urls)) return [];

	return mapWithConcurrency(urls, SCRAPE_CONCURRENCY, async (url) => {
		try {
			const metadata = await getBookMetadata(url);
			return { url, genres: metadata.genres, numberOfPages: metadata.numberOfPages };
		} catch (error) {
			console.warn(`⚠️ Error scraping metadata for ${url}:`, error);
			return { url, genres: [] as string[], numberOfPages: 0 };
		}
	});
});

// Paso 3 (opcional) — Guarda el conjunto ya enriquecido en caché para que las
// siguientes cargas del mismo usuario sean instantáneas.
export const cacheUserData = command(
	'unchecked',
	async (payload: { userId: string; books: any[]; shelves: string[]; lastUpdate?: string }) => {
		if (!payload || !isValidUserId(payload.userId) || !Array.isArray(payload.books)) {
			return { success: false };
		}

		caches.set(payload.userId, {
			userId: payload.userId,
			books: payload.books,
			shelves: payload.shelves ?? [],
			lastUpdate: payload.lastUpdate,
			timestamp: Date.now()
		});

		return { success: true };
	}
);
