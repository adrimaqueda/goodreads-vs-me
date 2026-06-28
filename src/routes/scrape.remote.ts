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

// Caché en memoria por usuario
const caches = new Map<string, CachedData>();
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 1 día

// Caché de metadatos por URL de libro: el mismo libro (compartido entre
// usuarios y entre recargas) sólo se scrapea una vez por instancia.
type BookMetadata = Awaited<ReturnType<typeof scrapeBookMetadata>>;
const metadataCache = new Map<string, BookMetadata>();

// Límite de peticiones simultáneas al scrapear metadatos. Lanzar cientos de
// fetch a la vez agota los sockets de la función serverless y hace que
// Goodreads nos limite; un pool acotado es más rápido y fiable.
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

async function fetchGoodreadsData(userId: string) {
	const per_page = 200;
	let page = 1;

	let allItems: GoodreadsRSSItem[] = [];
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

	const books = await mapWithConcurrency(allItems, SCRAPE_CONCURRENCY, async (item, i) => {
		const parsed = parseGoodreadsContent(item.content ?? '');

		let metadata: BookMetadata = { genres: [], numberOfPages: 0 };
		if (parsed.url && parsed.rating !== '0') {
			try {
				metadata = await getBookMetadata(parsed.url);
			} catch (error) {
				console.warn(`⚠️ Error scraping metadata for ${item.title}:`, error);
			}
		}

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
			genres: metadata.genres,
			numberOfPages: metadata.numberOfPages
		};
	});

	const shelves = [...new Set(books.flatMap((d) => d.shelves))];

	return {
		lastUpdate,
		books,
		shelves
	};
}

export const getCachedOrFetchData = command('unchecked', async (userId: string) => {
	console.log('getCachedOrFetchData llamado para usuario:', userId);

	if (!userId || typeof userId !== 'string') {
		return {
			success: false,
			isPrivateShelf: false,
			message: 'userId es requerido y debe ser un string'
		};
	}

	const now = Date.now();
	const cache = caches.get(userId);

	// Si hay caché y no ha expirado, retornar caché
	if (cache && now - cache.timestamp < CACHE_DURATION) {
		console.log('📦 Sirviendo datos desde caché para usuario:', userId);
		return {
			success: true,
			lastUpdate: cache.lastUpdate,
			books: cache.books,
			shelves: cache.shelves
		};
	}

	// Si no hay caché o ha expirado, hacer fetch
	console.log('🔄 Actualizando datos desde Goodreads para usuario:', userId);
	try {
		const data = await fetchGoodreadsData(userId);

		// Guardar en caché
		caches.set(userId, {
			...data,
			userId,
			timestamp: now
		});

		return {
			success: true,
			...data
		};
	} catch (err) {
		if (err instanceof PrivateShelfError) {
			console.error(`🔒 La librería del usuario ${userId} es privada`);
			return {
				success: false,
				isPrivateShelf: true,
				message: err.message
			};
		}
		return {
			success: false,
			isPrivateShelf: false,
			message: err instanceof Error ? err.message : 'Error desconocido'
		};
	}
});
