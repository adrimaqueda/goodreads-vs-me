<script lang="ts">
	import { fly, scale } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { descending, rollups } from 'd3';
	import Star from '$lib/Star.svelte';
	import type { Book } from '$lib/books';

	let { books }: { books: Book[] } = $props();

	// Estanterías con su número de libros, de más a menos.
	let shelves = $derived(
		rollups(
			books.flatMap((book) => book.shelves),
			(group) => group.length,
			(shelf) => shelf
		).sort((a, b) => descending(a[1], b[1]))
	);

	let activeShelf: string | null = $state(null);
	let activeStars: number | null = $state(null);
	let hoveredStars: number | null = $state(null);

	let displayedBooks = $derived(
		books.filter(
			(book) =>
				(activeShelf === null || book.shelves.includes(activeShelf)) &&
				(activeStars === null || book.rating === activeStars)
		)
	);

	const shelfColors = new Map([
		['currently-reading', '#2563eb'],
		['to-read', '#222'],
		['read', '#16a34a'],
		['nexts', '#ea580c'],
		['abandoned', '#dc2626']
	]);

	const dateFormatter = new Intl.DateTimeFormat('es', { month: 'short', year: '2-digit' });

	// "2024/03/15" → "mar 24" (vacío si la fecha no se entiende).
	function formatDate(value: string) {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
	}
</script>

<div class="text-container" style="margin-top: 5rem;margin-bottom: 5rem;">
	<p>Estos son todos los libros que tienes guardados en Goodreads:</p>
</div>

<div class="main-container">
	<div class="filterColumn">
		<div class="listas">
			<div class="header">
				Listas
				{#if activeShelf}
					<button
						onclick={() => (activeShelf = null)}
						transition:scale
						aria-label="Limpiar filtro de listas"
					>
						reset ✖︎
					</button>
				{/if}
			</div>
			{#each shelves as [shelf, count] (shelf)}
				<button
					onclick={() => (activeShelf = activeShelf === shelf ? null : shelf)}
					style:--color={shelfColors.get(shelf)}
					class:active={activeShelf === shelf}
					aria-pressed={activeShelf === shelf}
				>
					{shelf.replaceAll('-', ' ')} ({count})
				</button>
			{/each}
		</div>

		<div class="puntuacion">
			<div class="header">Puntuación</div>
			<div class="stars">
				{#each { length: 5 } as _, i (i)}
					{@const stars = i + 1}
					<button
						onmouseenter={() => (hoveredStars = stars)}
						onmouseleave={() => (hoveredStars = null)}
						onclick={() => (activeStars = activeStars === stars ? null : stars)}
						class:highlighted={stars <= (hoveredStars ?? activeStars ?? 0)}
						aria-label="Filtrar por {stars} estrellas"
						aria-pressed={activeStars === stars}
					>
						<Star size="100%" />
					</button>
				{/each}
				{#if activeStars}
					<button
						class="clear"
						onclick={() => (activeStars = null)}
						transition:scale
						aria-label="Limpiar filtro de puntuación"
					>
						✖︎
					</button>
				{/if}
			</div>
		</div>
	</div>

	<div class="booksContainer">
		{#each displayedBooks as book (book.id)}
			{@const shelfColor = shelfColors.get(
				book.shelves.find((shelf) => shelfColors.has(shelf)) ?? ''
			)}
			<div class="book" animate:flip={{ duration: 300 }} in:fly={{ duration: 300, y: 200 }}>
				<img
					src={book.img}
					alt="Portada de {book.title} por {book.author}"
					class="bookCover"
					loading="lazy"
					decoding="async"
					style:--color={shelfColor}
				/>
				{#if book.shelves.includes('read') || book.shelves.includes('abandoned')}
					<div class="book-rating-container">
						{#if book.shelves.includes('abandoned')}
							<p class="bookRating abandoned">x</p>
						{:else if book.rating === 0}
							<p class="bookRating na">?</p>
						{:else}
							<p class="bookRating">{book.rating} <Star size="0.65rem" color="#ebc033" /></p>
						{/if}
						{#if book.readAt || book.shelves.includes('abandoned')}
							<p class="bookInfo">
								{formatDate(book.readAt || book.addedAt)}
								{#if book.readAt && book.numberOfPages}
									<br />{book.numberOfPages} págs.
								{/if}
							</p>
						{/if}
					</div>
				{/if}
				<div>
					<a
						class="bookTitle"
						href={book.url || undefined}
						target="_blank"
						rel="noopener noreferrer">{book.title}</a
					>
					<p class="bookAuthor">{book.author}</p>
				</div>
			</div>
		{:else}
			<p class="empty">No hay libros que cumplan estos filtros.</p>
		{/each}
	</div>
</div>

<style>
	.main-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		margin-bottom: 5rem;
	}

	.filterColumn {
		display: flex;
		flex-direction: row;
		justify-content: space-around;
	}

	.listas {
		padding: 0;
		display: flex;
		flex-direction: column;

		.header {
			padding-bottom: 10px;

			button {
				margin-bottom: 0;
			}
		}
	}

	.header {
		font-weight: bold;
		color: #444;
	}

	.listas button {
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
		color: var(--color, #777);
		padding: 2px 10px;
		font-size: 0.9rem;
		background-color: transparent;
		transition:
			background-color 0.3s,
			border-radius 0.3s;
		width: fit-content;
		line-height: 1.5;

		&:hover {
			font-weight: bold;
		}

		&.active {
			background-color: rgb(from var(--color, #777) r g b / 0.08);
			border-radius: 50px;
			font-weight: bold;
		}
	}

	.stars {
		padding-top: 5px;
		display: flex;

		button {
			line-height: 1.5;
			height: 1lh;
			aspect-ratio: 1;
			background: none;
			border: none;
			padding: 0;
			cursor: pointer;
			color: #f9eec7;

			&.highlighted {
				color: #ebc033;
			}

			&.clear {
				color: black;
			}
		}
	}

	.booksContainer {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(50% - 1rem), 1fr));
		column-gap: 2rem;
		row-gap: 2rem;
		margin: 5px;
		align-content: start;
	}

	.empty {
		grid-column: 1 / -1;
		color: #888;
		text-align: center;
	}

	.book {
		width: 100%;
		justify-self: center;
		position: relative;
		height: fit-content;
	}

	.book-rating-container {
		position: absolute;
		top: 0;
		left: 50px;
	}

	.bookCover {
		border: solid 1px var(--color, #777);
		border-radius: 5px;
		box-shadow: 0 0 4px 0 var(--color, #777);
		width: 50px;
		height: auto;
	}

	.bookTitle {
		display: block;
		font-weight: bold;
		line-height: 1.2;
		color: inherit;
		text-decoration: none;

		&[href]:hover {
			text-decoration: underline;
		}
	}

	.bookAuthor {
		color: #aaa;
		font-size: 0.9rem;
		margin-top: 5px;
	}

	.bookRating {
		background-color: #f6e3a2;
		color: #dfb016;
		padding: 4px 6px;
		font-size: 0.7rem;
		border-radius: 50px;
		width: fit-content;
		display: flex;
		align-items: center;
		column-gap: 2px;
		position: relative;
		transform: translate(-50%, -50%);

		&.na {
			background-color: #eee;
			color: #aaaaaa;
		}

		&.abandoned {
			background-color: #f6caca;
			color: #dc2626;
		}
	}

	.bookInfo {
		font-size: 0.8rem;
		color: #888;
		padding-right: 7px;
		margin-left: 10px;
		transform: translateY(-0.6rem);
	}

	@media (width < 550px) {
		.filterColumn {
			background: #fafafa;
			border-radius: 10px;
			padding: 10px;
			margin-bottom: 2rem;
			box-shadow: 0 0 5px 0 #aaa;
		}

		/* Contorno para que las estrellas apagadas se vean sobre el fondo gris */
		.stars button {
			stroke: #ebc033;
			stroke-width: 30px;
		}
	}

	@media (width > 550px) {
		.main-container {
			flex-direction: row;
		}
		.filterColumn {
			display: flex;
			flex-direction: column;
			min-width: 200px;
			height: 100%;
			position: sticky;
			top: 2rem;
			padding: 10px;
		}
		.booksContainer {
			grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
			gap: 2rem;
			width: 100%;
			margin-inline: 2rem;
		}
		.book {
			max-width: 200px;
		}

		.puntuacion {
			padding-top: 15px;
		}
	}
</style>
