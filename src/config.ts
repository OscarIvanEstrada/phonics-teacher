/**
 * Static build (GitHub Pages): no server, so no /api/* calls. Audio comes only from what is
 * published on GitHub; anything missing falls back to the browser voice.
 * Build with: VITE_STATIC=true VITE_BASE=/phonics-teacher/ vite build
 */
export const IS_STATIC = import.meta.env.VITE_STATIC === 'true';
