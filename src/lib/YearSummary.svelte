<script lang="ts">
	import { formatLocale, groups, mean, rollups, scaleLinear, sum, type ScaleLinear } from 'd3';
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';
	import { formatNumber, type Book } from '$lib/books';

	let { books }: { books: Book[] } = $props();

	// Libros puntuados agrupados por año de lectura, en orden cronológico. Los
	// leídos sin puntuar no cuentan: entrarían como ceros en la puntuación media.
	let years = $derived(
		groups(
			books.filter((d) => d.rating !== 0),
			(d) => Number(d.readAt.slice(0, 4))
		)
			.map(([year, books]) => ({ year, books }))
			.filter(({ year }) => year > 0)
			.sort((a, b) => a.year - b.year)
	);

	let currentYear = $derived(years.at(-1)?.year);
	let currentBooks = $derived(years.find(({ year }) => year === currentYear)?.books ?? []);

	// Géneros del año elegido, de más a menos libros. Se muestran los 10 primeros
	// y los que empaten con el décimo.
	let genres = $derived(
		rollups(
			currentBooks.flatMap((d) => d.genres),
			(v) => v.length,
			(genre) => genre
		).sort((a, b) => b[1] - a[1])
	);
	let topGenres = $derived(genres.filter(([, count]) => count >= (genres[9]?.[1] ?? 0)));

	let barsWidth = $state(200);
	let barScale = $derived(
		scaleLinear()
			.domain([0, genres[0]?.[1] ?? 1])
			.range([0, barsWidth - 160])
	);

	// Resumen de cada año para el gráfico de dispersión. Las claves son también
	// las opciones de los selectores de ejes.
	let stats = $derived(
		years.map(({ year, books }) => ({
			año: year,
			'libros puntuados': books.length,
			'páginas leídas': sum(books, (d) => d.numberOfPages),
			// Sólo cuentan los libros con número de páginas conocido.
			'extensión media de los libros': mean(books, (d) => d.numberOfPages || undefined) ?? 0,
			'puntuación media': mean(books, (d) => d.rating) ?? 0
		}))
	);

	type Stats = (typeof stats)[number];
	type Variable = keyof Stats;
	const variables: Variable[] = [
		'año',
		'libros puntuados',
		'páginas leídas',
		'extensión media de los libros',
		'puntuación media'
	];

	let xVar: Variable = $state('extensión media de los libros');
	let yVar: Variable = $state('puntuación media');
	let rVar: Variable = $state('libros puntuados');
	let selected: Stats | null = $state(null);

	let width = $state(300);
	const height = 500;
	const margin = { top: 20, right: 20, bottom: 30, left: 50 };

	function domain(variable: Variable): [number, number] {
		if (variable === 'puntuación media') return [1, 5];
		const values = stats.map((d) => d[variable]);
		if (variable === 'año') return [Math.min(...values), Math.max(...values)];
		return [0, Math.max(...values) || 1];
	}

	let xScale = $derived(
		scaleLinear()
			.domain(domain(xVar))
			.nice()
			.rangeRound([margin.left, width - margin.right])
	);
	let yScale = $derived(
		scaleLinear()
			.domain(domain(yVar))
			.nice()
			.rangeRound([height - margin.bottom, margin.top])
	);
	let rScale = $derived(scaleLinear().domain(domain(rVar)).rangeRound([10, 20]));

	// Coloca el centro del círculo de cada año en su punto del gráfico.
	const center = (stat: Stats) =>
		`translate(${xScale(stat[xVar])}px, ${yScale(stat[yVar])}px) translate(-50%, -50%)`;

	// Marcas de los ejes en formato español ("1,5", "12k"); los años, enteros y tal cual.
	const siFormat = formatLocale({
		decimal: ',',
		thousands: '.',
		grouping: [3],
		currency: ['', ' €']
	}).format('~s');

	function ticks(scale: ScaleLinear<number, number>, variable: Variable) {
		return scale
			.ticks(5)
			.filter((tick) => variable !== 'año' || Number.isInteger(tick))
			.map((tick) => ({ value: tick, label: variable === 'año' ? String(tick) : siFormat(tick) }));
	}
</script>

{#snippet variableOptions()}
	{#each variables as variable (variable)}
		<option value={variable}>{variable}</option>
	{/each}
{/snippet}

{#if years.length === 0}
	<div class="text-container section-margin">
		<p>
			No hay libros puntuados con fecha de lectura, así que no puedo resumir tus lecturas por año.
		</p>
	</div>
{:else}
	<div class="text-container section-margin">
		<p>
			Además de las puntuaciones de los libros, estas son las categorías que más has leído cada año
			(cada libro tiene como máximo 7 categorías):
		</p>
	</div>

	<div class="year-picker">
		{#if years.length <= 5}
			{#each years as { year } (year)}
				<button class:active={year === currentYear} onclick={() => (currentYear = year)}>
					{year}
				</button>
			{/each}
		{:else}
			<select
				value={currentYear}
				onchange={(e) => (currentYear = Number(e.currentTarget.value))}
				aria-label="Año"
			>
				{#each years as { year } (year)}
					<option value={year}>{year}</option>
				{/each}
			</select>
		{/if}
	</div>

	<div class="text-container" style="text-align: center;padding:1rem 0">
		<p>
			<b>{currentBooks.length}</b>
			{currentBooks.length === 1 ? 'libro puntuado' : 'libros puntuados'}
		</p>
	</div>

	{#if genres.length > 0}
		<div class="bars section-margin" bind:clientWidth={barsWidth}>
			{#each topGenres as [genre, count] (genre)}
				<div class="rowContainer" animate:flip={{ duration: 300 }} transition:fly={{ y: 200 }}>
					<p class="genreName">{genre}</p>
					<div class="bar" style:width="{barScale(count)}px">
						<p class="barNumber" style:right={barScale(count) < 20 ? '-1rem' : '0.5rem'}>
							{count}
						</p>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<div class="text-container section-margin">
		<p>
			También puedes ver un resumen de cómo has leído cada año en base al número de libros leídos,
			páginas, puntuación media...
		</p>
	</div>

	<div class="axis-vars">
		<label>
			Eje horizontal:
			<select bind:value={xVar}>{@render variableOptions()}</select>
		</label>
		<label>
			Eje vertical:
			<select bind:value={yVar}>{@render variableOptions()}</select>
		</label>
		<label>
			Tamaño del círculo:
			<select bind:value={rVar}>{@render variableOptions()}</select>
		</label>
	</div>

	<div class="scatterplot" bind:clientWidth={width}>
		<svg {width} {height}>
			<line
				x1={xScale.range()[0]}
				x2={xScale.range()[0]}
				y1={yScale.range()[0]}
				y2={0}
				stroke="#222"
				stroke-width="2"
			/>
			<line
				x1={xScale.range()[0]}
				x2={xScale.range()[1]}
				y1={yScale.range()[0]}
				y2={yScale.range()[0]}
				stroke="#222"
				stroke-width="2"
			/>
			{#each ticks(xScale, xVar) as tick (tick.value)}
				<text x={xScale(tick.value)} y={height} text-anchor="middle">{tick.label}</text>
				<line
					x1={xScale(tick.value)}
					x2={xScale(tick.value)}
					y1={yScale.range()[0]}
					y2={yScale.range()[0] + 10}
					stroke="#222"
					stroke-width="2"
				/>
			{/each}

			{#each ticks(yScale, yVar) as tick (tick.value)}
				<text
					x={xScale.range()[0] - 15}
					y={yScale(tick.value)}
					dominant-baseline="middle"
					text-anchor="end"
				>
					{tick.label}
				</text>
				<line
					x1={xScale.range()[0]}
					x2={xScale.range()[1]}
					y1={yScale(tick.value)}
					y2={yScale(tick.value)}
					stroke="#aaa"
					opacity="0.3"
				/>
			{/each}
		</svg>

		<div class="circles">
			{#each stats as stat (stat.año)}
				<div
					class="circle"
					class:dimmed={selected && selected.año !== stat.año}
					style:transform={center(stat)}
					style:anchor-name="--year-circle-{stat.año}"
					style:width="{rScale(stat[rVar]) * 2}px"
					style:height="{rScale(stat[rVar]) * 2}px"
					ontouchend={() => (selected = stat)}
					onmouseover={() => (selected = stat)}
					onmouseout={() => (selected = null)}
					onfocus={() => (selected = stat)}
					onblur={() => (selected = null)}
					role="button"
					tabindex="0"
					aria-label="Datos del año {stat.año}"
				></div>
			{/each}
		</div>

		{#if selected}
			<div
				class="tooltip"
				style:position-anchor="--year-circle-{selected.año}"
				in:fly={{ y: height - yScale(selected[yVar]), duration: 300 }}
				out:fade={{ duration: 150 }}
			>
				<table>
					<tbody>
						<tr><td>Año:</td><td>{selected.año}</td></tr>
						<tr>
							<td>Libros puntuados:</td>
							<td>{formatNumber(selected['libros puntuados'])}</td>
						</tr>
						<tr>
							<td>Páginas leídas:</td>
							<td>{formatNumber(selected['páginas leídas'])}</td>
						</tr>
						<tr>
							<td>Extensión media de los libros:</td>
							<td>{formatNumber(Math.round(selected['extensión media de los libros']))} págs</td>
						</tr>
						<tr>
							<td>Puntuación media:</td>
							<td>{formatNumber(selected['puntuación media'])}</td>
						</tr>
					</tbody>
				</table>
			</div>
		{/if}
	</div>
{/if}

<style>
	.year-picker {
		display: flex;
		justify-content: center;
		column-gap: 1rem;
	}

	button {
		cursor: pointer;
		background-color: white;
		color: black;
		border: solid 1px black;
		border-radius: 10px;
		padding: 5px 10px;
		transition:
			background-color 0.3s,
			color 0.3s,
			transform 0.1s;

		&.active {
			background-color: black;
			color: white;
		}

		&:hover {
			box-shadow: 0 0 3px -1px black;
		}

		&:active {
			transform: scale(0.9);
		}
	}

	select {
		appearance: none;
		background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
		background-repeat: no-repeat;
		background-position: right 0.65rem center;
		background-size: 1.2rem;
		padding: 0.65rem 2.7rem 0.65rem 1rem;
		border: 2px solid #e0e0e0;
		border-radius: 10px;
		font-size: 0.95rem;
		font-weight: 500;
		color: #222;
		background-color: white;
		cursor: pointer;
		transition:
			border-color 0.25s ease,
			box-shadow 0.25s ease,
			background-color 0.2s ease,
			transform 0.15s ease;
		font-family: inherit;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

		&:hover {
			border-color: #ebc033;
			box-shadow: 0 4px 12px rgba(235, 192, 51, 0.25);
			transform: translateY(-1px);
		}

		&:focus {
			outline: none;
			border-color: #ebc033;
			box-shadow: 0 0 0 4px rgba(235, 192, 51, 0.15);
		}

		&:active {
			transform: translateY(0);
			background-color: #fafafa;
		}

		option {
			padding: 0.5rem 1rem;
			background-color: white;
			color: #222;
			font-weight: 500;

			&:checked {
				background: linear-gradient(135deg, #ebc033 0%, #e5b82e 100%);
				background-color: #ebc033;
				color: white;
				font-weight: 600;
			}

			&:hover {
				background: #ebc033;
				color: white;
			}
		}
	}

	.bars {
		overflow: hidden;
		position: relative;
	}

	.rowContainer {
		display: flex;
		flex-direction: row;
		align-items: center;
		height: 30px;
		column-gap: 10px;
	}

	.genreName {
		width: 150px;
		text-align: right;
	}

	.bar {
		position: relative;
		height: 25px;
		background: #ebc033;
		width: 100%;
		transition: width 0.3s;
		border-top-right-radius: 5px;
		border-bottom-right-radius: 5px;

		.barNumber {
			position: absolute;
			right: 0.5rem;
			top: calc((21px - 1rem) / 2);
		}
	}

	.axis-vars {
		width: 100%;
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 2rem;
		margin-bottom: 2rem;
		text-align: center;

		label {
			display: flex;
			flex-direction: column;
			gap: 10px;
			font-weight: 500;
		}
	}

	@media (width < 550px) {
		.axis-vars {
			flex-direction: column;
		}
	}

	.scatterplot {
		position: relative;
	}

	.circles {
		position: absolute;
		top: 0;
	}

	.circle {
		background: #ebc033;
		position: absolute;
		border-radius: 50%;
		opacity: 0.7;
		transition: transform 0.3s;
		cursor: pointer;

		&.dimmed {
			opacity: 0.2;
		}
	}

	.tooltip {
		pointer-events: none;
		position: absolute;
		position-area: bottom center;
		position-try-fallbacks: flip-block;
		background: rgba(255, 255, 255, 0.85);
		color: #444;
		padding: 8px 12px;
		border-radius: 6px;
		border: solid 2px #444;
		font-size: 14px;
		white-space: nowrap;
		z-index: 10;
		margin-top: 10px;
		backdrop-filter: blur(4px);
	}

	tr {
		td:first-of-type {
			padding-right: 10px;
		}
		td:nth-of-type(2) {
			font-weight: bold;
			text-align: right;
		}
	}
</style>
