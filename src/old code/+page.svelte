<script lang="ts">
	/**
	 * attraction1 — readable reconstruction
	 * Source: threejs-components@0.0.26/build/cursors/attraction1.min.js
	 *
	 * The minified file is ~791 KB / ~40,000 beautified lines, but ~99% of that is a
	 * bundled copy of Three.js r181 (WebGPU renderer + TSL shader-node system).
	 * Only the ~500 lines below (beautified lines 39924-40425) are the actual effect.
	 *
	 * Identifier names were recovered by tracing the minified names back to their
	 * Three.js definitions (e.g. WC = tsl.uniform, RC = tsl.instancedArray,
	 * bC = WebGPURenderer). Logic is unchanged; only names/comments were added.
	 *
	 * Usage (it's an ES module with one default export):
	 *
	 *   import createCursor from "https://cdn.jsdelivr.net/npm/threejs-components@0.0.26/build/cursors/attraction1.min.js";
	 *   const app = createCursor(document.querySelector("canvas"), {
	 *     particles: { count: 16384, type: "box", size: 1, attractionIntensity: 1, maxVelocity: 0.5 },
	 *   });
	 *   // app.dispose() when finished
	 */

	import {
		WebGPURenderer,
		PerspectiveCamera,
		Scene,
		Clock,
		InstancedMesh,
		MeshStandardNodeMaterial,
		DirectionalLight,
		Raycaster,
		Plane,
		Vector2,
		Vector3,
		Vector4,
		MathUtils,
		PostProcessing,
		SRGBColorSpace,
		BoxGeometry,
		OctahedronGeometry,
		SphereGeometry,
		CircleGeometry,
		PlaneGeometry
	} from 'three/webgpu'
	import {
		uniform,
		instancedArray,
		Fn,
		If,
		length,
		min,
		smoothstep,
		instanceIndex,
		rotate,
		attribute,
		normalLocal,
		mrt,
		output,
		pass,
		nodeObject
	} from 'three/tsl'
	import BloomNode from 'three/addons/tsl/display/BloomNode.js'
	import { onMount } from 'svelte'

	const { randFloatSpread, randFloat } = MathUtils

	/* ───────────────────────── 1. Generic Three.js app shell ───────────────────────── */

	class DataViz {
		#options
		#isVisible = false
		#isRunning = false
		#intersectionObserver
		#resizeObserver
		#resizeTimeout
		#clock = new Clock()
		#time = { elapsed: 0, delta: 0 }
		#fpsLimit
		#minFrameTime = 0
		#lastFrameTime = 0

		canvas
		camera
		scene
		renderer
		cameraMinAspect
		cameraMaxAspect
		cameraFov
		maxPixelRatio
		minPixelRatio
		size = { width: 0, height: 0, wWidth: 0, wHeight: 0, ratio: 0, pixelRatio: 0 }
		isDisposed = false

		render = this.#defaultRender
		onBeforeRender = () => {}
		onAfterRender = () => {}
		onAfterResize = () => {}

		constructor(options) {
			this.#options = { ...options }
			this.#initCamera()
			this.#initScene()
			this.#initRenderer()
			this.resize()
			this.#addListeners()
		}

		#initCamera() {
			this.camera = new PerspectiveCamera()
			this.cameraFov = this.camera.fov
		}

		#initScene() {
			this.scene = new Scene()
		}

		#initRenderer() {
			if (this.#options.canvas) this.canvas = this.#options.canvas
			else if (this.#options.id) this.canvas = document.getElementById(this.#options.id)
			else console.error('Three: Missing canvas or id parameter')

			this.canvas.style.display = 'block'
			this.canvas.style.touchAction = 'none'

			const params = { canvas: this.canvas, ...(this.#options.rendererOptions ?? {}) }
			this.renderer = new WebGPURenderer(params)
			this.renderer.outputColorSpace = SRGBColorSpace
		}

		#addListeners() {
			if (!(this.#options.size instanceof Object)) {
				window.addEventListener('resize', this.#onWindowResize.bind(this))
				if (this.#options.size === 'parent') {
					this.#resizeObserver = new ResizeObserver(this.#onWindowResize.bind(this))
					this.#resizeObserver.observe(this.canvas.parentNode)
				}
			}
			// Pause rendering when the canvas is off-screen or the tab is hidden.
			this.#intersectionObserver = new IntersectionObserver(this.#onIntersect.bind(this), {
				root: null,
				rootMargin: '0px',
				threshold: 0
			})
			this.#intersectionObserver.observe(this.canvas)
			document.addEventListener('visibilitychange', this.#onVisibilityChange.bind(this))
		}

		// NOTE: .bind() creates a *new* function each call, so these two
		// removeEventListener calls never match the listeners added above (listener leak).
		#removeListeners() {
			window.removeEventListener('resize', this.#onWindowResize.bind(this))
			this.#resizeObserver?.disconnect()
			this.#intersectionObserver?.disconnect()
			document.removeEventListener('visibilitychange', this.#onVisibilityChange.bind(this))
		}

		#onIntersect(entries) {
			this.#isVisible = entries[0].isIntersecting
			this.#isVisible ? this.#start() : this.#stop()
		}

		#onVisibilityChange() {
			if (this.#isVisible) document.hidden ? this.#stop() : this.#start()
		}

		#onWindowResize() {
			// debounced 100 ms
			if (this.#resizeTimeout) clearTimeout(this.#resizeTimeout)
			this.#resizeTimeout = setTimeout(this.resize.bind(this), 100)
		}

		resize() {
			let w, h
			if (this.#options.size instanceof Object) {
				w = this.#options.size.width
				h = this.#options.size.height
			} else if (this.#options.size === 'parent' && this.canvas.parentNode) {
				w = this.canvas.parentNode.offsetWidth
				h = this.canvas.parentNode.offsetHeight
			} else {
				w = window.innerWidth
				h = window.innerHeight
			}
			this.size.width = w
			this.size.height = h
			this.size.ratio = w / h
			this.#updateCamera()
			this.#updateRenderer()
			this.onAfterResize(this.size)
		}

		#updateCamera() {
			this.camera.aspect = this.size.width / this.size.height
			if (this.camera.isPerspectiveCamera && this.cameraFov) {
				// Clamp the aspect ratio by widening/narrowing the FOV.
				if (this.cameraMinAspect && this.camera.aspect < this.cameraMinAspect)
					this.#setFovForAspect(this.cameraMinAspect)
				else if (this.cameraMaxAspect && this.camera.aspect > this.cameraMaxAspect)
					this.#setFovForAspect(this.cameraMaxAspect)
				else this.camera.fov = this.cameraFov
			}
			this.camera.updateProjectionMatrix()
			this.updateWorldSize()
		}

		#setFovForAspect(targetAspect) {
			const t =
				Math.tan(MathUtils.degToRad(this.cameraFov / 2)) / (this.camera.aspect / targetAspect)
			this.camera.fov = 2 * MathUtils.radToDeg(Math.atan(t))
		}

		// World-space size of the visible area at the origin plane.
		updateWorldSize() {
			if (this.camera.isPerspectiveCamera) {
				const fovRad = (this.camera.fov * Math.PI) / 180
				this.size.wHeight = 2 * Math.tan(fovRad / 2) * this.camera.position.length()
				this.size.wWidth = this.size.wHeight * this.camera.aspect
			} else if (this.camera.isOrthographicCamera) {
				this.size.wHeight = this.camera.top - this.camera.bottom
				this.size.wWidth = this.camera.right - this.camera.left
			}
		}

		#updateRenderer() {
			this.renderer.setSize(this.size.width, this.size.height)
			let pr = window.devicePixelRatio
			if (this.maxPixelRatio && pr > this.maxPixelRatio) pr = this.maxPixelRatio
			else if (this.minPixelRatio && pr < this.minPixelRatio) pr = this.minPixelRatio
			this.renderer.setPixelRatio(pr)
			this.size.pixelRatio = pr
		}

		get fpsLimit() {
			return this.#fpsLimit
		}
		set fpsLimit(fps) {
			this.#fpsLimit = fps
			this.#minFrameTime = fps > 0 ? 1 / fps : 0
		}

		#start() {
			if (this.#isRunning) return
			this.#isRunning = true
			this.#clock.start()
			this.renderer.setAnimationLoop(() => {
				this.#time.elapsed = this.#clock.getElapsedTime()
				const dt = this.#time.elapsed - this.#lastFrameTime
				if (!this.#fpsLimit || dt > this.#minFrameTime) {
					this.#time.delta = dt
					this.onBeforeRender(this.#time)
					this.render()
					this.onAfterRender(this.#time)
					this.#lastFrameTime = this.#time.elapsed
				}
			})
		}

		#stop() {
			if (!this.#isRunning) return
			this.renderer.setAnimationLoop(null)
			this.#isRunning = false
			this.#clock.stop()
			this.#lastFrameTime = 0
		}

		#defaultRender() {
			this.renderer.render(this.scene, this.camera)
		}

		clear() {
			this.scene.traverse((obj) => {
				if (obj.isMesh && typeof obj.material === 'object') {
					Object.keys(obj.material).forEach((key) => {
						const v = obj.material[key]
						if (v !== null && typeof v === 'object' && typeof v.dispose === 'function') v.dispose()
					})
					obj.material.dispose()
					obj.geometry.dispose()
				}
			})
			this.scene.clear()
		}

		dispose() {
			console.log('dispose') // leftover debug log
			this.#removeListeners()
			this.#stop()
			this.clear()
			this.renderer.dispose()
			this.isDisposed = true
		}
	}

	/* ───────────────────── 2. GPU compute: the physics of the effect ───────────────────── */

	class ParticleCompute {
		constructor(renderer, params) {
			this.renderer = renderer
			this.params = params

			// Uniforms shared with the compute shader
			const timeDelta = uniform(0)
			const attractionIntensity = uniform(params.attractionIntensity)
			const maxVelocity = uniform(params.maxVelocity)
			const pointer = uniform(new Vector3()) // world-space cursor
			const click = uniform(0) // 1 for exactly one frame after a click
			this.uniforms = { timeDelta, attractionIntensity, maxVelocity, pointer, click }

			// ── Initial CPU-side data, then uploaded as GPU storage buffers ──

			// xyz = position (random direction, random radius 0-200), w = per-particle "mass"/scale 0.2-0.5
			const positions = (() => {
				const arr = new Float32Array(4 * params.count)
				const v = new Vector4()
				for (let i = 0; i < params.count; i++) {
					v.set(randFloat(0, 1), randFloat(0, 1), randFloat(0, 1), 0)
					v.subScalar(0.5).normalize().multiplyScalar(randFloat(0, 200)) // 4-D normalize, so xyz is slightly < radius
					v.w = randFloat(0.2, 0.5)
					v.toArray(arr, 4 * i)
				}
				return arr
			})()

			// xyz = velocity (starts at rest), w = random 0.1-0.7 (not read by the compute kernel)
			const velocities = (() => {
				const arr = new Float32Array(4 * params.count)
				const v = new Vector4()
				for (let i = 0; i < params.count; i++) {
					v.set(0, 0, 0, randFloat(0.1, 0.7))
					v.toArray(arr, 4 * i)
				}
				return arr
			})()

			// Euler rotation per particle: random in about ±π
			const rotations = new Float32Array(3 * params.count)
				.fill(0)
				.map(() => randFloatSpread(1) * Math.PI * 2)
			// Spin speed per axis (rad/s): 0 - 1.25
			const spinRates = new Float32Array(3 * params.count).fill(0).map(() => randFloat(0, 1.25))
			// Per-particle RGB: each channel 0.25 - 1
			const colors = new Float32Array(3 * params.count).fill(0).map(() => randFloat(0.25, 1))

			const positionBuffer = (this.positionBuffer = instancedArray(positions, 'vec4'))
			const velocityBuffer = (this.velocityBuffer = instancedArray(velocities, 'vec4'))
			const rotationBuffer = (this.rotationBuffer = instancedArray(rotations, 'vec3'))
			const spinRateBuffer = (this.deltaRotationBuffer = instancedArray(spinRates, 'vec3'))
			this.colorBuffer = instancedArray(colors, 'vec3')

			// clampLength(v, max) = v * min(max, |v|) / |v|     (NaN if |v| == 0 — see notes)
			const clampLength = Fn(([vec, maxLen]) => {
				const len = length(vec)
				return vec.mul(min(maxLen, len).div(len))
			})

			// The compute kernel — one invocation per particle
			this.computeParticles = Fn(() => {
				const pos = positionBuffer.element(instanceIndex)
				const vel = velocityBuffer.element(instanceIndex)

				If(click.greaterThan(0), () => {
					// CLICK: radial shockwave. Push particles within ~50 units away from the pointer.
					const away = pos.xyz.sub(pointer)
					const dist = length(away)
					const strength = smoothstep(50, 0, dist).mul(50) // 50 at the pointer → 0 at distance 50
					vel.xyz.addAssign(away.normalize().mul(strength))
				}).Else(() => {
					// NORMAL: accelerate toward the pointer, scaled by intensity, particle mass (pos.w), and dt
					const pull = pointer
						.sub(pos.xyz)
						.normalize()
						.mul(attractionIntensity)
						.mul(pos.w)
						.mul(timeDelta)
					vel.xyz.addAssign(pull)
				})

				vel.xyz.assign(clampLength(vel.xyz, maxVelocity)) // speed cap (per frame, not per second)
				pos.xyz.addAssign(vel.xyz) // integrate position (no drag/damping)

				// Tumble
				const rot = rotationBuffer.element(instanceIndex)
				const spin = spinRateBuffer.element(instanceIndex)
				rot.addAssign(spin.mul(timeDelta))
			})().compute(params.count)
		}

		async update(time) {
			this.uniforms.timeDelta.value = time.delta
			await this.renderer.computeAsync(this.computeParticles)
			this.uniforms.click.value = 0 // click impulse lasts exactly one compute pass
		}

		dispose() {
			this.positionBuffer.dispose()
			this.rotationBuffer.dispose()
			this.deltaRotationBuffer.dispose()
			this.velocityBuffer.dispose()
			this.colorBuffer.dispose()
		}
	}

	/* ───────────────── 3. The instanced mesh that draws the particles ───────────────── */

	const DEFAULT_PARTICLE_PARAMS = {
		count: 16384,
		size: 1,
		materialParams: { metalness: 0.75, roughness: 0.25 },
		attractionIntensity: 1,
		maxVelocity: 0.5
	}

	class AttractionParticles extends InstancedMesh {
		constructor(renderer, userParams) {
			const params = { ...DEFAULT_PARTICLE_PARAMS, ...userParams }
			const material = new MeshStandardNodeMaterial(params.materialParams)
			super(params.geometry, material, params.count)

			this.params = params
			this.frustumCulled = false // particles move on the GPU; CPU bounds would be wrong
			this.initLights()
			this.compute = new ParticleCompute(renderer, this.params)
			this.uniforms = { ...this.compute.uniforms, size: uniform(this.params.size) }

			this.material.size = this.uniforms.size
			this.material.colorNode = this.compute.colorBuffer.toAttribute()

			const positionAttr = this.compute.positionBuffer.toAttribute()
			const rotationAttr = this.compute.rotationBuffer.toAttribute()

			// Vertex shader: rotate → scale by (w * size) → translate to particle position
			this.material.positionNode = Fn(() => {
				const p = rotate(attribute('position'), rotationAttr)
				p.mulAssign(positionAttr.w.mul(this.material.size)).addAssign(positionAttr)
				normalLocal.assign(rotate(normalLocal, rotationAttr)) // keep lighting correct
				return p
			})()
		}

		async update(time) {
			await this.compute.update(time)
		}

		initLights() {
			// Warm (orange) light from lower-left, cool (blue) light from upper-right
			const warm = (this.light1 = new DirectionalLight(0xff9060, 5))
			warm.position.set(-50, -50, 0)
			warm.target.position.set(0, 0, 0)
			this.add(warm)
			this.add(warm.target)

			const cool = (this.light2 = new DirectionalLight(0x6090ff, 5))
			cool.position.set(50, 50, 0)
			cool.target.position.set(0, 0, 0)
			this.add(cool)
			this.add(cool.target)
		}

		dispose() {
			this.compute.dispose()
			this.geometry.dispose()
			this.material.dispose()
		}
	}

	/* ────────────────────────── 4. Pointer tracking helper ────────────────────────── */

	const trackedElements = new Map() // element → tracker state
	const lastPointer = new Vector2() // last clientX/clientY seen
	let listenersAttached = false

	function trackPointer(options) {
		const tracker = {
			position: new Vector2(), // px, relative to element
			nPosition: new Vector2(), // normalized device coords (-1..1, y up)
			hover: false,
			pressed: false,
			onEnter() {},
			onLeave() {},
			onMove() {},
			onDown() {},
			onUp() {},
			onClick() {},
			...options
		}

		if (!trackedElements.has(options.domElement)) {
			trackedElements.set(options.domElement, tracker)
			if (!listenersAttached) {
				// Listens on <body>, so the canvas can sit *behind* page content and still get events.
				document.body.addEventListener('pointermove', onPointerMove)
				document.body.addEventListener('pointerleave', onPointerLeave)
				document.body.addEventListener('pointerdown', onPointerDown)
				document.body.addEventListener('pointerup', onPointerUp)
				document.body.addEventListener('click', onPointerClick)
				listenersAttached = true
			}
		}

		tracker.dispose = () => {
			trackedElements.delete(options.domElement)
			if (trackedElements.size === 0) {
				document.body.removeEventListener('pointermove', onPointerMove)
				document.body.removeEventListener('pointerleave', onPointerLeave)
				document.body.removeEventListener('pointerdown', onPointerDown)
				document.body.removeEventListener('pointerup', onPointerUp)
				document.body.removeEventListener('click', onPointerClick)
				listenersAttached = false
			}
		}
		return tracker
	}

	function forEachTracked(event, fn) {
		lastPointer.x = event.clientX
		lastPointer.y = event.clientY
		for (const [el, tracker] of trackedElements) fn(tracker, el.getBoundingClientRect())
	}

	function onPointerMove(e) {
		forEachTracked(e, (t, rect) => {
			if (isInside(rect)) {
				updatePositions(t, rect)
				if (!t.hover) {
					t.hover = true
					t.onEnter(t)
				}
				t.pressed = e.buttons > 0
				t.onMove(t)
			} else if (t.hover) {
				t.hover = false
				t.pressed = false
				t.onLeave(t)
			}
		})
	}
	function onPointerLeave() {
		for (const t of trackedElements.values())
			if (t.hover) {
				t.hover = false
				t.onLeave(t)
			}
	}
	function onPointerDown(e) {
		forEachTracked(e, (t, r) => {
			if (isInside(r)) {
				updatePositions(t, r)
				t.onDown(t)
			}
		})
	}
	function onPointerUp(e) {
		forEachTracked(e, (t, r) => {
			if (isInside(r)) {
				updatePositions(t, r)
				t.onUp(t)
			}
		})
	}
	function onPointerClick(e) {
		forEachTracked(e, (t, r) => {
			if (isInside(r)) {
				updatePositions(t, r)
				t.onClick(t)
			}
		})
	}

	function updatePositions(t, rect) {
		t.position.x = lastPointer.x - rect.left
		t.position.y = lastPointer.y - rect.top
		t.nPosition.x = (t.position.x / rect.width) * 2 - 1
		t.nPosition.y = (-t.position.y / rect.height) * 2 + 1
	}

	function isInside(rect) {
		const { x, y } = lastPointer
		return (
			x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height
		)
	}

	/* ───────────────────────── 5. Public entry point (default export) ───────────────────────── */

	function buildGeometry(type) {
		console.log(type) // leftover debug log
		switch (type) {
			case 'box':
				return new BoxGeometry()
			case 'octahedron':
				return new OctahedronGeometry(1, 0)
			case 'sphere':
				return new SphereGeometry(1, 6, 4) // deliberately low-poly
			case 'circle':
				return new CircleGeometry(1, 12)
			default:
				return new PlaneGeometry()
		}
	}

	function createParticles(renderer, params) {
		const geometry = buildGeometry(params.type || 'box')
		const mesh = new AttractionParticles(renderer, { ...params, geometry })
		// Solid shapes: front faces only (0). Flat shapes (circle/plane): double-sided (2).
		mesh.material.side = ['box', 'octahedron', 'sphere'].includes(params.type) ? 0 : 2
		mesh.material.flatShading = params.type === 'sphere'
		return mesh
	}

	function createDataViz(canvas, options = {}) {
		const three = new DataViz({
			canvas,
			size: 'parent', // track the canvas's parent element's size
			rendererOptions: { alpha: true } // transparent background
		})
		three.camera.position.z = 120
		three.cameraMaxAspect = 1.5
		three.resize()

		// Post-processing: scene + bloom (strength 0.5, radius 0, threshold 0) added on top.
		const post = new PostProcessing(three.renderer)
		const scenePass = pass(three.scene, three.camera)
		scenePass.setMRT(mrt({ output }))
		const sceneColor = scenePass.getTextureNode()
		const bloomPass = nodeObject(new BloomNode(nodeObject(sceneColor), 0.5, 0, 0))
		post.outputNode = sceneColor.add(bloomPass)
		three.render = post.render.bind(post)

		const particles = createParticles(three.renderer, options.particles || {})
		three.scene.add(particles)

		// Convert the 2-D mouse position to a 3-D point on the plane through the origin
		// that faces the camera — this is what the particles are attracted to.
		const raycaster = new Raycaster()
		const plane = new Plane(new Vector3(0, 0, 1), 0)
		const hit = new Vector3()
		let targetTiltX = 0,
			targetTiltY = 0

		const pointer = trackPointer({
			domElement: canvas,
			onMove() {
				raycaster.setFromCamera(pointer.nPosition, three.camera)
				three.camera.getWorldDirection(plane.normal)
				raycaster.ray.intersectPlane(plane, hit)
				particles.compute.uniforms.pointer.value.copy(hit)
				targetTiltX = 0.75 * pointer.nPosition.y // whole cloud tilts toward the cursor
				targetTiltY = -0.75 * pointer.nPosition.x
			},
			onLeave() {
				particles.compute.uniforms.pointer.value.set(0, 0, 0) // attractor snaps back to centre
				targetTiltX = 0
				targetTiltY = 0
			},
			onClick() {
				particles.compute.uniforms.click.value = 1 // triggers the repulsion burst
			}
		})

		three.onBeforeRender = function (time) {
			particles.update(time) // async GPU compute (not awaited)
			particles.rotation.x += 0.01 * (targetTiltX - particles.rotation.x) // eased tilt
			particles.rotation.y += 0.01 * (targetTiltY - particles.rotation.y)
		}

		return {
			three,
			bloomPass,
			particles,
			dispose() {
				pointer.dispose()
				particles.dispose()
				three.dispose()
			}
		}
	}
	onMount(() => {
		const dataViz = createDataViz(document.getElementById('canvas'), {
			particles: {
				type: 'octahedron', // box | octahedron | sphere | circle | (plane)
				count: 16384,
				size: 1,
				attractionIntensity: 1,
				maxVelocity: 0.5
			}
		})
	})
</script>

<div id="app">
	<canvas id="canvas"></canvas>
	<!-- <a target="_blank" href="https://www.framer.com/@kevin-levron/">Framer Component</a>
  <div class="buttons">
    <button type="button" id="colors-btn">
      Random colors
    </button>
    <a href="https://www.framer.com/@kevin-levron/" target="_blank">
      Framer Component
    </a>
  </div> -->
</div>

<style>
	body,
	html,
	#app {
		margin: 0;
		width: 100%;
		height: 100%;
	}

	body {
		touch-action: none;
	}

	#app {
		height: 100%;
		font-family: 'Montserrat', serif;
	}

	#canvas {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
		overflow: hidden;
	}

	.buttons {
		position: fixed;
		width: 100%;
		bottom: 15px;
		z-index: 2;

		display: flex;
		justify-content: center;
		align-items: center;
		gap: 15px;
	}

	button,
	a {
		color: black;
		font-family: 'Montserrat', serif;
		font-size: 12px;
		text-decoration: none;
		background: rgba(255, 255, 255, 0.5);
		border-radius: 5px;
		border: 1px solid grey;
		padding: 4px 8px;
	}
</style>
