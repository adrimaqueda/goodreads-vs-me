<script>
	import { getContext } from 'svelte';

	let {
		fill,
		textAlign = 'center',
		text,
		x,
		y,
		size,
		globalAlpha = 1,
		contextName = 'canvas'
	} = $props();

	const { register, deregister, invalidate } = getContext(contextName);

	function draw(ctx) {
		ctx.font = `${size} sans-serif`;
		ctx.fillStyle = fill;
		ctx.textAlign = textAlign;
		ctx.fillText(text, x, y);
	}

	$effect(() => {
		register(draw);
		invalidate();
		return () => deregister(draw);
	});

	$effect(() => {
		(x, y);
		invalidate();
	});
</script>
