<script lang="ts">
	import CanvasWrapper from '$lib/chartComponents/canvas/canvasWrapper.svelte';
	import Circle from '$lib/chartComponents/canvas/circle.svelte';
	import Rect from '$lib/chartComponents/canvas/rect.svelte';
	import Text from '$lib/chartComponents/canvas/text.svelte';
	import Line from '$lib/chartComponents/canvas/Line.svelte';
	import Star from '$lib/Star.svelte';

	import {
		mean,
		scaleLinear,
		forceSimulation,
		forceX,
		forceY,
		forceCollide,
		extent,
		max,
		descending,
		rollups
	} from 'd3';
	import { innerWidth } from 'svelte/reactivity/window';
	import { scale } from 'svelte/transition';
	import { formatNumber, type Book } from '$lib/books';

	type Node = Book & { x?: number; y?: number };

	let { books }: { books: Book[] } = $props();

	let ratedBooks = $derived(books.filter((d) => d.rating !== 0));
	let myMean = $derived(mean(ratedBooks, (d) => d.rating) ?? 0);
	let goodreadsMean = $derived(mean(ratedBooks, (d) => d.average) ?? 0);

	// Los libros en los que más se aleja tu puntuación de la media de Goodreads.
	let topDiffs = $derived(
		ratedBooks
			.map((d) => ({ ...d, diff: d.rating - d.average }))
			.sort((a, b) => descending(Math.abs(a.diff), Math.abs(b.diff)))
			.slice(0, 10)
	);
	let biggestDiff = $derived(topDiffs[0]);

	// Gráfico: arriba tus puntuaciones y abajo las medias de Goodreads
	// (redondeadas), cada libro es un círculo con un tamaño según sus páginas.

	let wrapperWidth = $state(0);

	// Libros de la columna más poblada de cualquiera de las dos filas.
	const largestColumn = (column: (d: Book) => number) =>
		max(
			rollups(ratedBooks, (v) => v.length, column),
			(d) => d[1]
		) ?? 0;
	let maxGroup = $derived(
		Math.max(
			largestColumn((d) => d.rating),
			largestColumn((d) => Math.round(d.average))
		)
	);

	let radiusScale = $derived(
		scaleLinear()
			.domain(extent(ratedBooks, (d) => d.numberOfPages) as [number, number])
			.range([3, Math.sqrt((wrapperWidth / maxGroup) * Math.PI) * Math.PI])
	);

	// Diámetro aproximado que ocupa la columna más poblada.
	let maxGroupSize = $derived.by(() => {
		const [minRadius, maxRadius] = radiusScale.range();
		const midRadius = (minRadius + maxRadius) / 2;
		return Math.sqrt((maxGroup * midRadius * midRadius) / 0.8) * 2;
	});

	let height = $derived(maxGroupSize * 2.5);

	let xScale = $derived(
		scaleLinear()
			.domain([1, 5])
			.range([maxGroupSize / Math.PI, wrapperWidth - maxGroupSize / Math.PI])
	);

	// Copias que mueve la simulación de fuerzas. Se crean una vez por lista, así
	// al redimensionar cada círculo parte de donde estaba.
	let ratingNodes = $derived(ratedBooks.map((d): Node => ({ ...d })));
	let averageNodes = $derived(ratedBooks.map((d): Node => ({ ...d })));
	let ratingPositions: Node[] = $state.raw([]);
	let averagePositions: Node[] = $state.raw([]);

	// Agrupa los libros en la fila `y` alrededor de su puntuación redondeada,
	// sin que se solapen, y publica sus posiciones en cada paso.
	function swarm(
		nodes: Node[],
		field: 'rating' | 'average',
		y: number,
		onTick: (positions: Node[]) => void
	) {
		for (const d of nodes) {
			d.x ??= xScale(d[field]);
			d.y ??= y;
		}

		const simulation = forceSimulation(nodes)
			.force('x', forceX<Node>((d) => xScale(Math.round(d[field]))).strength(0.1))
			.force('y', forceY<Node>(y).strength(0.1))
			.force(
				'collide',
				forceCollide<Node>((d) => radiusScale(d.numberOfPages) * 1.2).iterations(10)
			)
			.alphaDecay(0.02)
			.velocityDecay(0.3)
			// Objetos nuevos en cada paso para que Svelte vea que han cambiado.
			.on('tick', () => onTick(nodes.map((d) => ({ ...d }))));

		return () => simulation.stop();
	}

	$effect(() => {
		if (wrapperWidth > 0) {
			return swarm(ratingNodes, 'rating', height * 0.2125, (p) => (ratingPositions = p));
		}
	});

	$effect(() => {
		if (wrapperWidth > 0) {
			return swarm(averageNodes, 'average', height * 0.6875, (p) => (averagePositions = p));
		}
	});

	// Libro bajo el cursor
	let hoveredId: number | null = $state(null);
	let hoveredX = $state(0);
	let hoveredY = $state(0);
	let hovered = $derived(ratedBooks.find((d) => d.id === hoveredId));

	function handleMouseMove(event: MouseEvent) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const node = [...ratingPositions, ...averagePositions].find(
			(d) => Math.hypot((d.x ?? 0) - x, (d.y ?? 0) - y) <= radiusScale(d.numberOfPages)
		);

		hoveredId = node?.id ?? null;
		hoveredX = node?.x ?? 0;
		hoveredY = node?.y ?? 0;
	}

	// Línea que une tu puntuación con la media del libro bajo el cursor.
	let connection = $derived.by(() => {
		const rating = ratingPositions.find((d) => d.id === hoveredId);
		const average = averagePositions.find((d) => d.id === hoveredId);
		if (!rating || !average) return null;
		return { x1: rating.x ?? 0, y1: rating.y ?? 0, x2: average.x ?? 0, y2: average.y ?? 0 };
	});

	function getRadius(book: Node) {
		const radius = radiusScale(book.numberOfPages);
		if (hoveredId === null) return radius;
		return book.id === hoveredId ? radius * 1.5 : radius / 2;
	}

	function getAlpha(book: Node) {
		return hoveredId === null || book.id === hoveredId ? 1 : 0.2;
	}

	// Tooltip al lado contrario del punto para que no se salga del gráfico.
	let tooltipSide = $derived(hoveredX < wrapperWidth / 2 ? 'right' : 'left');
	let isMobile = $derived((innerWidth.current ?? Infinity) < 768);
</script>

{#snippet stars(value: number)}
	{#each { length: 5 } as _, i}
		<Star size="0.8lh" color={i < Math.round(value) ? '#ebc033' : '#f9eec7'} />
	{/each}
{/snippet}

{#snippet bookDetails(book: Book)}
	<img src={book.img} alt="Portada de {book.title} por {book.author}" class="bookCover" />

	<div>
		<p class="bookTitle">{book.title}</p>
		<p class="bookInfo">
			{book.author}
			{#if book.published}({book.published}){/if}
			{#if book.numberOfPages}| {book.numberOfPages} páginas{/if}
		</p>
		<table class="bookRating">
			<tbody>
				<tr>
					<td>Tu puntuación:</td>
					<td>{book.rating}</td>
					<td>{@render stars(book.rating)}</td>
				</tr>
				<tr>
					<td>Media en Goodreads:</td>
					<td>{formatNumber(book.average)}</td>
					<td>{@render stars(book.average)}</td>
				</tr>
			</tbody>
		</table>
	</div>
{/snippet}

{#if ratedBooks.length === 0}
	<div class="text-container section-margin">
		<p class="text-center">
			Todavía no has puntuado ningún libro en Goodreads, así que no hay puntuaciones que comparar.
		</p>
	</div>
{:else}
	<div class="text-container section-margin">
		<p class="text-center">
			Has puntuado <b>{ratedBooks.length}</b>
			{ratedBooks.length === 1 ? 'libro' : 'libros'} en Goodreads.
		</p>
		<div class="means-container">
			<div>
				<p class="bigNumber" style="color: #ebc033">{formatNumber(myMean)}</p>
				<p class="means-label">Tu puntuación media</p>
			</div>
			<div>
				<p class="bigNumber" style="color:#666">{formatNumber(goodreadsMean)}</p>
				<p class="means-label">La puntuación media en Goodreads</p>
			</div>
		</div>
		{#if biggestDiff}
			<p>
				La mayor diferencia entre tu puntuación y la media de Goodreads es de <b
					>{formatNumber(Math.abs(biggestDiff.diff))} puntos</b
				>,
				{#if biggestDiff.diff < 0}
					cuando puntuaste con un {biggestDiff.rating} el libro <i>{biggestDiff.title}</i> de {biggestDiff.author},
					que en Goodreads promedia un {formatNumber(biggestDiff.average)}.
				{:else}
					en el libro <i>{biggestDiff.title}</i> de {biggestDiff.author}. Mientras que para ti fue
					un {biggestDiff.rating}, para el resto se queda en un {formatNumber(biggestDiff.average)}.
				{/if}
			</p>
		{/if}
	</div>

	<div
		class="canvas-container"
		bind:clientWidth={wrapperWidth}
		onmousemove={handleMouseMove}
		onmouseleave={() => (hoveredId = null)}
		role="img"
		aria-label="Gráfico de tus puntuaciones (arriba) frente a la media de Goodreads (abajo)"
	>
		<CanvasWrapper width={wrapperWidth} {height}>
			{#each { length: 5 } as _, i}
				<Text text={i + 1} x={xScale(i + 1)} y={height - 1} size="15px" fill="#777" />
				<Rect x={xScale(i + 1)} y={0} width={1} height={height - 15} fill="#aaa" />
			{/each}

			{#if connection}
				<Line {...connection} stroke="#666" lineWidth={1.5} globalAlpha={0.5} z={-1} />
			{/if}

			{#each ratingPositions as book}
				<Circle
					x={book.x ?? 0}
					y={book.y ?? 0}
					r={getRadius(book)}
					fill="#ebc033"
					globalAlpha={getAlpha(book)}
				/>
			{/each}

			{#each averagePositions as book}
				<Circle
					x={book.x ?? 0}
					y={book.y ?? 0}
					r={getRadius(book)}
					fill="#888"
					globalAlpha={getAlpha(book)}
				/>
			{/each}
		</CanvasWrapper>

		{#if hovered && !isMobile}
			<div
				class="tooltipContainer position-{tooltipSide}"
				style="left: {hoveredX}px; top: {hoveredY}px;"
			>
				<div transition:scale={{ duration: 200 }} class="tooltip">
					{@render bookDetails(hovered)}
				</div>
			</div>
		{/if}
	</div>

	{#if hovered && isMobile}
		<div class="tooltipMobile" transition:scale={{ duration: 200 }}>
			{@render bookDetails(hovered)}
		</div>
	{/if}

	<div class="section-margin">
		<table id="top-diffs">
			<thead>
				<tr>
					<th scope="col">Libro</th>
					<th scope="col">Tu puntuación</th>
					<th scope="col">Media en GR</th>
					<th scope="col">Diferencia</th>
				</tr>
			</thead>
			<tbody>
				{#each topDiffs as book (book.id)}
					<tr>
						<td class="bookTitle">{book.title}</td>
						<td>{book.rating}</td>
						<td>{formatNumber(book.average)}</td>
						<td>
							<span class="arrow" class:up={book.diff > 0}>{book.diff > 0 ? '▲' : '▼'}</span
							>{formatNumber(Math.abs(book.diff))}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.text-center {
		text-align: center;
	}

	.means-container {
		display: flex;
		width: 100%;
		justify-content: space-evenly;
		text-align: center;
	}

	.means-label {
		font-size: 1rem;
	}

	.canvas-container {
		width: 100%;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 2rem;
	}

	.tooltipContainer {
		position: absolute;
		display: flex;
		z-index: 10;
		pointer-events: none;

		& .bookInfo {
			padding: 8px 0;
		}
	}

	/* Desktop: a la izquierda del punto */
	.tooltipContainer.position-left {
		transform: translate(calc(-100% - 1rem), -50%);
		margin-right: 1rem;
	}

	/* Desktop: a la derecha del punto */
	.tooltipContainer.position-right {
		transform: translateY(-50%);
		margin-left: 1rem;
	}

	.tooltipMobile {
		display: flex;
		flex-direction: column;
		align-items: center;
		column-gap: 1rem;
		width: 100%;
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		padding: 1.5rem;
		border: 1px solid rgba(0, 0, 0, 0.1);
		margin-bottom: 2rem;
	}

	.tooltip {
		display: flex;
		flex-direction: row;
		align-items: center;
		column-gap: 1rem;
		width: max-content;
		max-width: 500px;
		background: rgba(255, 255, 255, 0.98);
		backdrop-filter: blur(8px);
		border-radius: 0.75rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
		padding: 1.5rem;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	.bookTitle {
		font-weight: bold;
		font-size: 1.3rem;
		text-align: center;
	}

	.bookInfo {
		color: #888;
		margin-bottom: 0.5rem;
		text-align: center;
		font-size: 0.9rem;
	}

	.bookRating td {
		white-space: nowrap;
	}

	.bookCover {
		height: 100px;
		width: auto;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.tooltip p {
		margin: 0;
	}

	.bigNumber {
		font-size: 2.2rem;
		font-weight: 600;
		margin-bottom: 0;
	}

	table#top-diffs {
		width: 100%;
		border-collapse: collapse;
		color: #222;

		& tr {
			border: solid;
			border-width: 1px 0;
			border-color: #ccc;
		}

		& thead {
			border-bottom: solid 2px black;
		}

		& th,
		& td {
			padding: 0.5em 0;
			text-align: center;

			&:first-child {
				text-align: left;
			}
		}

		& .bookTitle {
			font-size: 1rem;
		}
	}

	.arrow {
		display: inline-block;
		transform: scale(66%);
		color: #c60000;

		&.up {
			color: #409d69;
		}
	}

	/* Responsive para móvil */
	@media (max-width: 767px) {
		.tooltipMobile {
			padding: 1rem;
		}

		.bookCover {
			height: 120px;
		}

		.bookTitle {
			font-size: 1.1rem;
		}

		.bookInfo {
			font-size: 0.85rem;
		}
	}
</style>
