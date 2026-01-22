<script>
	import { getCachedOrFetchData } from './scrape.remote';
	import BooksList from '$lib/BooksList.svelte';
	import Compare from '$lib/Compare.svelte';

	import { fly, scale, slide } from 'svelte/transition';
	import { Confetti } from 'svelte-confetti';
	import YearSummary from '$lib/YearSummary.svelte';
	import { innerWidth } from 'svelte/reactivity/window';

	let goodreadsId = $state('');
	let loading = $state(false);
	let error = $state('');
	let data = $state(null);

	async function handleSubmit() {
		if (!goodreadsId) {
			error = 'Por favor, introduce un ID';
			return;
		}

		loading = true;
		error = '';

		try {
			const result = await getCachedOrFetchData(goodreadsId.toString());
			data = result;
		} catch (err) {
			error = err.message || 'Error al obtener datos de Goodreads';
			console.error('❌ Error:', err);
			data = null; // Solo limpiamos data si hay error
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (error === 'Por favor, introduce un ID') {
			setTimeout(() => {
				error = '';
			}, 2000);
		}
	});
</script>

{#if data === null}
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

		<div class="input-container">
			<input
				type="number"
				bind:value={goodreadsId}
				placeholder="Introduce tu id de Goodreads (ej: 172594000)"
				disabled={loading}
				onkeydown={(e) => e.key === 'Enter' && handleSubmit()}
			/>
			<button onclick={handleSubmit} disabled={loading}>
				{loading ? 'Cargando...' : 'Buscar'}
			</button>
		</div>

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
				<div class="dots">
					<span class="dot"></span>
					<span class="dot"></span>
					<span class="dot"></span>
				</div>
			</div>
		{/if}

		<details>
			<summary>¿Cómo saber tu id?</summary>
			<p>
				💻 <b>Desde el ordenador</b>: ve a tu perfil de Goodreads y comprueba la url, te aparecerá
				algo como
				<code>goodreads.com/user/show/123456789-pepito-perez</code>, tu id es el número que aparece,
				en este caso <code>123456789</code>.
			</p>
			<p>
				📱<b>Desde el móvil</b>: puedes hacer los mismo que en el ordenador accediendo a Goodreads
				desde el navegador. Otra opción es compartir tu perfil de Goodreads por Whatsapp, antes de
				enviar el mensaje puedes ver el link que se genera.
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

	{#if data && !loading}
		{@const shelves = data.shelves.map((d) => ({
			name: d,
			books: data.books.filter((b) => b.shelves.includes(d)).length
		}))}
		<section transition:fly={{ y: 500 }}>
			<Compare books={data.books} />

			<YearSummary books={data.books} />

			<BooksList books={data.books} {shelves} />
		</section>
	{/if}
</main>
<footer>
	<p style="position: relative;bottom:0;text-align: center;padding-bottom: 1rem;">
		Puedes ver el código completo de esta web en <a
			href="https://github.com/adrimaqueda/goodreads-review"
			target="_blank">GitHub</a
		>
		• Desarrollado por <a href="https://adrimaqueda.com">Adrián Maqueda</a>
	</p>
</footer>

<style>
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
