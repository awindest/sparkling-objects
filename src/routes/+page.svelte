<script lang="ts">
	import { Canvas } from '@threlte/core'
	import { NoToneMapping } from 'three'
	import { WebGPURenderer } from 'three/webgpu'
	import Scene from '#lib/components/Scene.svelte'
	import Hamburger from '#lib/components/Hamburger.svelte'

	// Threlte owns resize + pixel-ratio handling, so the whole DataViz shell
	// (resize/visibility listeners, observers, debounce timer) is no longer needed.
	const createRenderer = (canvas: HTMLCanvasElement) =>
		new WebGPURenderer({ canvas, alpha: true, antialias: true })

	let open = $state(false)
</script>

<div class="app">
	<!-- NoToneMapping matches the original (Threlte defaults to ACES) -->
	<Canvas {createRenderer} toneMapping={NoToneMapping}>
		<Scene />
	</Canvas>
	<Hamburger bind:open />
</div>

<style>
	:global(html, body) {
		margin: 0;
		width: 100%;
		height: 100%;
		touch-action: none;
	}

	.app {
		position: fixed;
		inset: 0;
		overflow: hidden;
		touch-action: none;
	}
</style>
