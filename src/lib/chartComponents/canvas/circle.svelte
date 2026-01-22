<script>
	/**
	 * @component
	 * CanvasFeature component to draw a feature on a Canvas.svelte component with various styling options.
	 * Use this component as children for Canvas.svelte
	 *
	 * @prop {string} path - The path data for the feature.
	 * @prop {string} fill - The fill color for the feature.
	 * @prop {string} stroke - The stroke color for the feature.
	 * @prop {number} strokeWidth - The width of the stroke. Default is 1.
	 * @prop {string} backgroundStroke - The background stroke color for the feature. Default is undefined.
	 * @prop {number} backgroundStrokeWidth - The width of the background stroke. Default is 3.
	 * @prop {string} foregroundStroke - The foreground stroke color for the feature. Default is undefined.
	 * @prop {number} foregroundStrokeWidth - The width of the foreground stroke. Default is 1.
	 * @prop {number} globalAlpha - The global alpha value for the feature. Default is 1.0.
	 * @prop {boolean} showStroke - Indicates if the stroke should be shown. Default is false.
	 * @prop {boolean} showFill - Indicates if the fill should be shown. Default is false.
	 * @prop {CanvasPattern} pattern - The pattern to be used for filling the feature. Default is undefined.
	 * @prop {string} contextName - The context name for the canvas. Default is 'spiegel-canvas'.
	 */

	import { getContext } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	let { fill, x, y, r, globalAlpha = 1, contextName = 'canvas' } = $props();

	const { register, deregister, invalidate } = $derived(getContext(contextName));

	const tweenedR = new Tween(r, {
		duration: 400,
		easing: cubicOut
	});

	$effect(() => {
		tweenedR.target = r;
	});

	function draw(ctx) {
		ctx.fillStyle = fill;
		ctx.globalAlpha = globalAlpha;
		ctx.beginPath();
		ctx.arc(x, y, tweenedR.current, 0, 2 * Math.PI, false);
		ctx.fill();
	}

	$effect(() => {
		register(draw);
		invalidate();
		return () => deregister(draw);
	});

	$effect(() => {
		(x, y, r);
		invalidate();
	});
</script>
