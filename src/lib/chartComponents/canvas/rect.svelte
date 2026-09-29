<script>
	/**
	 * @component
	 * Rectángulo para dibujar dentro de un CanvasWrapper.
	 *
	 * @prop {number} x - Esquina superior izquierda, eje horizontal.
	 * @prop {number} y - Esquina superior izquierda, eje vertical.
	 * @prop {number} width - Ancho.
	 * @prop {number} height - Alto.
	 * @prop {string} fill - Color de relleno.
	 * @prop {number} globalAlpha - Opacidad (0-1). Por defecto 1.
	 */
	import { getContext } from 'svelte';

	let { x, y, width, height, fill, globalAlpha = 1 } = $props();

	const { add } = getContext('canvas');

	$effect(() =>
		add((ctx) => {
			ctx.fillStyle = fill;
			ctx.globalAlpha = globalAlpha;
			ctx.fillRect(x, y, width, height);
		})
	);
</script>
