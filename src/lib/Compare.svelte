<script lang="ts">
	import CanvasWrapper from '$lib/chartComponents/canvas/canvasWrapper.svelte';
	import Circle from '$lib/chartComponents/canvas/circle.svelte';
	import Rect from '$lib/chartComponents/canvas/rect.svelte';
	import Text from '$lib/chartComponents/canvas/text.svelte';
	import Line from '$lib/chartComponents/canvas/Line.svelte';

	import {
		mean,
		scaleLinear,
		forceSimulation,
		forceX,
		forceY,
		forceCollide,
		greatest,
		min,
		max,
		descending,
		rollups
	} from 'd3';
	import { innerWidth } from 'svelte/reactivity/window';
	import { scale } from 'svelte/transition';

	interface Book {
		id: number;
		title: string;
		author: string;
		rating: number;
		average: number;
		numberOfPages: number;
		'read at': string;
		'book published': string;
		'date added': Date | null;
		shelves: string[];
		genres: string[];
		img: string;
		url: string;
		x: number;
		y: number;
	}

	interface SimulationBook extends Book {}

	let { books }: { books: Book[] } = $props();

	let readBooks = $derived(books.filter((d) => d.rating !== 0));

	let means = $derived.by(() => {
		return {
			mines: mean(readBooks, (d) => d.rating),
			global: mean(readBooks, (d) => Math.round(d.average))
		};
	});

	let wrapperWidth = $state(0);

	let maxGroup = $derived.by(() => {
		let ratings = rollups(
			readBooks,
			(v) => v.length,
			(d) => Math.round(d.rating)
		);

		let averages = rollups(
			readBooks,
			(v) => v.length,
			(d) => Math.round(d.average)
		);

		return Math.max(
			max(ratings, (d) => d[1]),
			max(averages, (d) => d[1])
		);
	});

	let radiusScale = $derived.by(() => {
		let ratio = Math.sqrt((wrapperWidth / maxGroup) * Math.PI) * Math.PI;

		let base = scaleLinear().domain([
			min(readBooks, (d) => d.numberOfPages),
			max(readBooks, (d) => d.numberOfPages)
		]);

		return base.range([3, ratio]);
	});

	let maxGroupSize = $derived.by(() => {
		let midR = radiusScale.range()[1] - (radiusScale.range()[1] - radiusScale.range()[0]) / 2;

		const areaTotal = Math.sqrt((maxGroup * Math.PI * midR * midR) / 0.8 / Math.PI) * 2;

		return areaTotal;
	});

	let height = $derived(maxGroupSize * 2.5);

	let xScale = $derived(
		scaleLinear()
			.domain([1, 5])
			.range([maxGroupSize / Math.PI, wrapperWidth - maxGroupSize / Math.PI])
	);

	let copiedDataRating = $derived(readBooks.map((d) => ({ ...d }) as SimulationBook));
	let copiedDataAverage = $derived(readBooks.map((d) => ({ ...d }) as SimulationBook));

	let nodesRating: SimulationBook[] = $state([]);
	let nodesAverage: SimulationBook[] = $state([]);

	// Efecto para la simulación de rating con cleanup
	$effect(() => {
		if (copiedDataRating?.length > 1 && wrapperWidth > 0) {
			// Inicializar posiciones para rating
			copiedDataRating.forEach((d) => {
				if (d.x === undefined || d.y === undefined) {
					d.x = xScale(d.rating);
					d.y = (height / 4) * 0.85;
				}
			});

			const sim = forceSimulation(copiedDataRating)
				.force('x', forceX<SimulationBook>((d) => xScale(d.rating)).strength(0.1))
				.force('y', forceY((height / 4) * 0.85).strength(0.1))
				.force(
					'collide',
					forceCollide<SimulationBook>()
						.radius((d) => radiusScale(d.numberOfPages) * 1.2)
						.iterations(10)
				)
				.alpha(1)
				.alphaDecay(0.02)
				.velocityDecay(0.3);

			sim.on('tick', () => {
				nodesRating = sim.nodes();
			});

			return () => {
				sim.stop();
			};
		}
	});

	// Efecto para la simulación de average con cleanup
	$effect(() => {
		if (copiedDataAverage?.length > 1 && wrapperWidth > 0) {
			// Inicializar posiciones para average rating
			copiedDataAverage.forEach((d) => {
				if (d.x === undefined || d.y === undefined) {
					d.x = xScale(d.average);
					d.y = (height * 2.75) / 4;
				}
			});

			const sim = forceSimulation(copiedDataAverage)
				.force('x', forceX<SimulationBook>((d) => xScale(Math.round(d.average))).strength(0.1))
				.force('y', forceY((height * 2.75) / 4).strength(0.1))
				.force(
					'collide',
					forceCollide<SimulationBook>()
						.radius((d) => radiusScale(d.numberOfPages) * 1.2)
						.iterations(10)
				)
				.alpha(1)
				.alphaDecay(0.02)
				.velocityDecay(0.3);

			sim.on('tick', () => {
				nodesAverage = sim.nodes();
			});

			return () => {
				sim.stop();
			};
		}
	});

	let underVoted = $derived.by(() => {
		return greatest(readBooks, (d) => d.average - d.rating);
	});

	let overVoted = $derived.by(() => {
		return greatest(readBooks, (d) => d.rating - d.average);
	});

	let top10diff = $derived(
		readBooks
			.map((d) => ({ ...d, diff: d.average - d.rating }))
			.toSorted((a, b) => descending(Math.abs(a.diff), Math.abs(b.diff)))
			.slice(0, 10)
	);

	// Estado para hover interaction
	let hoveredBookId: number | null = $state(null);
	let hoveredBookX: number = $state(0);
	let hoveredBookY: number = $state(0);

	function handleMouseMove(event: MouseEvent) {
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;

		// Buscar en ambos grupos de nodos
		const allNodes = [...nodesRating, ...nodesAverage];
		const hoveredNode = allNodes.find((node) => {
			const dx = (node.x ?? 0) - mouseX;
			const dy = (node.y ?? 0) - mouseY;
			return Math.sqrt(dx * dx + dy * dy) <= radiusScale(node.numberOfPages);
		});

		hoveredBookId = hoveredNode?.id ?? null;
		hoveredBookX = hoveredNode?.x ?? 0;
		hoveredBookY = hoveredNode?.y ?? 0;
	}

	function handleMouseLeave() {
		hoveredBookId = null;
	}

	function getRadius(book: { id: string | number; numberOfPages: number }): number {
		let radius = radiusScale(book.numberOfPages);

		if (hoveredBookId === null) return radius;
		return book.id === hoveredBookId ? radius * 1.5 : radius / 2;
	}

	function getAlpha(bookId: number): number {
		if (hoveredBookId === null) return 1;
		return bookId === hoveredBookId ? 1 : 0.2;
	}

	let hoverBookInfo = $derived.by(() => {
		if (hoveredBookId === null) return;
		else return books.find((d) => d.id === hoveredBookId);
	});

	let connectionPoints = $derived.by(() => {
		if (hoveredBookId === null) return null;

		const ratingNode = nodesRating.find((n) => n.id === hoveredBookId);
		const averageNode = nodesAverage.find((n) => n.id === hoveredBookId);

		if (!ratingNode || !averageNode) return null;

		return {
			x1: ratingNode.x ?? 0,
			y1: ratingNode.y ?? 0,
			x2: averageNode.x ?? 0,
			y2: averageNode.y ?? 0
		};
	});

	// Determinar si el tooltip debe ir a la izquierda o derecha según la posición X del punto
	let tooltipPosition = $derived.by(() => {
		if (hoveredBookId === null) return 'center';
		// Si está en la mitad izquierda, tooltip a la derecha, y viceversa
		return hoveredBookX < wrapperWidth / 2 ? 'right' : 'left';
	});

	let isMobile = $derived(innerWidth.current < 768);
</script>

<div class="text-container section-margin">
	<p class="text-center">
		Has puntuado <b>{readBooks.length}</b> libros en Goodreads.
	</p>
	<div class="means-container">
		<div>
			<p class="bigNumber" style="color: #ebc033">
				{means.mines?.toLocaleString('es-ES', { maximumSignificantDigits: 3 }) ?? '-'}
			</p>
			<p class="means-label">Tu puntuacion media</p>
		</div>
		<div>
			<p class="bigNumber" style="color:#666">
				{means.global?.toLocaleString('es-ES', { maximumSignificantDigits: 3 }) ?? '-'}
			</p>
			<p class="means-label">La puntuacion media en Goodreads</p>
		</div>
	</div>
	{#if underVoted && overVoted}
		{#if Math.abs(underVoted.average - underVoted.rating) >= Math.abs(overVoted.rating - overVoted.average)}
			<p>
				La mayor diferencia entre tu puntuacion y la media de Goodreads es de <b
					>{Math.round((underVoted.average - underVoted.rating) * 100) / 100} puntos</b
				>, cuando puntuaste con un {underVoted.rating} el libro <i>{underVoted.title}</i> de {underVoted.author},
				que en Goodreads promedia un {underVoted.average}.
			</p>
		{:else}
			<p>
				La mayor diferencia entre tu puntuacion y la media de Goodreads es de <b
					>{Math.round((overVoted.rating - overVoted.average) * 100) / 100} puntos</b
				>, en el libro <i>{overVoted.title}</i> de {overVoted.author}. Mientras que para ti fue un {overVoted.rating},
				para el resto se queda en un {overVoted.average}.
			</p>
		{/if}
	{/if}
</div>

<div
	class="canvas-container"
	bind:clientWidth={wrapperWidth}
	onmousemove={handleMouseMove}
	onmouseleave={handleMouseLeave}
	role="application"
	style="margin-bottom: 2rem;"
>
	<CanvasWrapper width={wrapperWidth} {height}>
		{#each { length: 5 } as _, i}
			<Text text={i + 1} x={xScale(i + 1)} y={height - 1} size="15px" fill="#777" />
			<Rect x={xScale(i + 1)} y={0} width={1} height={height - 15} fill="#aaa" />
		{/each}

		{#if connectionPoints}
			<Line
				x1={connectionPoints.x1}
				y1={connectionPoints.y1}
				x2={connectionPoints.x2}
				y2={connectionPoints.y2}
				stroke="#666"
				lineWidth={1.5}
				globalAlpha={0.5}
			/>
		{/if}

		<!-- Primera simulacion: por rating -->
		{#each nodesRating as book}
			<Circle
				x={book.x ?? 0}
				y={book.y ?? 0}
				r={getRadius(book)}
				fill="#ebc033"
				globalAlpha={getAlpha(book.id)}
			/>
		{/each}

		<!-- Segunda simulacion: por average rating -->
		{#each nodesAverage as book}
			<Circle
				x={book.x ?? 0}
				y={book.y ?? 0}
				r={getRadius(book)}
				fill="#888"
				globalAlpha={getAlpha(book.id)}
			/>
		{/each}
	</CanvasWrapper>

	{#if hoveredBookId !== null && hoverBookInfo && !isMobile}
		<div
			class="tooltipContainer"
			class:position-left={tooltipPosition === 'left'}
			class:position-right={tooltipPosition === 'right'}
			style="left: {hoveredBookX}px; top: {hoveredBookY}px;"
		>
			<div transition:scale={{ duration: 200 }} class="tooltip">
				<img
					src={hoverBookInfo.img}
					alt="Portada de {hoverBookInfo.title} por {hoverBookInfo.author}"
					class="bookCover"
				/>

				<div>
					<p class="bookTitle">{hoverBookInfo.title}</p>
					<p class="bookInfo">
						{hoverBookInfo.author}
						{#if hoverBookInfo['book published']}
							({hoverBookInfo['book published']}){/if}
						| {hoverBookInfo.numberOfPages} páginas
					</p>
					<table class="bookRating">
						<tbody>
							<tr>
								<td>Tu puntuación:</td>
								<td>{hoverBookInfo.rating}</td>
								<td>
									{#each { length: 5 } as _, i}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 576 512"
											aria-hidden="true"
											fill={i < hoverBookInfo.rating ? '#ebc033' : '#f9eec7'}
										>
											<path
												d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"
											/>
										</svg>
									{/each}</td
								>
							</tr>
							<tr>
								<td style="white-space: nowrap;">Media en Goodreads:</td>
								<td>{hoverBookInfo.average}</td>
								<td style="display: flex;">
									{#each { length: 5 } as _, i}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 576 512"
											aria-hidden="true"
											fill={i < Math.round(hoverBookInfo.average) ? '#ebc033' : '#f9eec7'}
										>
											<path
												d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"
											/>
										</svg>
									{/each}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/if}
</div>

{#if hoveredBookId !== null && hoverBookInfo && isMobile}
	<div class="tooltipMobile" transition:scale={{ duration: 200 }}>
		<img
			src={hoverBookInfo.img}
			alt="Portada de {hoverBookInfo.title} por {hoverBookInfo.author}"
			class="bookCover"
		/>

		<div>
			<p class="bookTitle">{hoverBookInfo.title}</p>
			<p class="bookInfo">
				{hoverBookInfo.author}
				{#if hoverBookInfo['book published']}
					({hoverBookInfo['book published']}){/if}
				| {hoverBookInfo.numberOfPages} páginas
			</p>
			<table class="bookRating">
				<tbody>
					<tr>
						<td>Mi puntuación:</td>
						<td>{hoverBookInfo.rating}</td>
						<td>
							{#each { length: 5 } as _, i}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 576 512"
									aria-hidden="true"
									fill={i < hoverBookInfo.rating ? '#ebc033' : '#f9eec7'}
								>
									<path
										d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"
									/>
								</svg>
							{/each}</td
						>
					</tr>
					<tr>
						<td style="white-space: nowrap;">Media en Goodreads:</td>
						<td>{hoverBookInfo.average}</td>
						<td style="display: flex;">
							{#each { length: 5 } as _, i}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 576 512"
									aria-hidden="true"
									fill={i < Math.round(hoverBookInfo.average) ? '#ebc033' : '#f9eec7'}
								>
									<path
										d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"
									/>
								</svg>
							{/each}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
{/if}

<div class="section-margin">
	<table border="1" frame="void" rules="rows" id="top-diffs">
		<thead>
			<tr>
				<td>Libro</td>
				<td>Tu puntuación</td>
				<td>Media en GR</td>
				<td>Diferencia</td>
			</tr>
		</thead>
		<tbody>
			{#each top10diff as book}
				<tr>
					<td class="bookTitle">{book.title}</td>
					<td>{book.rating}</td>
					<td>{book.average}</td>
					<td>
						<span
							style="transform: scale(66%);display: inline-block;color:{book.rating > book.average
								? '#409d69'
								: '#c60000'}">{book.rating > book.average ? '▲' : '▼'}</span
						>{Math.abs(Math.round(book.diff * 100) / 100)}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

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

	.bookRating td svg {
		height: 0.8lh;
		aspect-ratio: 1;
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
			font-weight: bold;
			border-bottom: solid 2px black;
		}

		& td {
			padding: 0.5em 0;
			&:not(:first-of-type) {
				text-align: center;
			}
			&.bookTitle {
				text-align: left;
				font-size: 1rem;
			}
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
