<script>
	import './app.css';
	import { page } from '$app/state';

	let { children } = $props();
</script>

<svelte:head>
	<title>Goodreads vs Me</title>
	<!-- Las redes sociales sólo aceptan URLs absolutas: se construyen con el dominio real -->
	<meta property="og:url" content="{page.url.origin}/" />
	<meta property="og:image" content="{page.url.origin}/og.png" />
	<meta name="twitter:image" content="{page.url.origin}/og.png" />
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
	<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
	<link rel="manifest" href="/site.webmanifest" />
</svelte:head>

{@render children()}
