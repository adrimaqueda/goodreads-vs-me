<script>
	/**
	 * @component
	 * Texto para dibujar dentro de un CanvasWrapper.
	 *
	 * @prop {string | number} text - Texto.
	 * @prop {number} x - Posición en el eje horizontal.
	 * @prop {number} y - Posición (línea base) en el eje vertical.
	 * @prop {string} size - Tamaño de letra (p. ej. '15px').
	 * @prop {string} fill - Color.
	 * @prop {CanvasTextAlign} textAlign - Alineación. Por defecto 'center'.
	 * @prop {number} globalAlpha - Opacidad (0-1). Por defecto 1.
	 */
	import { getContext } from 'svelte';

	let { text, x, y, size, fill, textAlign = 'center', globalAlpha = 1 } = $props();

	const { add } = getContext('canvas');

	$effect(() =>
		add((ctx) => {
			ctx.font = `${size} sans-serif`;
			ctx.fillStyle = fill;
			ctx.textAlign = textAlign;
			ctx.globalAlpha = globalAlpha;
			ctx.fillText(text, x, y);
		})
	);
</script>
