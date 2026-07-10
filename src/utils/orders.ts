import type { CartItem } from '@/api';
import type { CheckoutAddress } from '@/utils/checkout';
import { cloneComposition, summarizeComposition } from '@/utils/designComposition';

export type LocalOrderAddress = CheckoutAddress;

export interface OrderRecord {
	id: string;
	title: string;
	status: string;
	total: number;
	itemTotal?: number;
	freight?: number;
	discount?: number;
	couponCode?: string;
	note?: string;
	address?: LocalOrderAddress;
	itemCount: number;
	createdAt: string;
	items: CartItem[];
}

export const ORDER_STATUS_TABS = ['全部', '待发货', '已发货', '已收货', '退款/售后'] as const;

export type OrderStatusTab = (typeof ORDER_STATUS_TABS)[number];
export type NormalizedOrderStatus = Exclude<OrderStatusTab, '全部'>;

export interface CreateLocalOrderOptions {
	address?: LocalOrderAddress | null;
	discount?: number;
	freight?: number;
	couponCode?: string;
	note?: string;
}

const ORDER_STORAGE_KEY = 'diy-bracelets-orders';

export function normalizeOrderStatus(status = ''): NormalizedOrderStatus {
	const normalized = status.trim();
	if (!normalized) return '待发货';
	if (['待确认', '待付款', '待处理', '待制作', '制作中', '待发货'].includes(normalized)) {
		return '待发货';
	}
	if (['已发货', '运输中', '配送中', '待收货'].includes(normalized)) {
		return '已发货';
	}
	if (['已完成', '完成', '已签收', '已收货'].includes(normalized)) {
		return '已收货';
	}
	if (normalized.includes('退') || normalized.includes('售后') || normalized.includes('取消')) {
		return '退款/售后';
	}
	return '待发货';
}

export function orderMatchesStatus(order: OrderRecord, status: OrderStatusTab) {
	return status === '全部' || normalizeOrderStatus(order.status) === status;
}

export function loadLocalOrders(): OrderRecord[] {
	try {
		const raw = uni.getStorageSync(ORDER_STORAGE_KEY);
		const cached = typeof raw === 'string' ? JSON.parse(raw) : raw;
		return Array.isArray(cached) ? cached : [];
	} catch {
		return [];
	}
}

export function saveLocalOrders(orders: OrderRecord[]) {
	uni.setStorageSync(ORDER_STORAGE_KEY, JSON.stringify(orders));
}

export function updateLocalOrder(id: string, updater: (order: OrderRecord) => OrderRecord) {
	const orders = loadLocalOrders();
	let updated: OrderRecord | null = null;
	const next = orders.map((order) => {
		if (order.id !== id) return order;
		updated = updater(order);
		return updated;
	});
	if (!updated) return null;
	saveLocalOrders(next);
	return updated;
}

export function updateLocalOrderStatus(id: string, status: NormalizedOrderStatus) {
	return updateLocalOrder(id, (order) => ({ ...order, status }));
}

export function logisticsOrderNo(id: string) {
	const rawDigits = id.replace(/\D/g, '');
	if (rawDigits) {
		return `YGS${rawDigits.slice(-10).padStart(10, '0')}`;
	}
	let hash = 0;
	for (const char of id) {
		hash = (hash * 33 + char.charCodeAt(0)) % 10000000000;
	}
	return `YGS${String(hash).padStart(10, '0')}`;
}

export function createLocalOrder(items: CartItem[], options: CreateLocalOrderOptions = {}): OrderRecord {
	const itemTotal = Number(items.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(1));
	const freight = Number((options.freight || 0).toFixed(1));
	const discount = Number((options.discount || 0).toFixed(1));
	const total = Number(Math.max(0, itemTotal + freight - discount).toFixed(1));
	const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
	const primaryName = items[0]?.name || '定制手串';
	const order: OrderRecord = {
		id: `order-${Date.now()}`,
		title: items.length > 1 ? `${primaryName} 等 ${items.length} 件` : primaryName,
		status: '待发货',
		total,
		itemTotal,
		freight,
		discount,
		couponCode: options.couponCode,
		note: options.note,
		address: options.address || undefined,
		itemCount,
		createdAt: new Date().toISOString(),
		items: items.map((item) => ({ ...item, composition: cloneComposition(item.composition) })),
	};
	saveLocalOrders([order, ...loadLocalOrders()]);
	return order;
}

export function cloneOrderItemsForCart(order: Pick<OrderRecord, 'id' | 'items'>): CartItem[] {
	const stamp = Date.now();
	return order.items.map((item, index) => {
		const isCustomDesign = !!item.composition?.length;
		return {
			...item,
			id: isCustomDesign ? `cart-repeat-${order.id}-${stamp}-${index}` : item.id,
			qty: Number(item.qty || 1),
			composition: cloneComposition(item.composition),
		};
	});
}

export function formatOrderSummary(orders: OrderRecord[]) {
	if (!orders.length) return '暂无订单。完成设计并在购物车结算后，订单会出现在这里。';
	return orders
		.slice(0, 4)
		.map((order) => {
			const detail = order.items
				.map((item) => summarizeComposition(item.composition, 3))
				.filter(Boolean)
				.join('；');
			return `${order.title} · ${normalizeOrderStatus(order.status)} · ¥${order.total.toFixed(1)}${detail ? `\n${detail}` : ''}`;
		})
		.join('\n');
}
