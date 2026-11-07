<script>
	import fly from './transitions.js'
	import ColorPicker, { ChromeVariant } from 'svelte-awesome-color-picker'
	let { open = $bindable() } = $props()
	let yes = $state(true)
	let hex = '#938346'

	let rgb = {
		r: 147,
		g: 131,
		b: 70,
		a: 1
	}

	let hsv = {
		h: 47,
		s: 52.307692307692314,
		v: 57.75,
		a: 1
	}
</script>

{#if open}
	<div class="drawer" transition:fly={{ x: '100%' }}>
		<div class="border-box">
			<fieldset style="border: 2px solid white; border-radius: 12px; padding: 15px;">
				<legend style="padding: 0 10px; font-weight: bold;">Object Shapes</legend>
				<div>
					<label>
						<input type="checkbox" checked={yes} />
						Octahedrons
					</label>
				</div>
				<div>
					<label>
						<input type="checkbox" checked={!yes} />
						Cubes
					</label>
				</div>
				<div>
					<label>
						<input type="checkbox" checked={!yes} />
						Spheres
					</label>
				</div>
				<div>
					<label>
						<input type="checkbox" checked={!yes} />
						Boxes
					</label>
				</div>
				<div>
					<label>
						<input type="checkbox" checked={!yes} />
						Circles
					</label>
				</div>
				<div>
					<label>
						<input type="checkbox" checked={!yes} />
						Planes
					</label>
				</div>
			</fieldset>
		</div>
		<div class="border-box">
			<fieldset style="border: 2px solid white; border-radius: 12px; padding: 15px;">
				<legend style="padding: 0 10px; font-weight: bold;">Colors</legend>
				<div class="dark">
					<ColorPicker
						bind:rgb
						bind:hsv
						bind:hex
						--input-size="40px"
						label="Upper left color"
						components={ChromeVariant}
						sliderDirection="horizontal"
					/>
				</div>
				<div class="dark">
					<ColorPicker
						bind:rgb
						bind:hsv
						bind:hex
						--input-size="40px"
						label="Upper right color"
						components={ChromeVariant}
						sliderDirection="horizontal"
					/>
				</div>
				<button>Random Colors</button>
			</fieldset>
		</div>
	</div>
{/if}

<style>
	.drawer {
		position: fixed;
		z-index: 10;
		top: 0;
		right: 0;
		padding: 25px;
		height: 100vh;
		width: 400px;
		border-left: 1px solid rgba(0, 0, 0, 0.1);
		box-shadow: -2px 0px 6px -1px rgba(0, 0, 0, 0.1);
		background: rgba(255, 255, 255, 0.25);
		backdrop-filter: blur(20px);
		overflow: auto;
	}
	div,
	button {
		font-size: 20px;
		color: #e1dbdb;
		font-family:
			Helvetica Neue,
			Helvetica,
			Arial,
			sans-serif;
	}
	button {
		padding: 5%;
		background: blue;
		border-radius: 8px;
		opacity: 0.6;
		transition: 0.3s;
	}
	button:hover {
		opacity: 1;
		cursor: pointer;
	}
	.border-box {
		padding: 10%;
	}

	.dark {
		--cp-bg-color: #333;
		--cp-border-color: white;
		--cp-text-color: white;
		--cp-input-color: #555;
		--cp-button-hover-color: #777;
	}
</style>
