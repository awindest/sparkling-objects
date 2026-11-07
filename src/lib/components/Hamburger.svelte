<!--                                  
╭━━╮╱╱╱╱╭╮╱╱╱╱╱╭╮╱╭╮╱╱╱╱╱╭╮            ━╮ ╭━
╰┫┣╯╱╱╱╱┃┃╱╱╱╱╭╯╰╮┃┃╱╱╱╱╱┃┃             | |
╱┃┃╭━╮╭━╯┣━━┳━┻╮╭╯┃┃╱╱╭━━┫╰━┳━━╮       ╱ o \
╱┃┃┃╭╮┫╭╮┃┃━┫━━┫┃╱┃┃╱╭┫╭╮┃╭╮┃━━┫      ╱_____\
╭┫┣┫┃┃┃╰╯┃┃━╋━━┃╰╮┃╰━╯┃╭╮┃╰╯┣━━┃     ╱    o  \  
╰━━┻╯╰┻━━┻━━┻━━┻━╯╰━━━┻╯╰┻━━┻━━╯    (__o______)  

Yet another science experiment from Indest Labs.

Recommend viewing in Visual Source Code.
-->

<script>
	import fly from './transitions.js'
	import ColorPicker, { ChromeVariant } from 'svelte-awesome-color-picker'
	import { settings, shapes, randomizeColors } from '#lib/settings.svelte'

	let { open = $bindable() } = $props()
</script>

<!-- create a button from three svg lines -->
<button class="hamburger" title="Open/close button" class:open onclick={() => (open = !open)}>
	<svg width="32" height="32">
		<line id="top" x1="2" y1="2" x2="30" y2="2" stroke-linecap="round" />
		<line id="middle" x1="2" y1="12" x2="30" y2="12" stroke-linecap="round" />
		<line id="bottom" x1="2" y1="22" x2="30" y2="22" stroke-linecap="round" />
	</svg>
</button>
{#if open}
	<div class="drawer" transition:fly={{ x: '100%' }}>
		<div class="border-box">
			<fieldset style="border: 2px solid white; border-radius: 12px; padding: 15px;">
				<legend style="padding: 0 10px; font-weight: bold;">Object Shapes</legend>
				{#each shapes as shape}
					<div>
						<label>
							<input type="radio" name="shape" value={shape.type} bind:group={settings.shape} />
							{shape.label}
						</label>
					</div>
				{/each}
			</fieldset>
		</div>
		<div class="border-box">
			<fieldset style="border: 2px solid white; border-radius: 12px; padding: 15px;">
				<legend style="padding: 0 10px; font-weight: bold;">Colors</legend>
				<div class="dark">
					<ColorPicker
						bind:hex={settings.lowerLeft}
						--input-size="40px"
						label="Lower left color"
						components={ChromeVariant}
						sliderDirection="horizontal"
					/>
				</div>
				<div class="dark">
					<ColorPicker
						bind:hex={settings.upperRight}
						--input-size="40px"
						label="Upper right color"
						components={ChromeVariant}
						sliderDirection="horizontal"
					/>
				</div>
				<div style="text-align: center">
					<button class="random-button" onclick={randomizeColors}>Random Colors</button>
				</div>
			</fieldset>
		</div>
	</div>
{/if}

<style>
	/* Hamburger Menu icon */

	.hamburger {
		position: fixed;
		top: 0;
		right: 0; /* 10%;*/
		display: inline-block;
		cursor: pointer;
		padding: 1em;
		outline-style: none;
		color: var(--color-sky-blue);
	}
	/* svg line:hover { */
	.hamburger:hover {
		color: #ffffff;
	}
	svg {
		min-height: 32px;
		transition: transform 0.3s ease-in-out;
	}

	svg line {
		stroke: currentColor;
		stroke-width: 3;
		stroke-linecap: 'round';
		transition: transform 0.3s ease-in-out;
	}

	button {
		z-index: 20;
		border: none;
		background-color: transparent;
	}

	.open svg {
		transform: scale(0.7);
	}

	.open #top {
		transform: translate(6px, 0px) rotate(45deg);
	}

	.open #middle {
		opacity: 0;
	}

	.open #bottom {
		transform: translate(-12px, 9px) rotate(-45deg);
	}

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
	div {
		font-size: 20px;
		color: #e1dbdb;
		font-family:
			Helvetica Neue,
			Helvetica,
			Arial,
			sans-serif;
	}
	.random-button {
		font-size: 20px;
		color: #e1dbdb;
		font-family:
			Helvetica Neue,
			Helvetica,
			Arial,
			sans-serif;
		padding: 5%;
		background: blue;
		border-radius: 8px;
		opacity: 0.6;
		transition: 0.3s;
	}
	.random-button:hover {
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
