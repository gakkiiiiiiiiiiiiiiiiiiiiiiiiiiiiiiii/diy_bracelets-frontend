import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const frontendRoot = resolve(__dirname, '..');
const sourcePath = resolve(repoRoot, 'resources/reference-crystal-assets/source/crystal-beads-reference.png');
const outputRoot = resolve(frontendRoot, 'static/materials/reference-crystals');

const TEXTURE_SIZE = 1024;
const PREVIEW_SIZE = 512;
const COMPONENT_MIN_SIZE = 90;
const COMPONENT_MAX_SIZE = 210;
const COMPONENT_MIN_AREA = 5200;

const MATERIALS = [
	['yellow-crystal', '黄水晶'],
	['golden-rutile', '金发晶'],
	['yellow-ase', '黄阿塞'],
	['yellow-tower', '黄塔晶'],
	['yellow-tiger-eye', '黄虎眼'],
	['red-garden-quartz', '红胶花'],
	['pink-crystal', '粉水晶'],
	['pink-phantom', '粉幽灵'],
	['pink-ase', '粉阿塞'],
	['rose-stone', '蔷薇石'],
	['strawberry-crystal', '草莓晶'],
	['rhodochrosite', '红纹石'],
	['starry-quartz', '满天星'],
	['layered-green-phantom', '绿幽灵千层'],
	['green-rutile', '绿发晶'],
	['prehnite', '葡萄石'],
	['peridot', '橄榄石'],
	['green-phantom', '绿幽灵'],
	['blue-moonstone', '蓝月光'],
	['aquamarine-ice', '海蓝宝冰种'],
	['devil-blue', '魔鬼蓝'],
	['kyanite', '蓝晶石'],
	['larimar', '海纹石'],
	['amazonite', '天河石'],
	['bolivian-amethyst', '玻利维亚紫'],
	['lavender-amethyst', '薰衣草紫'],
	['brazil-amethyst', '巴西紫'],
	['kunzite-purple', '紫锂辉'],
	['purple-phantom', '紫幽灵'],
	['uruguay-amethyst', '乌拉圭紫'],
];

const MATERIAL_PRESETS = {
	'yellow-tiger-eye': { opacity: 0.96, transmission: 0.28, roughness: 0.26, ior: 1.28, normalScale: 0.8 },
	rhodochrosite: { opacity: 0.96, transmission: 0.3, roughness: 0.3, normalScale: 0.65 },
	amazonite: { opacity: 0.96, transmission: 0.28, roughness: 0.28 },
	'golden-rutile': { opacity: 0.88, transmission: 0.72, normalScale: 0.72 },
	'green-rutile': { opacity: 0.88, transmission: 0.66, normalScale: 0.78 },
	larimar: { opacity: 0.88, transmission: 0.5, normalScale: 0.86 },
	'uruguay-amethyst': { opacity: 0.94, transmission: 0.34, normalScale: 0.7 },
};

function crc32(buf) {
	let crc = -1;
	for (let i = 0; i < buf.length; i += 1) {
		crc ^= buf[i];
		for (let bit = 0; bit < 8; bit += 1) {
			crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
		}
	}
	return (crc ^ -1) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
	const typeBuf = Buffer.from(type, 'ascii');
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	typeBuf.copy(out, 4);
	data.copy(out, 8);
	out.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 8 + data.length);
	return out;
}

function paeth(a, b, c) {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	if (pa <= pb && pa <= pc) return a;
	if (pb <= pc) return b;
	return c;
}

function decodePng(filePath) {
	const file = readFileSync(filePath);
	const signature = file.subarray(0, 8);
	if (!signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
		throw new Error(`Not a PNG file: ${filePath}`);
	}

	let offset = 8;
	let width = 0;
	let height = 0;
	let bitDepth = 0;
	let colorType = 0;
	const idat = [];

	while (offset < file.length) {
		const length = file.readUInt32BE(offset);
		const type = file.subarray(offset + 4, offset + 8).toString('ascii');
		const data = file.subarray(offset + 8, offset + 8 + length);
		offset += 12 + length;

		if (type === 'IHDR') {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			bitDepth = data[8];
			colorType = data[9];
		} else if (type === 'IDAT') {
			idat.push(data);
		} else if (type === 'IEND') {
			break;
		}
	}

	if (bitDepth !== 8 || ![0, 2, 6].includes(colorType)) {
		throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`);
	}

	const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
	const rowBytes = width * channels;
	const raw = inflateSync(Buffer.concat(idat));
	const rgba = new Uint8ClampedArray(width * height * 4);
	const previous = Buffer.alloc(rowBytes);
	const current = Buffer.alloc(rowBytes);
	let readOffset = 0;

	for (let y = 0; y < height; y += 1) {
		const filter = raw[readOffset];
		readOffset += 1;
		raw.copy(current, 0, readOffset, readOffset + rowBytes);
		readOffset += rowBytes;

		for (let x = 0; x < rowBytes; x += 1) {
			const left = x >= channels ? current[x - channels] : 0;
			const up = previous[x];
			const upLeft = x >= channels ? previous[x - channels] : 0;
			if (filter === 1) current[x] = (current[x] + left) & 255;
			else if (filter === 2) current[x] = (current[x] + up) & 255;
			else if (filter === 3) current[x] = (current[x] + Math.floor((left + up) / 2)) & 255;
			else if (filter === 4) current[x] = (current[x] + paeth(left, up, upLeft)) & 255;
			else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
		}

		for (let x = 0; x < width; x += 1) {
			const src = x * channels;
			const dst = (y * width + x) * 4;
			if (colorType === 0) {
				const v = current[src];
				rgba[dst] = v;
				rgba[dst + 1] = v;
				rgba[dst + 2] = v;
				rgba[dst + 3] = 255;
			} else {
				rgba[dst] = current[src];
				rgba[dst + 1] = current[src + 1];
				rgba[dst + 2] = current[src + 2];
				rgba[dst + 3] = colorType === 6 ? current[src + 3] : 255;
			}
		}
		current.copy(previous);
	}

	return { width, height, data: rgba };
}

function encodePng({ width, height, data }, colorType = 6) {
	const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
	const rowBytes = width * channels;
	const raw = Buffer.alloc((rowBytes + 1) * height);
	let offset = 0;

	for (let y = 0; y < height; y += 1) {
		raw[offset] = 0;
		offset += 1;
		for (let x = 0; x < width; x += 1) {
			const src = (y * width + x) * 4;
			if (colorType === 0) {
				raw[offset] = data[src];
				offset += 1;
			} else {
				raw[offset] = data[src];
				raw[offset + 1] = data[src + 1];
				raw[offset + 2] = data[src + 2];
				if (colorType === 6) raw[offset + 3] = data[src + 3];
				offset += channels;
			}
		}
	}

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = colorType;
	ihdr[10] = 0;
	ihdr[11] = 0;
	ihdr[12] = 0;

	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND'),
	]);
}

function clamp(value, low = 0, high = 255) {
	return Math.max(low, Math.min(high, Math.round(value)));
}

function luminanceAt(image, x, y) {
	const idx = (y * image.width + x) * 4;
	return image.data[idx] * 0.299 + image.data[idx + 1] * 0.587 + image.data[idx + 2] * 0.114;
}

function foregroundAt(image, x, y) {
	if (y < Math.floor(image.height * 0.12)) return false;
	const idx = (y * image.width + x) * 4;
	const r = image.data[idx];
	const g = image.data[idx + 1];
	const b = image.data[idx + 2];
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const lum = r * 0.299 + g * 0.587 + b * 0.114;
	const saturation = max - min;
	return lum > 42 || (lum > 26 && saturation > 18);
}

function detectBeads(image) {
	const visited = new Uint8Array(image.width * image.height);
	const components = [];
	const queueX = new Int32Array(image.width * image.height);
	const queueY = new Int32Array(image.width * image.height);

	for (let y = Math.floor(image.height * 0.12); y < image.height; y += 1) {
		for (let x = 0; x < image.width; x += 1) {
			const startIdx = y * image.width + x;
			if (visited[startIdx] || !foregroundAt(image, x, y)) continue;
			let head = 0;
			let tail = 0;
			let minX = x;
			let maxX = x;
			let minY = y;
			let maxY = y;
			let area = 0;
			let weightedX = 0;
			let weightedY = 0;

			visited[startIdx] = 1;
			queueX[tail] = x;
			queueY[tail] = y;
			tail += 1;

			while (head < tail) {
				const cx = queueX[head];
				const cy = queueY[head];
				head += 1;
				area += 1;
				const weight = Math.max(1, luminanceAt(image, cx, cy));
				weightedX += cx * weight;
				weightedY += cy * weight;
				if (cx < minX) minX = cx;
				if (cx > maxX) maxX = cx;
				if (cy < minY) minY = cy;
				if (cy > maxY) maxY = cy;

				for (let oy = -1; oy <= 1; oy += 1) {
					for (let ox = -1; ox <= 1; ox += 1) {
						if (ox === 0 && oy === 0) continue;
						const nx = cx + ox;
						const ny = cy + oy;
						if (nx < 0 || nx >= image.width || ny < 0 || ny >= image.height) continue;
						const ni = ny * image.width + nx;
						if (visited[ni] || !foregroundAt(image, nx, ny)) continue;
						visited[ni] = 1;
						queueX[tail] = nx;
						queueY[tail] = ny;
						tail += 1;
					}
				}
			}

			const width = maxX - minX + 1;
			const height = maxY - minY + 1;
			const aspect = width / height;
			if (
				area >= COMPONENT_MIN_AREA &&
				width >= COMPONENT_MIN_SIZE &&
				height >= COMPONENT_MIN_SIZE &&
				width <= COMPONENT_MAX_SIZE &&
				height <= COMPONENT_MAX_SIZE &&
				aspect >= 0.72 &&
				aspect <= 1.28
			) {
				components.push({
					x: minX,
					y: minY,
					width,
					height,
					area,
					cx: weightedX / Math.max(1, area * 120),
					cy: weightedY / Math.max(1, area * 120),
				});
			}
		}
	}

	const rows = [];
	for (const component of components.sort((a, b) => a.y - b.y || a.x - b.x)) {
		const row = rows.find((item) => Math.abs(item.cy - (component.y + component.height / 2)) < 34);
		if (row) {
			row.items.push(component);
			row.cy = row.items.reduce((sum, item) => sum + item.y + item.height / 2, 0) / row.items.length;
		} else {
			rows.push({ cy: component.y + component.height / 2, items: [component] });
		}
	}

	const beadComponents = rows
		.filter((row) => row.items.length >= 5)
		.sort((a, b) => a.cy - b.cy)
		.slice(0, 5)
		.flatMap((row) => row.items.sort((a, b) => a.x - b.x).slice(0, 6));

	if (beadComponents.length !== 30) {
		throw new Error(`Expected 30 bead components, found ${beadComponents.length}`);
	}

	return beadComponents.map((component) => {
		const side = Math.ceil(Math.max(component.width, component.height) * 1.01);
		const cx = component.x + component.width / 2;
		const cy = component.y + component.height / 2;
		return {
			x: Math.max(0, Math.round(cx - side / 2)),
			y: Math.max(0, Math.round(cy - side / 2)),
			side: Math.min(side, image.width, image.height),
			component,
		};
	});
}

function sample(image, x, y) {
	const clampedX = Math.max(0, Math.min(image.width - 1, x));
	const clampedY = Math.max(0, Math.min(image.height - 1, y));
	const x0 = Math.floor(clampedX);
	const y0 = Math.floor(clampedY);
	const x1 = Math.min(image.width - 1, x0 + 1);
	const y1 = Math.min(image.height - 1, y0 + 1);
	const tx = clampedX - x0;
	const ty = clampedY - y0;
	const out = [0, 0, 0, 0];
	for (let c = 0; c < 4; c += 1) {
		const a = image.data[(y0 * image.width + x0) * 4 + c];
		const b = image.data[(y0 * image.width + x1) * 4 + c];
		const d = image.data[(y1 * image.width + x0) * 4 + c];
		const e = image.data[(y1 * image.width + x1) * 4 + c];
		out[c] = a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + d * (1 - tx) * ty + e * tx * ty;
	}
	return out;
}

function cropResize(image, box, size) {
	const data = new Uint8ClampedArray(size * size * 4);
	const side = box.side;
	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			const srcX = box.x + ((x + 0.5) / size) * side;
			const srcY = box.y + ((y + 0.5) / size) * side;
			const rgba = sample(image, srcX, srcY);
			const idx = (y * size + x) * 4;
			data[idx] = rgba[0];
			data[idx + 1] = rgba[1];
			data[idx + 2] = rgba[2];
			data[idx + 3] = rgba[3];
		}
	}
	return { width: size, height: size, data };
}

function circularize(texture, keepBackground = false) {
	const { width, height, data } = texture;
	const cx = (width - 1) / 2;
	const cy = (height - 1) / 2;
	const radius = Math.min(width, height) * 0.47;
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const idx = (y * width + x) * 4;
			const distance = Math.hypot(x - cx, y - cy);
			const edge = Math.max(0, Math.min(1, (radius - distance) / 10));
			const nearBlack = texture.data[idx] + texture.data[idx + 1] + texture.data[idx + 2] < 18;
			if (keepBackground) {
				data[idx + 3] = clamp(255 * edge);
			} else if (edge <= 0 || (nearBlack && distance > radius * 0.78)) {
				data[idx] = 248;
				data[idx + 1] = 248;
				data[idx + 2] = 250;
				data[idx + 3] = 0;
			} else {
				data[idx + 3] = clamp(255 * edge);
			}
		}
	}
	return texture;
}

function makeBasecolor(crop) {
	const out = {
		width: crop.width,
		height: crop.height,
		data: new Uint8ClampedArray(crop.data),
	};
	for (let i = 0; i < out.data.length; i += 4) {
		const alpha = out.data[i + 3] / 255;
		if (alpha < 0.02) continue;
		out.data[i] = clamp(out.data[i] * 1.02 + 3);
		out.data[i + 1] = clamp(out.data[i + 1] * 1.02 + 3);
		out.data[i + 2] = clamp(out.data[i + 2] * 1.025 + 5);
		out.data[i + 3] = 255;
	}
	return out;
}

function makeRoughness(crop) {
	const out = { width: crop.width, height: crop.height, data: new Uint8ClampedArray(crop.width * crop.height * 4) };
	for (let y = 0; y < crop.height; y += 1) {
		for (let x = 0; x < crop.width; x += 1) {
			const idx = (y * crop.width + x) * 4;
			const r = crop.data[idx];
			const g = crop.data[idx + 1];
			const b = crop.data[idx + 2];
			const lum = r * 0.299 + g * 0.587 + b * 0.114;
			const dx = Math.abs(x - crop.width / 2) / (crop.width / 2);
			const dy = Math.abs(y - crop.height / 2) / (crop.height / 2);
			const edge = Math.min(1, Math.hypot(dx, dy));
			const value = clamp(38 + (255 - lum) * 0.18 + edge * 34, 28, 145);
			out.data[idx] = value;
			out.data[idx + 1] = value;
			out.data[idx + 2] = value;
			out.data[idx + 3] = 255;
		}
	}
	return out;
}

function makeAlpha(crop) {
	const out = { width: crop.width, height: crop.height, data: new Uint8ClampedArray(crop.width * crop.height * 4) };
	const cx = (crop.width - 1) / 2;
	const cy = (crop.height - 1) / 2;
	for (let y = 0; y < crop.height; y += 1) {
		for (let x = 0; x < crop.width; x += 1) {
			const idx = (y * crop.width + x) * 4;
			const distance = Math.min(1, Math.hypot(x - cx, y - cy) / (crop.width * 0.47));
			const edgeDensity = Math.pow(distance, 1.35);
			const lum = crop.data[idx] * 0.299 + crop.data[idx + 1] * 0.587 + crop.data[idx + 2] * 0.114;
			const value = clamp(176 + edgeDensity * 62 + lum * 0.04, 150, 250);
			out.data[idx] = value;
			out.data[idx + 1] = value;
			out.data[idx + 2] = value;
			out.data[idx + 3] = 255;
		}
	}
	return out;
}

function makeNormal(crop) {
	const out = { width: crop.width, height: crop.height, data: new Uint8ClampedArray(crop.width * crop.height * 4) };
	const height = new Float32Array(crop.width * crop.height);
	for (let y = 0; y < crop.height; y += 1) {
		for (let x = 0; x < crop.width; x += 1) {
			const idx = (y * crop.width + x) * 4;
			const lum = crop.data[idx] * 0.299 + crop.data[idx + 1] * 0.587 + crop.data[idx + 2] * 0.114;
			height[y * crop.width + x] = lum / 255;
		}
	}
	for (let y = 0; y < crop.height; y += 1) {
		const ym = Math.max(0, y - 1);
		const yp = Math.min(crop.height - 1, y + 1);
		for (let x = 0; x < crop.width; x += 1) {
			const xm = Math.max(0, x - 1);
			const xp = Math.min(crop.width - 1, x + 1);
			const dx = height[y * crop.width + xp] - height[y * crop.width + xm];
			const dy = height[yp * crop.width + x] - height[ym * crop.width + x];
			let nx = -dx * 2.7;
			let ny = -dy * 2.7;
			let nz = 1;
			const len = Math.hypot(nx, ny, nz) || 1;
			nx /= len;
			ny /= len;
			nz /= len;
			const idx = (y * crop.width + x) * 4;
			out.data[idx] = clamp((nx * 0.5 + 0.5) * 255);
			out.data[idx + 1] = clamp((ny * 0.5 + 0.5) * 255);
			out.data[idx + 2] = clamp((nz * 0.5 + 0.5) * 255);
			out.data[idx + 3] = 255;
		}
	}
	return out;
}

function averageTone(crop) {
	let r = 0;
	let g = 0;
	let b = 0;
	let count = 0;
	for (let i = 0; i < crop.data.length; i += 4) {
		if (crop.data[i + 3] < 16) continue;
		const lum = crop.data[i] * 0.299 + crop.data[i + 1] * 0.587 + crop.data[i + 2] * 0.114;
		if (lum < 20) continue;
		r += crop.data[i];
		g += crop.data[i + 1];
		b += crop.data[i + 2];
		count += 1;
	}
	return [r, g, b].map((v) => clamp(v / Math.max(1, count)));
}

function rgbToHex([r, g, b]) {
	return Number(`0x${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
}

function writeMaterialJson(slug, name, tone) {
	const preset = MATERIAL_PRESETS[slug] ?? {};
	const material = {
		slug,
		name,
		color: rgbToHex(tone),
		attenuationColor: rgbToHex(tone),
		attenuationDistance: 2.4,
		opacity: preset.opacity ?? 0.9,
		roughness: preset.roughness ?? 0.17,
		metalness: 0,
		transmission: preset.transmission ?? 0.72,
		thickness: preset.thickness ?? 0.85,
		clearcoat: preset.clearcoat ?? 0.95,
		clearcoatRoughness: preset.clearcoatRoughness ?? 0.1,
		reflectivity: 0.7,
		ior: preset.ior ?? 1.22,
		envMapIntensity: preset.envMapIntensity ?? 0.85,
		normalScale: preset.normalScale ?? 0.55,
	};
	return `${JSON.stringify(material, null, 2)}\n`;
}

function saveImage(path, image, colorType = 6) {
	writeFileSync(path, encodePng(image, colorType));
}

function main() {
	if (!existsSync(sourcePath)) {
		throw new Error(`Missing source image: ${sourcePath}`);
	}

	const source = decodePng(sourcePath);
	const boxes = detectBeads(source);
	mkdirSync(outputRoot, { recursive: true });

	MATERIALS.forEach(([slug, name], index) => {
		const dir = join(outputRoot, slug);
		mkdirSync(dir, { recursive: true });
		const crop = circularize(cropResize(source, boxes[index], TEXTURE_SIZE));
		const preview = circularize(cropResize(source, boxes[index], PREVIEW_SIZE));
		const basecolor = makeBasecolor(crop);
		const roughness = makeRoughness(crop);
		const normal = makeNormal(crop);
		const alpha = makeAlpha(crop);
		const tone = averageTone(crop);

		saveImage(join(dir, `${slug}-basecolor.png`), basecolor, 2);
		saveImage(join(dir, `${slug}-roughness.png`), roughness, 0);
		saveImage(join(dir, `${slug}-normal.png`), normal, 2);
		saveImage(join(dir, `${slug}-alpha.png`), alpha, 0);
		saveImage(join(dir, `${slug}-preview.png`), preview, 6);
		const legacyMaterialPath = join(dir, `${slug}-material.json`);
		if (existsSync(legacyMaterialPath)) unlinkSync(legacyMaterialPath);
		writeFileSync(join(dir, 'material.json'), writeMaterialJson(slug, name, tone));
	});

	console.log(`Generated ${MATERIALS.length} crystal material packs in ${outputRoot}`);
}

main();
