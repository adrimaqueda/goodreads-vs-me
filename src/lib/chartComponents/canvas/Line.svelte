<script>
	/**
	 * @component
	 * Line component to draw a line on a Canvas.svelte component with various styling options.
	 * Use this component as children for Canvas.svelte
	 *
	 * @prop {number} x1 - The x coordinate of the start point.
	 * @prop {number} y1 - The y coordinate of the start point.
	 * @prop {number} x2 - The x coordinate of the end point.
	 * @prop {number} y2 - The y coordinate of the end point.
	 * @prop {string} stroke - The stroke color for the line.
	 * @prop {number} lineWidth - The width of the line. Default is 1.
	 * @prop {number} globalAlpha - The global alpha value for the line. Default is 1.0.
	 * @prop {string} lineCap - The line cap style ('butt', 'round', 'square'). Default is 'butt'.
	 * @prop {string} lineDash - The line dash pattern as comma-separated values (e.g., '5,5'). Default is undefined.
	 * @prop {string} contextName - The context name for the canvas. Default is 'canvas'.
	 */

	import { getContext } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	let {
		x1,
		y1,
		x2,
		y2,
		stroke = '#000',
		lineWidth = 1,
		globalAlpha = 1,
		lineCap = 'butt',
		lineDash = undefined,
		contextName = 'canvas'
	} = $props();

	const { register, deregister, invalidate } = $derived(getContext(contextName));

	const tweenedX1 = new Tween(x1, {
		duration: 400,
		easing: cubicOut
	});

	const tweenedY1 = new Tween(y1, {
		duration: 400,
		easing: cubicOut
	});

	const tweenedX2 = new Tween(x2, {
		duration: 400,
		easing: cubicOut
	});

	const tweenedY2 = new Tween(y2, {
		duration: 400,
		easing: cubicOut
	});

	$effect(() => {
		tweenedX1.target = x1;
		tweenedY1.target = y1;
		tweenedX2.target = x2;
		tweenedY2.target = y2;
	});

	function draw(ctx) {
		ctx.strokeStyle = stroke;
		ctx.lineWidth = lineWidth;
		ctx.lineCap = lineCap;
		ctx.globalAlpha = globalAlpha;

		if (lineDash) {
			const dashArray = lineDash.split(',').map((v) => parseFloat(v.trim()));
			ctx.setLineDash(dashArray);
		} else {
			ctx.setLineDash([]);
		}

		ctx.beginPath();
		ctx.moveTo(tweenedX1.current, tweenedY1.current);
		ctx.lineTo(tweenedX2.current, tweenedY2.current);
		ctx.stroke();
	}

	$effect(() => {
		register(draw);
		invalidate();
		return () => deregister(draw);
	});

	$effect(() => {
		(x1, y1, x2, y2, stroke, lineWidth, globalAlpha);
		invalidate();
	});
</script>
