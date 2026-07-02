<script>
	import { groups, min, max, mean, scaleLinear, sum, format } from 'd3';
	import { flip } from 'svelte/animate';
	import { SvelteMap } from 'svelte/reactivity';
	import { fade, fly } from 'svelte/transition';

	let { books } = $props();

	let years = $derived(
		groups(books, (d) => d['read at'].slice(0, 4))
			.map((d) => ({ year: +d[0], books: d[1] }))
			.filter((d) => d.year !== 0)
	);

	let currentYear = $derived(max(years, (d) => d.year));

	let currentBooks = $derived(years.find((d) => d.year === currentYear)?.books || []);

	let genres = $derived.by(() => {
		const genreMap = new SvelteMap();

		currentBooks.forEach((book) => {
			(book.genres || []).forEach((genre) => {
				genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
			});
		});

		return Array.from(genreMap.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([genre, count]) => ({ genre, count }));
	});

	let barsContainer = $state(200);
	let barScale = $derived(
		scaleLinear()
			.domain([0, Math.max(genres[0]?.count || 1, 1)])
			.range([0, barsContainer - 160])
	);

	// Scatterplot

	let pagesRecount = $derived(
		groups(books, (d) => d['read at'].slice(0, 4))
			.map((d) => ({
				año: +d[0],
				'libros puntuados': d[1].length,
				'páginas leídas': sum(d[1], (d) => d.numberOfPages || 0),
				'extensión media de los libros': mean(d[1], (d) => d.numberOfPages || 0),
				'puntuación media': mean(d[1], (d) => d.rating)
			}))
			.filter((d) => d.año !== 0)
	);

	let scatterPlotContainer = $state(300);
	let scatterPlotHeight = 500;
	let scatterPlotMargins = { top: 20, right: 20, bottom: 30, left: 50 };
	let vars = $derived(Object.keys(pagesRecount[0] || {}));
	let xVar = $state('extensión media de los libros');
	let yVar = $state('puntuación media');
	let rVar = $state('libros puntuados');

	// Helper para obtener el dominio correcto basado en el tipo de variable
	const getDomain = (variable, data) => {
		if (variable === 'puntuación media') return [1, 5];
		if (variable === 'año') {
			return [min(data, (d) => d[variable]), max(data, (d) => d[variable])];
		}
		return [0, max(data, (d) => d[variable]) || 1];
	};

	let xScale = $derived.by(() => {
		const base = scaleLinear().rangeRound([
			scatterPlotMargins.left,
			scatterPlotContainer - scatterPlotMargins.right
		]);
		return base.domain(getDomain(xVar, pagesRecount));
	});

	let yScale = $derived.by(() => {
		const base = scaleLinear().rangeRound([
			scatterPlotHeight - scatterPlotMargins.bottom,
			scatterPlotMargins.top
		]);
		return base.domain(getDomain(yVar, pagesRecount));
	});

	let rScale = $derived.by(() => {
		const base = scaleLinear().rangeRound([10, 20]);
		return base.domain(getDomain(rVar, pagesRecount));
	});

	let selectedYear = $state(null);
</script>

<div class="text-container section-margin">
	<p>
		Además de las puntuaciones de los libros, éstas son las categorías que más he leído cada año
		(cada libro tiene como máximo 7 categorías):
	</p>
</div>

{#if years.map((d) => d.year).length <= 5}
	<div style="display: flex;justify-content: center;column-gap: 1rem;">
		{#each years.map((d) => d.year) as year}
			<button class:active={year === currentYear} onclick={() => (currentYear = year)}>
				{year}
			</button>
		{/each}
	</div>
{:else}
	<div style="display: flex;justify-content: center;">
		<select value={currentYear} onchange={(e) => (currentYear = +e.currentTarget.value)}>
			{#each years.map((d) => d.year) as year}
				<option value={year}>{year}</option>
			{/each}
		</select>
	</div>
{/if}

<div class="text-container" style="text-align: center;padding:1rem 0">
	<p>
		<b>{currentBooks?.length || 0}</b>
		{currentBooks?.length === 1 ? 'libro puntuado' : 'libros puntuados'}
	</p>
</div>

{#if genres.length > 1}
	{@const displayedGenres =
		genres.length < 10 ? genres : genres.filter((d, i) => d.count >= (genres[9]?.count || 0))}

	<div
		style="overflow: hidden;position: relative;"
		class="section-margin"
		bind:clientWidth={barsContainer}
	>
		{#each displayedGenres as { genre, count } (genre)}
			<div class="rowContainer" animate:flip={{ duration: 300 }} transition:fly={{ y: 200 }}>
				<p class="genreName">{genre}</p>
				<div class="bar" style="width: {barScale(count)}px;">
					<p class="barNumber" style="right: {barScale(count) < 20 ? '-1rem' : '0.5rem'};">
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
	<!-- x -->
	<div>
		<p>Eje horizontal:</p>
		<select value={xVar} onchange={(e) => (xVar = e.currentTarget.value)}>
			{#each vars as option}
				<option value={option}>{option}</option>
			{/each}
		</select>
	</div>

	<!-- y -->
	<div>
		<p>Eje vertical:</p>
		<select value={yVar} onchange={(e) => (yVar = e.currentTarget.value)}>
			{#each vars as option}
				<option value={option}>{option}</option>
			{/each}
		</select>
	</div>

	<!-- r -->
	<div>
		<p>Tamaño del círculo:</p>
		<select value={rVar} onchange={(e) => (rVar = e.currentTarget.value)}>
			{#each vars as option}
				<option value={option}>{option}</option>
			{/each}
		</select>
	</div>
</div>

<!-- scatterplot páginas x n libros -->
<div bind:clientWidth={scatterPlotContainer} style="position: relative;">
	<svg height={scatterPlotHeight} width={scatterPlotContainer}>
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
		{#each xScale.ticks(5) as tick}
			{@const text = xVar === 'año' ? tick : format('~s')(tick)}
			<text x={xScale(tick)} y={scatterPlotHeight} text-anchor="middle">{text}</text>
			<line
				x1={xScale(tick)}
				x2={xScale(tick)}
				y1={yScale.range()[0]}
				y2={yScale.range()[0] + 10}
				stroke="#222"
				stroke-width="2"
			/>
		{/each}

		{#each yScale.ticks(5) as tick}
			{@const text = yVar === 'año' ? tick : format('~s')(tick)}

			<text
				x={xScale.range()[0] - 15}
				y={yScale(tick)}
				dominant-baseline="middle"
				text-anchor="end"
			>
				{text}
			</text>
			<line
				x1={xScale.range()[0]}
				x2={xScale.range()[1]}
				y1={yScale(tick)}
				y2={yScale(tick)}
				stroke="#aaa"
				opacity="0.3"
			/>
		{/each}
	</svg>

	<div style="position: absolute;top:0;">
		{#each pagesRecount as year (year.año)}
			<div
				class="circle"
				style="transform:translate(calc({xScale(year[xVar])}px - 50%), calc({yScale(
					year[yVar]
				)}px - 50%)); anchor-name: --year-circle-{year.año};height:{rScale(year[rVar]) *
					2}px;width:{rScale(year[rVar]) * 2}px;opacity:{selectedYear?.año === year.año
					? '0.7'
					: selectedYear === null
						? '0.7'
						: '0.2'}"
				ontouchend={() => (selectedYear = year)}
				onmouseover={() => (selectedYear = year)}
				onmouseout={() => (selectedYear = null)}
				onfocus={() => (selectedYear = year)}
				onblur={() => (selectedYear = null)}
				role="button"
				tabindex="0"
				aria-label="Datos del año {year.año}"
			/>
		{/each}
	</div>

	{#if selectedYear}
		<div
			class="tooltip"
			style="position-anchor: --year-circle-{selectedYear.año};"
			in:fly={{ y: scatterPlotHeight - (yScale(selectedYear?.[yVar]) ?? 0), duration: 300 }}
			out:fade={{ duration: 150 }}
		>
			<table>
				<tbody>
					<tr><td>Año:</td><td>{selectedYear.año}</td></tr>
					<tr>
						<td>Libros puntuados:</td>
						<td>{new Intl.NumberFormat('es-ES').format(selectedYear['libros puntuados'])}</td>
					</tr>
					<tr>
						<td>Páginas leídas:</td>
						<td>{new Intl.NumberFormat('es-ES').format(selectedYear['páginas leídas'])}</td>
					</tr>
					<tr>
						<td>Extensión media de los libros:</td>
						<td>
							{new Intl.NumberFormat('es-ES').format(
								Math.round(selectedYear['extensión media de los libros'])
							)} págs
						</td>
					</tr>
					<tr>
						<td>Puntuación media:</td>
						<td>
							{new Intl.NumberFormat('es-ES').format(
								Math.round(selectedYear['puntuación media'] * 100) / 100
							)}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
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
		background-position: right 0.75rem center;
		background-size: 1.2rem;
		padding-right: 2.5rem;
		padding-left: 0.75rem;
		padding-top: 0.65rem;
		padding-bottom: 0.65rem;
		border: 2px solid #e0e0e0;
		border-radius: 10px;
		font-size: 0.95rem;
		font-weight: 500;
		color: #333;
		background-color: white;
		cursor: pointer;
		transition:
			border-color 0.3s ease,
			box-shadow 0.3s ease,
			background-color 0.2s ease,
			transform 0.2s ease;
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
			color: #333;
			font-weight: 500;

			&:checked {
				background: linear-gradient(#ebc033, #ebc033);
				background-color: #ebc033;
				color: white;
			}
		}
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

	.circle {
		background: #ebc033;
		position: absolute;
		border-radius: 50%;
		transition: transform 0.3s;
		cursor: pointer;
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

	.axis-vars {
		width: 100%;
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 2rem;
		margin-bottom: 2rem;
		text-align: center;

		p {
			margin-bottom: 10px;
			font-weight: 500;
		}

		select {
			appearance: none;
			background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
			background-repeat: no-repeat;
			background-position: right 0.65rem center;
			background-size: 1.2rem;
			padding-right: 2.7rem;
			padding-left: 1rem;
			padding-top: 0.65rem;
			padding-bottom: 0.65rem;
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
	}

	@media (width < 550px) {
		.axis-vars {
			flex-direction: column;
		}
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
