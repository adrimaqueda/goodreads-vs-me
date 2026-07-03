<script lang="ts">
	import { fly, scale } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { descending } from 'd3';

	interface Book {
		id: number;
		title: string;
		author: string;
		img: string;
		isoDate: string;
		rating: number;
		average: number;
		numberOfPages: number;
		'read at': string;
		shelves: string[];
	}

	interface Shelf {
		name: string;
		books: number;
	}

	let { books, shelves }: { books: Book[]; shelves: Shelf[] } = $props();

	let filterBooks: string | null = $state(null);
	let hoveredStar: number | null = $state(null);
	let activeStar: number | null = $state(null);

	let displayedBooks = $derived(
		books.filter((book) => {
			// Filtro por estanteria
			const matchesShelf = filterBooks !== null ? book.shelves.includes(filterBooks) : true;

			// Filtro por estrellas
			const matchesRating = activeStar !== null ? book.rating === activeStar : true;

			// Debe cumplir ambos filtros
			return matchesShelf && matchesRating;
		})
	);

	const listColors: Record<string, string> = {
		'currently-reading': '#2563eb',
		'to-read': '#222',
		read: '#16a34a',
		nexts: '#ea580c',
		abandoned: '#dc2626'
	};

	const readDateFormatter = new Intl.DateTimeFormat('es', { month: 'short', year: '2-digit' });

	function isHighlighted(index: number): boolean {
		// Si hay hover, prioriza el hover sobre el activo
		if (hoveredStar !== null) return index <= hoveredStar;
		// Si no hay hover pero hay activo, muestra el activo
		if (activeStar !== null) return index <= activeStar;
		return false;
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
				{#if filterBooks}<button
						onclick={() => (filterBooks = null)}
						transition:scale
						aria-label="Limpiar filtro de listas"
					>
						reset ✖︎
					</button>
				{/if}
			</div>
			{#each shelves.toSorted((a, b) => descending(a.books, b.books)) as shelf (shelf.name)}
				{@const shelfColor = listColors[shelf.name]}
				<button
					onclick={() => (filterBooks = shelf.name)}
					style={shelfColor ? `--color:${shelfColor}` : ''}
					class:active={filterBooks === shelf.name}
					aria-pressed={filterBooks === shelf.name}
				>
					{shelf.name.replace('-', ' ')} ({shelf.books})
				</button>
			{/each}
		</div>

		<div class="puntuacion">
			<div class="header">Puntuación</div>
			<div class="stars">
				{#each { length: 5 } as _, i (i)}
					<button
						onmouseenter={() => (hoveredStar = i + 1)}
						onmouseleave={() => (hoveredStar = null)}
						onclick={() => (activeStar = i + 1)}
						class:highlighted={isHighlighted(i + 1)}
						aria-label={`Filtrar por ${i + 1} estrellas`}
						aria-pressed={activeStar === i + 1}
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" aria-hidden="true">
							<path
								d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"
							/>
						</svg>
					</button>
				{/each}
				{#if activeStar}
					<button
						onclick={() => (activeStar = null)}
						transition:scale
						aria-label="Limpiar filtro de puntuacion"
						style="color:black"
					>
						✖︎
					</button>
				{/if}
			</div>
		</div>
	</div>
	<div class="booksContainer">
		{#each displayedBooks as book (book.id)}
			{@const matchedShelf = book.shelves?.find((shelf) => listColors[shelf])}
			{@const shelfColor = matchedShelf ? listColors[matchedShelf] : null}
			<div class="book" animate:flip={{ duration: 300 }} in:fly={{ duration: 300, y: 200 }}>
				<img
					src={book.img}
					alt="Portada de {book.title} por {book.author}"
					class="bookCover"
					loading="lazy"
					decoding="async"
					style={shelfColor ? `--color:${shelfColor}` : ''}
				/>
				{#if book.shelves.includes('read') || book.shelves.includes('abandoned')}
					<div class="book-rating-container">
						{#if book.shelves.includes('abandoned')}
							<p class="bookRating abandoned">x</p>
						{:else if book.rating === 0}
							<p class="bookRating na">?</p>
						{:else}
							<p class="bookRating">
								{book.rating}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 576 512"
									aria-label="estrellas"
								>
									<path
										d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"
									/>
								</svg>
							</p>
						{/if}
						{#if book['read at'] !== '' || book.shelves.includes('abandoned')}
							{@const date = book['read at'] !== '' ? book['read at'] : book.isoDate}
							<p class="bookInfo">
								{readDateFormatter.format(new Date(date))}
								<br />
								{#if book['read at'] !== ''}
									{book.numberOfPages} págs.
								{/if}
							</p>
						{/if}
					</div>
				{/if}
				<div>
					<p class="bookTitle">{book.title}</p>
					<p class="bookAuthor">{book.author}</p>
				</div>
			</div>
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
		padding: 0;
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
			padding: 2px 10px;
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

			svg {
				fill: #f9eec7;
				overflow: visible;
			}
		}

		button.highlighted svg {
			fill: #ebc033;
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
		font-weight: bold;
		line-height: 1.2;
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
		column-gap: 2px;
		position: relative;
		transform: translate(-50%, -50%);

		svg {
			height: 0.65rem;
			fill: #ebc033;
		}

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

		.stars path {
			stroke: #ebc033;
			stroke-width: 30px;
		}
	}

	@media (width > 550px) {
		.main-container {
			flex-direction: row;
		}
		.booksContainer {
			margin-inline: 2rem;
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
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
			gap: 2rem;
			width: 100%;
		}
		.book {
			width: 100%;
			max-width: 200px;
		}

		.puntuacion {
			padding-top: 15px;
		}
	}
</style>
