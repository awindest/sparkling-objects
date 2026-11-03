<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core'
	import { RenderPipeline, type WebGPURenderer } from 'three/webgpu'
	import { pass, mrt, output, nodeObject } from 'three/tsl'
	import BloomNode from 'three/addons/tsl/display/BloomNode.js'

	const { renderer, scene, camera, autoRender, renderStage } = useThrelte()

	let post: RenderPipeline | undefined

	// Rebuilt if the default camera changes; everything is released in the cleanup.
	$effect(() => {
		const cam = camera.current
		if (!cam) return

		// We drive rendering ourselves, so switch Threlte's built-in render off.
		const previousAutoRender = autoRender.current
		autoRender.set(false)

		const postProcessing = new RenderPipeline(renderer as unknown as WebGPURenderer)
		const scenePass = pass(scene, cam)
		scenePass.setMRT(mrt({ output }))
		const sceneColor = scenePass.getTextureNode()
		// strength 0.5, radius 0, threshold 0 — same as the original
		const bloom = nodeObject(new BloomNode(nodeObject(sceneColor), 0.5, 0, 0))
		postProcessing.outputNode = sceneColor.add(bloom)
		post = postProcessing

		return () => {
			post = undefined
			bloom.dispose()
			scenePass.dispose()
			autoRender.set(previousAutoRender)
		}
	})

	// Runs in Threlte's render stage, i.e. after the compute task in the main stage.
	useTask(
		() => {
			post?.render()
		},
		{ stage: renderStage, autoInvalidate: false }
	)
</script>
