<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core'
	import { onDestroy } from 'svelte'
	import {
		InstancedMesh,
		MeshStandardNodeMaterial,
		BoxGeometry,
		OctahedronGeometry,
		SphereGeometry,
		CircleGeometry,
		PlaneGeometry,
		FrontSide,
		DoubleSide,
		Raycaster,
		Plane,
		Vector2,
		Vector3,
		Vector4,
		MathUtils
	} from 'three/webgpu'
	import {
		uniform,
		instancedArray,
		Fn,
		If,
		length,
		min,
		max,
		smoothstep,
		instanceIndex,
		rotate,
		attribute,
		normalLocal
	} from 'three/tsl'

	const { randFloatSpread, randFloat } = MathUtils

	// Init-only config (was the options object passed to createDataViz).
	const config = {
		type: 'octahedron' as 'box' | 'octahedron' | 'sphere' | 'circle' | 'plane',
		count: 16384,
		size: 1,
		attractionIntensity: 1,
		maxVelocity: 0.5,
		metalness: 0.75,
		roughness: 0.25
	}

	const { renderer, camera, dom } = useThrelte()

	/* ───────────── Uniforms shared with the compute kernel ───────────── */
	const timeDelta = uniform(0)
	const attractionIntensity = uniform(config.attractionIntensity)
	const maxVelocity = uniform(config.maxVelocity)
	const pointer = uniform(new Vector3()) // world-space cursor on the z=0 plane
	const click = uniform(0) // 1 until the next compute pass finishes
	const sizeUniform = uniform(config.size)

	/* ───────────── Initial data → GPU storage buffers ───────────── */
	const { count } = config

	const positions = new Float32Array(4 * count)
	const velocities = new Float32Array(4 * count)
	{
		const v = new Vector4()
		for (let i = 0; i < count; i++) {
			// random direction, random radius 0-200; w = per-particle scale 0.2-0.5
			v.set(randFloat(0, 1), randFloat(0, 1), randFloat(0, 1), 0)
			v.subScalar(0.5).normalize().multiplyScalar(randFloat(0, 200))
			v.w = randFloat(0.2, 0.5)
			v.toArray(positions, 4 * i)

			v.set(0, 0, 0, randFloat(0.1, 0.7)) // at rest; w unused by the kernel
			v.toArray(velocities, 4 * i)
		}
	}
	const rotations = new Float32Array(3 * count).map(() => randFloatSpread(1) * Math.PI * 2)
	const spinRates = new Float32Array(3 * count).map(() => randFloat(0, 1.25))
	const colors = new Float32Array(3 * count).map(() => randFloat(0.25, 1))

	const positionBuffer = instancedArray(positions, 'vec4')
	const velocityBuffer = instancedArray(velocities, 'vec4')
	const rotationBuffer = instancedArray(rotations, 'vec3')
	const spinRateBuffer = instancedArray(spinRates, 'vec3')
	const colorBuffer = instancedArray(colors, 'vec3')

	/* ───────────── Compute kernel (one invocation per particle) ───────────── */
	const EPS = 1e-6

	// Guarded versions: the originals produced NaN when the length was exactly 0.
	const safeNormalize = Fn(([v]: any[]) => v.div(max(length(v), EPS)))
	const clampLength = Fn(([vec, maxLen]: any[]) => {
		const len = max(length(vec), EPS)
		return vec.mul(min(maxLen, len).div(len))
	})

	const computeParticles = Fn(() => {
		const pos = positionBuffer.element(instanceIndex)
		const vel = velocityBuffer.element(instanceIndex)

		If(click.greaterThan(0), () => {
			// CLICK: radial shockwave pushing particles within ~50 units away
			const away = pos.xyz.sub(pointer)
			const strength = smoothstep(50, 0, length(away)).mul(50)
			vel.xyz.addAssign(safeNormalize(away).mul(strength))
		}).Else(() => {
			// NORMAL: accelerate toward the pointer, scaled by intensity, mass (pos.w) and dt
			const pull = safeNormalize(pointer.sub(pos.xyz))
				.mul(attractionIntensity)
				.mul(pos.w)
				.mul(timeDelta)
			vel.xyz.addAssign(pull)
		})

		vel.xyz.assign(clampLength(vel.xyz, maxVelocity)) // per-frame speed cap
		pos.xyz.addAssign(vel.xyz)

		const rot = rotationBuffer.element(instanceIndex)
		const spin = spinRateBuffer.element(instanceIndex)
		rot.addAssign(spin.mul(timeDelta))
	})().compute(count)

	/* ───────────── Geometry, material, instanced mesh ───────────── */
	function buildGeometry(type: typeof config.type) {
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

	const geometry = buildGeometry(config.type)
	const material = new MeshStandardNodeMaterial({
		metalness: config.metalness,
		roughness: config.roughness
	})
	// Solid shapes: front faces only. Flat shapes (circle/plane): double-sided.
	material.side = ['box', 'octahedron', 'sphere'].includes(config.type) ? FrontSide : DoubleSide
	material.flatShading = config.type === 'sphere'
	material.colorNode = colorBuffer.toAttribute()

	const positionAttr = positionBuffer.toAttribute()
	const rotationAttr = rotationBuffer.toAttribute()
	// rotate → scale by (w * size) → translate to the particle's position
	material.positionNode = Fn(() => {
		const p = rotate(attribute('position'), rotationAttr)
		p.mulAssign(positionAttr.w.mul(sizeUniform)).addAssign(positionAttr)
		normalLocal.assign(rotate(normalLocal, rotationAttr)) // keep lighting correct
		return p
	})()

	const mesh = new InstancedMesh(geometry, material, count)
	mesh.frustumCulled = false // particles move on the GPU; CPU bounds would be wrong

	/* ───────────── Pointer → point on the z=0 plane ─────────────
	 * One AbortController removes every listener on teardown, so no bound-function
	 * identity problem like the original #removeListeners had. */
	const raycaster = new Raycaster()
	const plane = new Plane(new Vector3(0, 0, 1), 0)
	const ndc = new Vector2()
	const hit = new Vector3()

	const camDir = new Vector3()
	const origin = new Vector3()

	function updatePointer(e: PointerEvent) {
		const cam = camera.current
		if (!cam) return
		// plane through the origin, facing the camera
		cam.getWorldDirection(camDir)
		plane.setFromNormalAndCoplanarPoint(camDir, origin)

		const rect = dom.getBoundingClientRect()
		ndc.set(
			((e.clientX - rect.left) / rect.width) * 2 - 1,
			-((e.clientY - rect.top) / rect.height) * 2 + 1
		)
		raycaster.setFromCamera(ndc, cam)
		if (raycaster.ray.intersectPlane(plane, hit)) pointer.value.copy(hit)
	}

	$effect(() => {
		const ac = new AbortController()
		const { signal } = ac
		dom.addEventListener('pointermove', updatePointer, { signal })
		dom.addEventListener(
			'pointerdown',
			(e) => {
				updatePointer(e)
				click.value = 1
			},
			{ signal }
		)
		return () => ac.abort()
	})

	/* ───────────── Per-frame update ───────────── */
	let computing = false

	useTask((delta) => {
		// Skip if the previous GPU pass hasn't finished, so passes never pile up.
		if (computing) return
		computing = true
		timeDelta.value = delta
		renderer
			.computeAsync(computeParticles)
			.then(() => {
				click.value = 0 // the click impulse lasts exactly one compute pass
			})
			.catch((err: unknown) => console.error('particle compute failed', err))
			.finally(() => {
				computing = false
			})
	})

	/* ───────────── Teardown ───────────── */
	onDestroy(() => {
		positionBuffer.dispose()
		velocityBuffer.dispose()
		rotationBuffer.dispose()
		spinRateBuffer.dispose()
		colorBuffer.dispose()
		computeParticles.dispose()
		mesh.dispose()
		geometry.dispose()
		material.dispose()
	})
</script>

<!-- dispose={false}: we created these objects, so we dispose them ourselves above -->
<T is={mesh} dispose={false}>
	<!-- Warm light from lower-left, cool light from upper-right -->
	<T.DirectionalLight color="#ff9060" intensity={5} position={[-50, -50, 0]} />
	<T.DirectionalLight color="#6090ff" intensity={5} position={[50, 50, 0]} />
</T>
