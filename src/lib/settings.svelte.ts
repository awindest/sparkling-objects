export type ShapeType = 'octahedron' | 'box' | 'sphere' | 'circle' | 'plane'

export const shapes: { label: string; type: ShapeType }[] = [
	{ label: 'Octahedrons', type: 'octahedron' },
	{ label: 'Boxes', type: 'box' },
	{ label: 'Spheres', type: 'sphere' },
	{ label: 'Circles', type: 'circle' },
	{ label: 'Planes', type: 'plane' }
]

export const settings = $state({
	shape: 'octahedron' as ShapeType,
	lowerLeft: '#ff9060', // the warm light
	upperRight: '#6090ff' // the cool light
})

// Pleasant random pair: same saturation/lightness, hues 120–240° apart
export function randomizeColors() {
	const h = Math.random() * 360
	const offset = 120 + Math.random() * 120
	settings.lowerLeft = hslToHex(h, 85, 62)
	settings.upperRight = hslToHex((h + offset) % 360, 85, 62)
}

function hslToHex(h: number, s: number, l: number) {
	s /= 100
	l /= 100
	const k = (n: number) => (n + h / 30) % 12
	const a = s * Math.min(l, 1 - l)
	const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
	const hex = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0')
	return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}
