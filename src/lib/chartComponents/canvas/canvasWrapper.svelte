<script>
	/**
	 * @component
	 * Lienzo en el que dibujan las formas hijas (Circle, Rect, Text, Line).
	 *
	 * Cada forma registra su función de dibujo con `add`. El lienzo se pinta
	 * dentro de un efecto, así que Svelte registra como dependencias todo lo que
	 * leen esas funciones: cualquier cambio (posiciones, radios animados,
	 * opacidad, formas que aparecen o desaparecen) lo repinta una vez, y en
	 * reposo no se repinta nada. Las formas se pintan por capas (`z`, de menor
	 * a mayor) y, dentro de cada capa, en el orden en que se añadieron.
	 *
	 * @prop {number} width - Ancho en píxeles CSS.
	 * @prop {number} height - Alto en píxeles CSS.
	 */
	import { setContext } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { devicePixelRatio } from 'svelte/reactivity/window';

	let { width, height, children } = $props();

	// Al menos 2x para que se vea nítido también en pantallas normales.
	const dpr = Math.max(2, devicePixelRatio.current || 1);
	const shapes = new SvelteSet();
	let canvas = $state();

	setContext('canvas', {
		/** Registra una función de dibujo en la capa `z` y devuelve la que la quita. */
		add(draw, z = 0) {
			const shape = { draw, z };
			shapes.add(shape);
			return () => shapes.delete(shape);
		}
	});

	$effect(() => {
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
	});

	$effect(() => {
		const ctx = canvas.getContext('2d');
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);

		for (const { draw } of [...shapes].sort((a, b) => a.z - b.z)) {
			ctx.save();
			draw(ctx);
			ctx.restore();
		}
	});
</script>

<canvas bind:this={canvas}>
	{@render children?.()}
</canvas>
