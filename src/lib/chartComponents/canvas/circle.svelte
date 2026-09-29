<script>
	/**
	 * @component
	 * Círculo para dibujar dentro de un CanvasWrapper. Los cambios de radio se animan.
	 *
	 * @prop {number} x - Centro en el eje horizontal.
	 * @prop {number} y - Centro en el eje vertical.
	 * @prop {number} r - Radio.
	 * @prop {string} fill - Color de relleno.
	 * @prop {number} globalAlpha - Opacidad (0-1). Por defecto 1.
	 */
	import { getContext } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	let { x, y, r, fill, globalAlpha = 1 } = $props();

	// $derived sólo avisa cuando el radio cambia de verdad, así la animación no
	// se reinicia en cada paso de la simulación de fuerzas.
	const target = $derived(r);
	const radius = Tween.of(() => target, { duration: 400, easing: cubicOut });

	const { add } = getContext('canvas');

	$effect(() =>
		add((ctx) => {
			ctx.fillStyle = fill;
			ctx.globalAlpha = globalAlpha;
			ctx.beginPath();
			ctx.arc(x, y, radius.current, 0, 2 * Math.PI);
			ctx.fill();
		})
	);
</script>
