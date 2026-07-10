import type { CartItem } from '@/api';
import { normalizeOrderStatus, type OrderRecord } from '@/utils/orders';
import { compositionBeadCount, summarizeComposition } from '@/utils/designComposition';

export function formatOrderDate(iso: string) {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function formatShortOrderDate(iso: string) {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${month}-${day}`;
}

export function orderImage(order: OrderRecord) {
	return order.items.find((item) => item.image)?.image || '/static/tabbar/diy.png';
}

function legacyCartItemNameParts(item: CartItem) {
	if (item.spec || !item.name.includes(' · ')) return { name: item.name, spec: '' };
	const [name, ...specParts] = item.name.split(' · ');
	return { name: name || item.name, spec: specParts.join(' · ') };
}

export function cartItemDisplayName(item: CartItem) {
	return legacyCartItemNameParts(item).name;
}

export function cartItemSpecText(item: CartItem) {
	return item.spec || legacyCartItemNameParts(item).spec;
}

export function cartItemTypeText(item: CartItem) {
	if (item.type) return item.type;
	return item.composition?.length ? '定制设计' : '标准商品';
}

function formatCm(value: number) {
	return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

export function cartItemWristText(item: CartItem) {
	const target = typeof item.handCircumferenceCm === 'number' ? item.handCircumferenceCm : null;
	const estimated = typeof item.estimatedCircumferenceCm === 'number' ? item.estimatedCircumferenceCm : null;
	if (target == null && estimated == null) return '';
	if (target != null && estimated != null) return `目标手围 ${formatCm(target)}cm · 当前 ${formatCm(estimated)}cm`;
	if (target != null) return `目标手围 ${formatCm(target)}cm`;
	return `当前手串 ${formatCm(estimated || 0)}cm`;
}

export function cartItemSummaryText(item: CartItem) {
	if (item.composition?.length) {
		const wrist = cartItemWristText(item);
		const summary = `${compositionBeadCount(item.composition)}颗珠 · ${summarizeComposition(item.composition, 3)}`;
		return wrist ? `${wrist} · ${summary}` : summary;
	}
	const spec = cartItemSpecText(item);
	const wrist = cartItemWristText(item);
	const summary = spec ? `规格：${spec}` : cartItemTypeText(item);
	return wrist ? `${wrist} · ${summary}` : summary;
}

export function orderCompositionText(order: OrderRecord) {
	const composition = order.items.find((item) => item.composition?.length)?.composition ?? [];
	if (!composition.length) {
		const firstItem = order.items[0];
		return firstItem ? cartItemSummaryText(firstItem) : `${order.itemCount} 件商品`;
	}
	return `${compositionBeadCount(composition)}颗珠 · ${summarizeComposition(composition, 3)}`;
}

export function orderDetailText(order: OrderRecord) {
	const detail = order.items
		.map((item) => {
			const summary = cartItemSummaryText(item);
			return `${cartItemDisplayName(item)} ×${item.qty}${summary ? `\n${summary}` : ''}`;
		})
		.join('\n');
	const address = order.address
		? `\n收货地址：${order.address.name} ${order.address.phone}\n${order.address.region} ${order.address.detail}`
		: '';
	const discount = order.discount ? `\n优惠抵扣：-¥${order.discount.toFixed(1)}` : '';
	const note = order.note ? `\n买家留言：${order.note}` : '';
	return `${normalizeOrderStatus(order.status)} · ¥${order.total.toFixed(1)}\n${detail}${discount}${address}${note}`;
}

export function orderEditableComposition(order: OrderRecord) {
	return order.items.find((item) => item.composition?.length)?.composition;
}
