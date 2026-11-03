<script lang="ts">
	import { T, useThrelte } from '@threlte/core'
	import { OrbitControls } from '@threlte/extras'

	import { MathUtils, PerspectiveCamera } from 'three'
	import Particles from '#lib/components/Particles.svelte'
	import PostFX from '#lib/components/PostFX.svelte'

	const BASE_FOV = 50 // three's PerspectiveCamera default
	const MAX_ASPECT = 1.5 // was DataViz.cameraMaxAspect

	const { camera, size } = useThrelte()

	// Equivalent of DataViz.#setFovForAspect: past MAX_ASPECT, narrow the FOV
	// so the scene doesn't get wider than a 1.5:1 viewport would show.
	$effect(() => {
		const cam = camera.current
		const { width, height } = size.current
		if (!(cam instanceof PerspectiveCamera) || !height) return

		const aspect = width / height
		if (aspect > MAX_ASPECT) {
			const t = Math.tan(MathUtils.degToRad(BASE_FOV / 2)) / (aspect / MAX_ASPECT)
			cam.fov = 2 * MathUtils.radToDeg(Math.atan(t))
		} else {
			cam.fov = BASE_FOV
		}
		cam.updateProjectionMatrix()
	})
</script>

<!-- 
	autoRotateSpeed is in revolutions per minute scaled by 60, so 0.5 is a slow drift 
 	and 2 is the three.js default. Orbit rotates the camera, not the scene, so it works 
 	on a plain Threlte <Canvas> with the WebGPU renderer. The controls only listen to
	DOM events.
-->

<T.PerspectiveCamera makeDefault position.z={120}>
	<OrbitControls autoRotate autoRotateSpeed={0.5} enableDamping enablePan={false} />
</T.PerspectiveCamera>
<Particles />
<PostFX />
