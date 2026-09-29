// Tipos y utilidades compartidos entre el servidor y los componentes.

export interface BookMetadata {
	genres: string[];
	numberOfPages: number;
}

export interface Book extends BookMetadata {
	id: number;
	title: string;
	author: string;
	/** Ficha del libro en Goodreads (https://www.goodreads.com/book/show/<id>). */
	url: string;
	img: string;
	/** Puntuación del usuario (0 si no lo ha puntuado). */
	rating: number;
	/** Puntuación media en Goodreads. */
	average: number;
	/** Año de publicación. */
	published: string;
	/** Fecha de lectura con formato "AAAA/MM/DD" (vacía si no la hay). */
	readAt: string;
	/** Fecha ISO en que se añadió a la estantería. */
	addedAt: string;
	shelves: string[];
}

/**
 * Extrae el ID de usuario de lo que se pegue en el buscador: el número tal cual
 * o cualquier URL de Goodreads que lo contenga (goodreads.com/user/show/123-nombre,
 * goodreads.com/review/list/123...).
 */
export function parseUserId(input: string): string | null {
	return input.match(/\d+/)?.[0] ?? null;
}

/** Números en formato español (coma decimal), con dos decimales como mucho. */
export const formatNumber = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format;
