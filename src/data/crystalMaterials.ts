import type { Material, MaterialCategory, MaterialSpec } from '@/types';

export interface CrystalMaterialMaps {
	map: string;
	roughnessMap: string;
	normalMap: string;
	alphaMap: string;
	preview: string;
}

export interface CrystalPhysicalMaterialConfig {
	color: number;
	attenuationColor: number;
	attenuationDistance: number;
	opacity: number;
	roughness: number;
	metalness: number;
	transmission: number;
	thickness: number;
	clearcoat: number;
	clearcoatRoughness: number;
	reflectivity: number;
	ior: number;
	envMapIntensity: number;
	normalScale: number;
}

export interface ReferenceCrystalMaterial extends Material {
	slug: string;
	maps: CrystalMaterialMaps;
	renderMaterial: CrystalPhysicalMaterialConfig;
}

interface CrystalDefinition {
	slug: string;
	name: string;
	categoryId: string;
	tone: number;
	priceTier: number;
	opacity?: number;
	transmission?: number;
	thickness?: number;
	roughness?: number;
	ior?: number;
	clearcoat?: number;
	clearcoatRoughness?: number;
	normalScale?: number;
	envMapIntensity?: number;
}

const ROOT = '/static/materials/reference-crystals';

const specsByTier: Record<number, MaterialSpec[]> = {
	1: [{ size: 6, price: 3 }, { size: 8, price: 5 }, { size: 10, price: 10 }, { size: 12, price: 15 }],
	2: [{ size: 6, price: 4 }, { size: 8, price: 7 }, { size: 10, price: 12 }, { size: 12, price: 18 }],
	3: [{ size: 6, price: 6 }, { size: 8, price: 10 }, { size: 10, price: 18 }, { size: 12, price: 28 }],
	4: [{ size: 6, price: 8 }, { size: 8, price: 14 }, { size: 10, price: 26 }, { size: 12, price: 38 }],
};

export const referenceCrystalCategories: MaterialCategory[] = [
	{ id: 'in-use', name: '正在使用' },
	{ id: 'yellow-series', name: '黄色系' },
	{ id: 'pink-series', name: '粉红系' },
	{ id: 'green-white-series', name: '绿白系' },
	{ id: 'blue-series', name: '蓝色系' },
	{ id: 'purple-series', name: '紫色系' },
];

export const referenceCategorySearchAliases: Record<string, string[]> = {
	'yellow-series': ['黄色系', '黄水晶', '茶水晶', '金发晶', '黄晶', '黄虎眼', '黄塔晶'],
	'pink-series': ['粉红系', '粉水晶', '粉晶', '草莓晶', '蔷薇石', '红纹石', '红胶花'],
	'green-white-series': ['绿白系', '白水晶', '绿水晶', '绿幽灵', '绿发晶', '葡萄石', '满天星'],
	'blue-series': ['蓝色系', '蓝水晶', '海蓝宝', '蓝月光', '蓝晶石', '天河石', '海纹石'],
	'purple-series': ['紫色系', '紫水晶', '紫晶', '乌拉圭紫', '巴西紫', '薰衣草紫', '紫幽灵'],
};

export const referenceMaterialSearchAliases: Record<string, string[]> = {
	'source-clear-quartz': ['白水晶', '净体', '净白', '透明白水晶'],
	'source-milky-quartz': ['白水晶', '奶白', '奶白晶', '乳白晶'],
	'source-uruguay-amethyst': ['紫水晶', '乌拉圭紫', '乌拉圭紫晶'],
	'source-brazil-amethyst': ['紫水晶', '巴西紫', '巴西紫晶'],
	'source-brazil-citrine': ['黄水晶', '巴西黄晶', '巴西黄水晶'],
	'source-lemon-citrine': ['黄水晶', '柠檬黄', '透体柠檬黄水晶'],
	'source-yellow-tower': ['黄水晶', '黄塔晶', '黄塔'],
	'source-starlight-rose-quartz': ['粉水晶', '星光粉晶', '粉晶'],
	'source-purple-rose-quartz': ['粉水晶', '紫粉晶', '粉晶'],
	'ref-starry-quartz': ['白水晶', '净白', '星光白水晶'],
	'ref-blue-moonstone': ['白水晶', '奶白晶', '月光石'],
	'ref-bolivian-amethyst': ['紫水晶', '紫晶'],
	'ref-lavender-amethyst': ['紫水晶', '紫晶'],
	'ref-brazil-amethyst': ['紫水晶', '紫晶'],
	'ref-uruguay-amethyst': ['紫水晶', '紫晶'],
	'ref-yellow-tower': ['茶水晶', '烟晶', '黄茶晶'],
	'ref-yellow-crystal': ['黄晶'],
	'ref-aquamarine-ice': ['海蓝宝', '蓝水晶'],
	'ref-devil-blue': ['蓝水晶', '深蓝晶'],
	'ref-green-phantom': ['绿水晶'],
};

const definitions: CrystalDefinition[] = [
	{ slug: 'yellow-crystal', name: '黄水晶', categoryId: 'yellow-series', tone: 0xd7bd75, priceTier: 2, opacity: 0.86, transmission: 0.78 },
	{ slug: 'golden-rutile', name: '金发晶', categoryId: 'yellow-series', tone: 0xe4c264, priceTier: 4, opacity: 0.88, transmission: 0.72, normalScale: 0.72 },
	{ slug: 'yellow-ase', name: '黄阿塞', categoryId: 'yellow-series', tone: 0xe0c367, priceTier: 3, opacity: 0.88, transmission: 0.76 },
	{ slug: 'yellow-tower', name: '黄塔晶', categoryId: 'yellow-series', tone: 0x9c7a54, priceTier: 3, opacity: 0.9, transmission: 0.68, normalScale: 0.68 },
	{ slug: 'yellow-tiger-eye', name: '黄虎眼', categoryId: 'yellow-series', tone: 0xb07028, priceTier: 3, opacity: 0.96, transmission: 0.28, roughness: 0.26, ior: 1.28, normalScale: 0.8 },
	{ slug: 'red-garden-quartz', name: '红胶花', categoryId: 'yellow-series', tone: 0xd56247, priceTier: 3, opacity: 0.91, transmission: 0.48, normalScale: 0.7 },
	{ slug: 'pink-crystal', name: '粉水晶', categoryId: 'pink-series', tone: 0xd8c4d2, priceTier: 1, opacity: 0.84, transmission: 0.72 },
	{ slug: 'pink-phantom', name: '粉幽灵', categoryId: 'pink-series', tone: 0xe6d0cc, priceTier: 2, opacity: 0.86, transmission: 0.68 },
	{ slug: 'pink-ase', name: '粉阿塞', categoryId: 'pink-series', tone: 0xe2c5d2, priceTier: 2, opacity: 0.86, transmission: 0.7 },
	{ slug: 'rose-stone', name: '蔷薇石', categoryId: 'pink-series', tone: 0xcf5677, priceTier: 2, opacity: 0.9, transmission: 0.52, normalScale: 0.7 },
	{ slug: 'strawberry-crystal', name: '草莓晶', categoryId: 'pink-series', tone: 0x9e536b, priceTier: 3, opacity: 0.92, transmission: 0.42, normalScale: 0.78 },
	{ slug: 'rhodochrosite', name: '红纹石', categoryId: 'pink-series', tone: 0xd66e68, priceTier: 2, opacity: 0.96, transmission: 0.3, roughness: 0.3, normalScale: 0.65 },
	{ slug: 'starry-quartz', name: '满天星', categoryId: 'green-white-series', tone: 0xdde0da, priceTier: 1, opacity: 0.88, transmission: 0.64, normalScale: 0.82 },
	{ slug: 'layered-green-phantom', name: '绿幽灵千层', categoryId: 'green-white-series', tone: 0x81907d, priceTier: 3, opacity: 0.9, transmission: 0.48, normalScale: 0.9 },
	{ slug: 'green-rutile', name: '绿发晶', categoryId: 'green-white-series', tone: 0xa9b491, priceTier: 4, opacity: 0.88, transmission: 0.66, normalScale: 0.78 },
	{ slug: 'prehnite', name: '葡萄石', categoryId: 'green-white-series', tone: 0xb9d7b7, priceTier: 2, opacity: 0.86, transmission: 0.7 },
	{ slug: 'peridot', name: '橄榄石', categoryId: 'green-white-series', tone: 0xb1bc21, priceTier: 3, opacity: 0.9, transmission: 0.7, roughness: 0.14 },
	{ slug: 'green-phantom', name: '绿幽灵', categoryId: 'green-white-series', tone: 0x578072, priceTier: 3, opacity: 0.9, transmission: 0.55, normalScale: 0.78 },
	{ slug: 'blue-moonstone', name: '蓝月光', categoryId: 'blue-series', tone: 0xccd7e5, priceTier: 2, opacity: 0.84, transmission: 0.74 },
	{ slug: 'aquamarine-ice', name: '海蓝宝冰种', categoryId: 'blue-series', tone: 0xadc9e2, priceTier: 3, opacity: 0.84, transmission: 0.78 },
	{ slug: 'devil-blue', name: '魔鬼蓝', categoryId: 'blue-series', tone: 0x2468ad, priceTier: 3, opacity: 0.92, transmission: 0.44, normalScale: 0.64 },
	{ slug: 'kyanite', name: '蓝晶石', categoryId: 'blue-series', tone: 0x627aad, priceTier: 3, opacity: 0.9, transmission: 0.42, normalScale: 0.78 },
	{ slug: 'larimar', name: '海纹石', categoryId: 'blue-series', tone: 0x6dc8de, priceTier: 4, opacity: 0.88, transmission: 0.5, normalScale: 0.86 },
	{ slug: 'amazonite', name: '天河石', categoryId: 'blue-series', tone: 0x39c0c5, priceTier: 2, opacity: 0.96, transmission: 0.28, roughness: 0.28 },
	{ slug: 'bolivian-amethyst', name: '玻利维亚紫', categoryId: 'purple-series', tone: 0x9d91b2, priceTier: 2, opacity: 0.86, transmission: 0.72 },
	{ slug: 'lavender-amethyst', name: '薰衣草紫', categoryId: 'purple-series', tone: 0xb29ad4, priceTier: 2, opacity: 0.88, transmission: 0.66 },
	{ slug: 'brazil-amethyst', name: '巴西紫', categoryId: 'purple-series', tone: 0xa061b2, priceTier: 3, opacity: 0.9, transmission: 0.55 },
	{ slug: 'kunzite-purple', name: '紫锂辉', categoryId: 'purple-series', tone: 0xdebdd2, priceTier: 3, opacity: 0.86, transmission: 0.7 },
	{ slug: 'purple-phantom', name: '紫幽灵', categoryId: 'purple-series', tone: 0x806477, priceTier: 3, opacity: 0.9, transmission: 0.48, normalScale: 0.8 },
	{ slug: 'uruguay-amethyst', name: '乌拉圭紫', categoryId: 'purple-series', tone: 0x4a1d67, priceTier: 4, opacity: 0.94, transmission: 0.34, normalScale: 0.7 },
];

function mapsFor(slug: string): CrystalMaterialMaps {
	const root = `${ROOT}/${slug}`;
	return {
		map: `${root}/${slug}-basecolor.png`,
		roughnessMap: `${root}/${slug}-roughness.png`,
		normalMap: `${root}/${slug}-normal.png`,
		alphaMap: `${root}/${slug}-alpha.png`,
		preview: `${root}/${slug}-preview.png`,
	};
}

function materialFor(definition: CrystalDefinition): CrystalPhysicalMaterialConfig {
	return {
		color: definition.tone,
		attenuationColor: definition.tone,
		attenuationDistance: 2.4,
		opacity: definition.opacity ?? 0.9,
		roughness: definition.roughness ?? 0.17,
		metalness: 0,
		transmission: definition.transmission ?? 0.72,
		thickness: definition.thickness ?? 0.85,
		clearcoat: definition.clearcoat ?? 0.95,
		clearcoatRoughness: definition.clearcoatRoughness ?? 0.1,
		reflectivity: 0.7,
		ior: definition.ior ?? 1.22,
		envMapIntensity: definition.envMapIntensity ?? 1.02,
		normalScale: definition.normalScale ?? 0.55,
	};
}

const generatedReferenceCrystalMaterials: ReferenceCrystalMaterial[] = definitions.map((definition) => {
	const maps = mapsFor(definition.slug);
	return {
		id: `ref-${definition.slug}`,
		slug: definition.slug,
		name: definition.name,
		image: maps.preview,
		categoryId: definition.categoryId,
		specs: specsByTier[definition.priceTier] ?? specsByTier[2],
		maps,
		renderMaterial: materialFor(definition),
	};
});

function getGeneratedMaterial(id: string) {
	const material = generatedReferenceCrystalMaterials.find((item) => item.id === id);
	if (!material) throw new Error(`Missing generated crystal material: ${id}`);
	return material;
}

function sourceLikeMaterial(
	baseId: string,
	id: string,
	name: string,
	specs: MaterialSpec[],
	categoryId = 'green-white-series',
): ReferenceCrystalMaterial {
	const base = getGeneratedMaterial(baseId);
	return {
		...base,
		id,
		name,
		categoryId,
		specs,
	};
}

export const sourceLikeCrystalMaterials: ReferenceCrystalMaterial[] = [
	sourceLikeMaterial('ref-starry-quartz', 'source-clear-quartz', '净体白水晶', specsByTier[1]),
	sourceLikeMaterial('ref-blue-moonstone', 'source-milky-quartz', '奶白晶', [
		{ size: 8, price: 4 },
		{ size: 10, price: 8 },
	]),
	sourceLikeMaterial('ref-uruguay-amethyst', 'source-uruguay-amethyst', '乌拉圭紫水晶', [
		{ size: 8, price: 10 },
		{ size: 10, price: 16 },
		{ size: 12, price: 24 },
	], 'purple-series'),
	sourceLikeMaterial('ref-brazil-amethyst', 'source-brazil-amethyst', '巴西紫水晶', [
		{ size: 8, price: 18 },
		{ size: 10, price: 37 },
		{ size: 12, price: 56 },
	], 'purple-series'),
	sourceLikeMaterial('ref-yellow-crystal', 'source-brazil-citrine', '巴西黄水晶', [
		{ size: 8, price: 32 },
		{ size: 10, price: 67 },
	], 'yellow-series'),
	sourceLikeMaterial('ref-yellow-ase', 'source-lemon-citrine', '透体柠檬黄水晶', [
		{ size: 8, price: 6 },
		{ size: 10, price: 12 },
		{ size: 12, price: 19 },
	], 'yellow-series'),
	sourceLikeMaterial('ref-yellow-tower', 'source-yellow-tower', '黄塔晶', [
		{ size: 8, price: 6.5 },
	], 'yellow-series'),
	sourceLikeMaterial('ref-pink-crystal', 'source-starlight-rose-quartz', '星光粉晶', [
		{ size: 8, price: 9 },
		{ size: 10, price: 18 },
		{ size: 12, price: 28 },
	], 'pink-series'),
	sourceLikeMaterial('ref-strawberry-crystal', 'source-purple-rose-quartz', '紫粉晶', [
		{ size: 8, price: 5 },
		{ size: 10, price: 9 },
		{ size: 12, price: 14 },
	], 'pink-series'),
];

export const referenceCrystalMaterials: ReferenceCrystalMaterial[] = [
	...sourceLikeCrystalMaterials,
	...generatedReferenceCrystalMaterials,
];

export const referenceCrystalMaterialIds = new Set(referenceCrystalMaterials.map((material) => material.id));
const referenceCrystalMaterialNames = new Set(referenceCrystalMaterials.map((material) => material.name));
const legacyMockMaterialIds = new Set(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8']);

const renderConfigById = new Map(
	referenceCrystalMaterials.map((material) => [
		material.id,
		{
			maps: material.maps,
			material: material.renderMaterial,
		},
	]),
);

export function getCrystalMaterialRenderConfig(materialId: string) {
	return renderConfigById.get(materialId) ?? null;
}

export function mergeReferenceCategories(_apiCategories: MaterialCategory[]) {
	return referenceCrystalCategories;
}

export function mergeReferenceMaterials(apiMaterials: Material[]) {
	const referenceCategoryIds = new Set(referenceCrystalCategories.map((category) => category.id));
	return [
		...referenceCrystalMaterials,
		...apiMaterials.filter(
			(material) =>
				!referenceCrystalMaterialIds.has(material.id) &&
				!legacyMockMaterialIds.has(material.id) &&
				!referenceCrystalMaterialNames.has(material.name) &&
				referenceCategoryIds.has(material.categoryId),
		),
	];
}
