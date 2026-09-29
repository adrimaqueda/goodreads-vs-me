import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// maxDuration da margen a la primera petición (RSS) y a cada lote de
		// metadatos. En el plan Hobby de Vercel el máximo es 60s.
		adapter: adapter({ maxDuration: 60 }),
		experimental: {
			remoteFunctions: true
		}
	},
	compilerOptions: {
		experimental: {
			async: true
		}
	}
};

export default config;
