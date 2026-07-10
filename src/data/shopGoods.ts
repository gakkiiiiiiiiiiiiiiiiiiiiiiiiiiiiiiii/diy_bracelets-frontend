export interface ShopGoodsCategory {
	id: string;
	name: string;
	image: string;
	description: string;
	visual?: 'mascot-cup' | 'bracelet' | 'mascot-pick';
	showOnGoodsHome?: boolean;
}

export interface ShopGoodsProduct {
	id: string;
	categoryId: string;
	type: string;
	name: string;
	image: string;
	detailImage?: string;
	listImage?: string;
	images?: string[];
	price: number;
	sizes: string[];
	description: string;
}

const crystalRoot = '/static/materials/reference-crystals';
const shopRoot = '/static/shop-goods';

export const shopGoodsCategories: ShopGoodsCategory[] = [
	{
		id: 'discount',
		name: '超优惠好物',
		image: `${crystalRoot}/yellow-crystal/yellow-crystal-preview.png`,
		description: '优惠款、入门款和日常保养小物',
		visual: 'mascot-cup',
	},
	{
		id: 'rabbit-hair',
		name: '兔毛水晶',
		image: `${shopRoot}/rabbit-category-thumb.png`,
		description: '丝状内含物清晰的手串与散珠',
		visual: 'bracelet',
	},
	{
		id: 'services',
		name: '额外服务',
		image: `${crystalRoot}/green-phantom/green-phantom-preview.png`,
		description: '检测证书、差价补齐等服务',
		visual: 'mascot-pick',
	},
];

export const shopGoodsProducts: ShopGoodsProduct[] = [
	{
		id: 'shop-white-bubble-bracelet',
		categoryId: 'discount',
		type: '标准商品',
		name: '天然双A白水超净体泡泡串',
		image: `${shopRoot}/white-bubble-hanging-detail.jpg`,
		detailImage: `${shopRoot}/white-bubble-hanging-detail.jpg`,
		listImage: `${shopRoot}/white-bubble-list.jpg`,
		images: [`${shopRoot}/white-bubble-hanging-detail.jpg`, `${shopRoot}/white-bubble-wrist-detail.jpg`],
		price: 280,
		sizes: ['12mm'],
		description: '选用天然高品质白水晶，采用独特打孔工艺避免孔道直串影响观感。如需调整手围请下单后联系客服。',
	},
	{
		id: 'shop-silver-obsidian',
		categoryId: 'discount',
		type: '标准商品',
		name: '顶级陨石银曜石手串',
		image: `${shopRoot}/silver-obsidian-bracelet.jpg`,
		listImage: `${shopRoot}/silver-obsidian-list.jpg`,
		price: 198,
		sizes: ['10mm', '12mm'],
		description: '深色光泽手串，带细密银点纹理，视觉沉稳利落。',
	},
	{
		id: 'shop-morganite',
		categoryId: 'discount',
		type: '标准商品',
		name: '摩根石',
		image: `${shopRoot}/morganite-bracelet.jpg`,
		listImage: `${shopRoot}/morganite-list.jpg`,
		price: 168,
		sizes: ['8mm', '10mm'],
		description: '柔粉色调，适合温柔浅色搭配。',
	},
	{
		id: 'shop-cleansing-bowl',
		categoryId: 'discount',
		type: '标准商品',
		name: '水晶消磁碗套装',
		image: `${shopRoot}/cleansing-bowl.jpg`,
		listImage: `${shopRoot}/cleansing-bowl-list.jpg`,
		price: 88,
		sizes: ['套装'],
		description: '日常保养水晶的小套装，适合搭配手串一同购买。',
	},
	{
		id: 'shop-rabbit-clear',
		categoryId: 'rabbit-hair',
		type: '标准商品',
		name: '兔毛水晶手串',
		image: `${shopRoot}/rabbit-clear-bracelet.jpg`,
		price: 238,
		sizes: ['8mm', '10mm'],
		description: '丝状内含物清晰，光下有柔和发丝感。',
	},
	{
		id: 'shop-rabbit-red',
		categoryId: 'rabbit-hair',
		type: '标准商品',
		name: '红兔毛水晶散珠',
		image: `${shopRoot}/rabbit-red-beads.jpg`,
		price: 32,
		sizes: ['8mm', '10mm', '12mm'],
		description: '适合补珠和局部点缀，红色丝絮更有层次。',
	},
	{
		id: 'shop-rabbit-green',
		categoryId: 'rabbit-hair',
		type: '标准商品',
		name: '绿兔毛水晶散珠',
		image: `${shopRoot}/rabbit-green-beads.jpg`,
		price: 36,
		sizes: ['8mm', '10mm'],
		description: '绿色发丝内含物，适合和白水晶、葡萄石混搭。',
	},
	{
		id: 'shop-certificate-service',
		categoryId: 'services',
		type: '标准商品',
		name: '中检检测证书服务',
		image: `${shopRoot}/certificate-service.png`,
		price: 45,
		sizes: ['一次'],
		description: '为指定晶石补充第三方检测证书，下单后请备注需要检测的商品或订单编号。',
	},
	{
		id: 'shop-price-difference',
		categoryId: 'services',
		type: '标准商品',
		name: '差价补齐',
		image: `${shopRoot}/price-difference.png`,
		price: 1,
		sizes: ['补差价'],
		description: '用于补齐定制、换款或额外服务产生的差价，请按客服确认金额拍下对应数量。',
	},
];

export function getShopCategory(id: string) {
	return shopGoodsCategories.find((category) => category.id === id) ?? null;
}

export function getShopProductById(id: string) {
	return shopGoodsProducts.find((product) => product.id === id) ?? null;
}

export function getShopProductsByCategory(categoryId: string) {
	return shopGoodsProducts.filter((product) => product.categoryId === categoryId);
}
