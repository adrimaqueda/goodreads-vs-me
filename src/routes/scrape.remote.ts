import { command } from '$app/server';
import Parser from 'rss-parser';
import { parseGoodreadsContent, scrapeBookMetadata } from '$lib/goodreads';

class PrivateShelfError extends Error {
	constructor(message: string = "That person's shelf is private") {
		super(message);
		this.name = 'PrivateShelfError';
	}
}

async function checkIfShelfIsPrivate(userId: string): Promise<boolean> {
	try {
		const response = await fetch(`https://www.goodreads.com/review/list_rss/${userId}?per_page=1&page=1`);

		if (response.status === 401) {
			// Obtener el contenido para verificar el mensaje exacto
			const text = await response.text();
			if (text.includes("Sorry, that person's shelf is private")) {
				return true;
			}
		}
		return false;
	} catch (error) {
		return false;
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

async function fetchGoodreadsData(userId: string) {
	// Verificar primero si la librería es privada
	if (await checkIfShelfIsPrivate(userId)) {
		throw new PrivateShelfError();
	}

	const per_page = 200;
	let page = 1;

	let allItems: GoodreadsRSSItem[] = [];
	let lastUpdate: string | undefined = undefined;

	while (true) {
		const url = `https://www.goodreads.com/review/list_rss/${userId}?per_page=${per_page}&page=${page}`;

		try {
			const rss = await parser.parseURL(url);

			if (page === 1) {
				lastUpdate = (rss as { lastBuildDate?: string }).lastBuildDate;
			}

			allItems.push(...(rss.items as GoodreadsRSSItem[]));

			if (rss.items.length < per_page) break;

			page++;
		} catch (error) {
			throw error;
		}
	}

	const books = await Promise.all(
		allItems.map(async (item, i) => {
			const parsed = parseGoodreadsContent(item.content ?? '');

			let metadata = { genres: [], numberOfPages: undefined };
			if (parsed.url && parsed.rating !== '0') {
				try {
					metadata = await scrapeBookMetadata(parsed.url);
				} catch (error) {
					console.warn(`⚠️ Error scraping metadata for ${item.title}:`, error);
				}

				await new Promise((resolve) => setTimeout(resolve, 0));
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
		})
	);

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
