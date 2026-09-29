import { command } from '$app/server';
import { error } from '@sveltejs/kit';
import { getLibrary, getMetadata, toBookUrl } from '$lib/server/goodreads';

// Tope de libros por lote (el cliente pide 20): así ningún lote se acerca al
// tiempo límite de la función serverless.
const MAX_BATCH_SIZE = 50;

// Paso 1 — Libros del usuario (RSS). Es rápido: trae los metadatos que ya estén
// en caché y dice qué libros quedan por analizar.
export const getBookList = command('unchecked', async (userId: string) => {
	if (typeof userId !== 'string' || !/^\d{1,15}$/.test(userId)) {
		error(400, 'El ID de Goodreads tiene que ser un número.');
	}

	return getLibrary(userId);
});

// Paso 2 — Géneros y páginas de un lote de libros. El cliente lo llama por
// tandas para mostrar el progreso.
export const fetchMetadataBatch = command('unchecked', async (urls: string[]) => {
	if (
		!Array.isArray(urls) ||
		urls.length > MAX_BATCH_SIZE ||
		!urls.every((url) => toBookUrl(url) === url)
	) {
		error(400, 'Lote de libros no válido.');
	}

	return getMetadata(urls);
});
