<script>
	/**
	 * @component
	 * Línea para dibujar dentro de un CanvasWrapper. Los extremos se animan al cambiar.
	 *
	 * @prop {number} x1 - Inicio, eje horizontal.
	 * @prop {number} y1 - Inicio, eje vertical.
	 * @prop {number} x2 - Fin, eje horizontal.
	 * @prop {number} y2 - Fin, eje vertical.
	 * @prop {string} stroke - Color. Por defecto '#000'.
	 * @prop {number} lineWidth - Grosor. Por defecto 1.
	 * @prop {number} globalAlpha - Opacidad (0-1). Por defecto 1.
	 * @prop {number} z - Capa: las de menor valor se pintan debajo. Por defecto 0.
	 */
	import { getContext } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	let { x1, y1, x2, y2, stroke = '#000', lineWidth = 1, globalAlpha = 1, z = 0 } = $props();

	const ends = Tween.of(() => ({ x1, y1, x2, y2 }), { duration: 400, easing: cubicOut });

	const { add } = getContext('canvas');

	$effect(() =>
		add((ctx) => {
			ctx.strokeStyle = stroke;
			ctx.lineWidth = lineWidth;
			ctx.globalAlpha = globalAlpha;
			ctx.beginPath();
			ctx.moveTo(ends.current.x1, ends.current.y1);
			ctx.lineTo(ends.current.x2, ends.current.y2);
			ctx.stroke();
		}, z)
	);
</script>
