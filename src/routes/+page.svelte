<script>
	import { getBookList, fetchMetadataBatch } from './scrape.remote';
	import BooksList from '$lib/BooksList.svelte';
	import Compare from '$lib/Compare.svelte';
	import YearSummary from '$lib/YearSummary.svelte';
	import { parseUserId } from '$lib/books';

	import { isHttpError } from '@sveltejs/kit';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { fly, scale } from 'svelte/transition';
	import { Confetti } from 'svelte-confetti';
	import { innerWidth } from 'svelte/reactivity/window';

	let input = $state('');
	let loading = $state(false);
	let error = $state('');
	// $state.raw: la lista puede tener miles de libros y nunca se modifica.
	let books = $state.raw(null);
	let copied = $state(false);

	// Progreso del scrapeo incremental de metadatos
	let progress = $state(0);
	let progressTotal = $state(0);

	// Tamaño de cada lote de libros. Cada petición de metadatos se mantiene muy
	// por debajo del tiempo límite de la función serverless, evitando que las
	// librerías grandes hagan fallar la carga.
	const BATCH_SIZE = 20;

	// Los enlaces con ?id=123 cargan esa librería directamente.
	onMount(() => {
		const userId = parseUserId(page.url.searchParams.get('id') ?? '');
		if (userId) {
			input = userId;
			load(userId);
		}
	});

	function handleSubmit(event) {
		event.preventDefault();

		const userId = parseUserId(input);
		if (!userId) {
			error =
				'No encuentro ningún ID en lo que has escrito: pega tu número de usuario de Goodreads o la URL de tu perfil.';
			return;
		}

		input = userId;
		// La URL queda como enlace para volver a estos resultados o compartirlos.
		replaceState(`?id=${userId}`, {});
		load(userId);
	}

	async function load(userId) {
		loading = true;
		error = '';
		progress = 0;
		progressTotal = 0;

		try {
			// Paso 1: lista de libros (rápido), con los metadatos que ya tenga el
			// servidor en caché y las URLs de los libros que faltan por analizar.
			const { books: list, pending } = await getBookList(userId);

			// Paso 2: analizar por lotes los libros que faltan, mostrando progreso.
			progressTotal = pending.length;
			const metadata = new Map();
			for (let i = 0; i < pending.length; i += BATCH_SIZE) {
				const batch = pending.slice(i, i + BATCH_SIZE);
				try {
					for (const meta of await fetchMetadataBatch(batch)) metadata.set(meta.url, meta);
				} catch (err) {
					// Un lote fallido no debe tirar toda la carga: seguimos con el resto.
					console.warn('⚠️ Error en un lote de metadatos:', err);
				}
				progress += batch.length;
			}

			books = list.map((book) => ({ ...book, ...metadata.get(book.url) }));
		} catch (err) {
			// Los errores previstos (librería privada, ID inexistente...) llegan del
			// servidor con un mensaje para el usuario.
			if (isHttpError(err) && err.status !== 500) {
				error = err.body.message;
			} else {
				error = 'Error al obtener datos de Goodreads';
				console.error('❌ Error:', err);
			}
			books = null;
		} finally {
			loading = false;
		}
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(location.href);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Sin permiso para el portapapeles: el enlace sigue en la barra de direcciones.
		}
	}
</script>

{#if books === null}
	<div
		style="position: fixed;top: -50px;left: 0;height: 100vh;width: 100vw;display: flex;justify-content: center;overflow: hidden;pointer-events: none;z-index:-1"
	>
		<Confetti
			x={[-5, 5]}
			y={[0, 0.1]}
			delay={[500, 2000]}
			infinite
			duration="10000"
			amount="15"
			fallDistance="100vh"
			size="50"
			colorArray={['url(https://em-content.zobj.net/source/apple/354/books_1f4da.png)']}
		/>
	</div>
{/if}

<main>
	<section id="id-input">
		<h1>Goodreads vs Me</h1>

		<form class="input-container" onsubmit={handleSubmit}>
			<input
				type="text"
				bind:value={input}
				placeholder="Tu ID o la URL de tu perfil (ej: 172594000)"
				aria-label="ID o URL de tu perfil de Goodreads"
				autocomplete="off"
				required
				disabled={loading}
			/>
			<button disabled={loading}>
				{loading ? 'Cargando...' : 'Buscar'}
			</button>
		</form>

		{#if loading}
			<div class="loading-container" transition:scale={{ duration: 300 }}>
				<div class="book-loader">
					<div class="book">
						<div class="page"></div>
						<div class="page page2"></div>
						<div class="page page3"></div>
					</div>
				</div>
				<p class="loading-text">
					Recopilando tus libros...<br />
					<span style="color:#888;font-size:.85rem">(puede tomar un rato si tienes muchos)</span>
				</p>
				{#if progressTotal > 0}
					<div
						class="progress"
						role="progressbar"
						aria-valuemin="0"
						aria-valuemax={progressTotal}
						aria-valuenow={progress}
					>
						<div class="progress-bar" style="width: {(progress / progressTotal) * 100}%"></div>
					</div>
					<p class="progress-label">{progress} / {progressTotal} libros analizados</p>
				{:else}
					<div class="dots">
						<span class="dot"></span>
						<span class="dot"></span>
						<span class="dot"></span>
					</div>
				{/if}
			</div>
		{/if}

		{#if books && !loading}
			<button class="share" onclick={copyLink}>
				{copied ? '✅ Enlace copiado' : '🔗 Copiar enlace a estos resultados'}
			</button>
		{/if}

		<details>
			<summary>¿Cómo saber tu id?</summary>
			<p>
				💻 <b>Desde el ordenador</b>: ve a tu perfil de Goodreads y copia la url, que será algo como
				<code>goodreads.com/user/show/123456789-pepito-perez</code>. Puedes pegarla tal cual o
				escribir solo el número (<code>123456789</code>).
			</p>
			<p>
				📱<b>Desde el móvil</b>: puedes hacer lo mismo que en el ordenador accediendo a Goodreads
				desde el navegador. Otra opción es compartir tu perfil desde la app de Goodreads y pegar
				aquí el enlace que se genera.
			</p>
			<p>
				✍️ <b>Si tienes perfil de autor</b>: el ID de autor no sirve, porque tu librería está ligada
				a tu ID de usuario y Goodreads ya no lo enlaza desde el perfil de autor. Para encontrarlo,
				entra en <i>My Books</i> y copia el número de la url:
				<code>goodreads.com/review/list/[TU_ID]?ref=nav_mybooks</code>.
			</p>
		</details>

		{#if innerWidth.current < 550}
			<p style="color:#888;margin-top:1rem">
				La web está preparada para usarla en móvil, pero –sobre todo si tienes muchos libros
				registrados– te recomiendo verla en el ordenador
			</p>
		{/if}

		{#if error}
			<p class="error" transition:scale={{ duration: 300 }}>{error}</p>
		{/if}
	</section>

	{#if books && !loading}
		<section transition:fly={{ y: 500 }}>
			<Compare {books} />

			<YearSummary {books} />

			<BooksList {books} />
		</section>
	{/if}
</main>
<footer>
	<p style="position: relative;bottom:0;text-align: center;padding-bottom: 1rem;">
		Puedes ver el código completo de esta web en <a
			href="https://github.com/adrimaqueda/goodreads-vs-me"
			target="_blank">GitHub</a
		>
		• Desarrollado por <a href="https://adrimaqueda.com">Adrián Maqueda</a>
	</p>
</footer>

<style>
	.share {
		margin-top: 1rem;
		padding: 0;
		background: none;
		color: #409d69;
		font-size: 0.95rem;
		text-decoration: underline;
	}

	.loading-container {
		margin-top: 2rem;
		text-align: center;
		padding: 2rem;
		display: flex;
		flex-direction: column;
	}

	.book-loader {
		display: inline-block;
		margin: 0 auto 1rem;
	}

	.book {
		position: relative;
		width: 60px;
		height: 80px;
		perspective: 600px;
		transform: translateX(50%);
	}

	.page {
		position: absolute;
		width: 100%;
		height: 100%;
		background: linear-gradient(to right, #f0f0f0 0%, #e0e0e0 100%);
		border: 2px solid #333;
		border-radius: 0 4px 4px 0;
		transform-origin: left center;
		animation: flip 1.5s infinite ease-in-out;
	}

	.page2 {
		animation-delay: 0.3s;
		background: linear-gradient(to right, #e8e8e8 0%, #d8d8d8 100%);
	}

	.page3 {
		animation-delay: 0.6s;
		background: linear-gradient(to right, #e0e0e0 0%, #d0d0d0 100%);
	}

	@keyframes flip {
		0%,
		20% {
			transform: rotateY(0deg);
		}
		50% {
			transform: rotateY(-180deg);
		}
		100% {
			transform: rotateY(-180deg);
		}
	}

	.loading-text {
		font-size: 1.1rem;
		color: #333;
		margin: 1rem 0 0.5rem 0;
		font-weight: 500;
	}

	.progress {
		width: 100%;
		max-width: 260px;
		height: 8px;
		margin: 0.75rem auto 0;
		background-color: #f0f0f0;
		border-radius: 50px;
		overflow: hidden;
	}

	.progress-bar {
		height: 100%;
		background-color: #ebc033;
		border-radius: 50px;
		transition: width 0.3s ease;
	}

	.progress-label {
		margin-top: 0.5rem;
		font-size: 0.85rem;
		color: #888;
	}

	.dots {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.dot {
		width: 8px;
		height: 8px;
		background-color: #666;
		border-radius: 50%;
		animation: bounce 1.4s infinite ease-in-out both;
	}

	.dot:nth-child(1) {
		animation-delay: -0.32s;
	}

	.dot:nth-child(2) {
		animation-delay: -0.16s;
	}

	@keyframes bounce {
		0%,
		80%,
		100% {
			transform: scale(0);
			opacity: 0.5;
		}
		40% {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>
