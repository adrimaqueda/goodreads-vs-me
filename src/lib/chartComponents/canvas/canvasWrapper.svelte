<script>
	/**
	 * @component
	 * Canvas component to render a drawable canvas with optional zoom and transform capabilities.
	 *
	 * @prop {number} width - The width of the canvas.
	 * @prop {number} height - The height of the canvas.
	 * @prop {Object} transform - The transform object for zooming and panning. Default is zoomIdentity.
	 * @prop {boolean} alpha - Indicates if the canvas should support transparency. Default is false.
	 * @prop {boolean} hide - Indicates if the canvas should be hidden. Default is false.
	 * @prop {Function} onmousemove - Callback function for mouse move events. Default is an empty function.
	 * @prop {Function} onclick - Callback function for click events. Default is an empty function.
	 * @prop {string} contextName - The context name for the canvas. Default is 'spiegel-canvas'.
	 * @prop {Function} children - Function to render child components or snippets.
	 *
	 * @css [--position=relative] - The position of the canvas.
	 * @css [--pointer-events=all] - The pointer events of the canvas.
	 */

	import { setContext } from 'svelte';

	let { width, height, contextName = 'canvas', children } = $props();
	import { devicePixelRatio } from 'svelte/reactivity/window';

	const drawFunctions = [];
	const dpr = Math.max(2, devicePixelRatio.current || 1);

	let canvas = $state();
	let ctx = $state();
	let frameId = $state();
	let pendingInvalidation = $state(false);

	function scaleCanvas(canvas, ctx, width, height) {
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		canvas.style.width = width + 'px';
		canvas.style.height = height + 'px';

		ctx.scale(dpr, dpr);
	}

	function invalidate() {
		if (pendingInvalidation) return;
		pendingInvalidation = true;
		frameId = requestAnimationFrame(update);
	}

	function update() {
		if (!ctx) return;

		ctx.clearRect(0, 0, width, height);

		drawFunctions.forEach((fn) => {
			ctx.save();
			fn(ctx);
			ctx.restore();
		});

		pendingInvalidation = false;
	}

	setContext(contextName, {
		register(fn) {
			drawFunctions.push(fn);
		},
		deregister(fn) {
			drawFunctions.splice(drawFunctions.indexOf(fn), 1);
		},
		invalidate
	});

	$effect(() => {
		ctx = canvas.getContext('2d', { willReadFrequently: true });

		return () => {
			if (frameId) {
				cancelAnimationFrame(frameId);
			}
		};
	});

	$effect(() => {
		if (canvas && ctx) scaleCanvas(canvas, ctx, width, height);
	});
</script>

<canvas bind:this={canvas} style="overflow:visible">
	{@render children?.()}
</canvas>

<style>
	canvas {
		top: 0;
		left: 0;
	}
</style>
