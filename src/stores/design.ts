import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { BraceletBead, Material, MaterialSpec } from '@/types';
import type { DesignCompositionRow } from '@/api';
import { MIN_HAND_CIRCUMFERENCE_CM } from '@/data/mock';

export type DesignSource = 'manual' | 'plaza' | 'saved' | 'draft' | 'order' | 'cart' | 'inspiration';

export type DesignProcessAction = 'start' | 'add' | 'move' | 'remove' | 'replace' | 'clear' | 'apply';

export interface DesignProcessStep {
	id: string;
	action: DesignProcessAction;
	at: number;
	beads: BraceletBead[];
	fromIndex?: number;
	toIndex?: number;
}

interface ApplyDesignOptions {
	source?: DesignSource;
	handCircumferenceCm?: number | null;
	hasUnavailableParts?: boolean;
}

/**
 * 根据珠子列表估算手链周长 (cm)
 * 逻辑：每颗珠子直径 size（mm），视为对长度做等价贡献 (size/10) cm，累加数量
 * @param beads 珠子数组
 * @returns 估算的手链总周长（厘米，保留一位小数）
 */
function estimateCircumference(beads: BraceletBead[]): number {
	let total = 0;
	for (const b of beads) {
		total += (b.size / 10) * b.quantity;
	}
	return Math.round(total * 10) / 10;
}

export const useDesignStore = defineStore('design', () => {
	// 手链设计珠子数组，顺序即为摆放顺序
	const braceletDesign = ref<BraceletBead[]>([]);
	const designSource = ref<DesignSource>('manual');
	const handCircumferenceCm = ref<number | null>(null);
	const hasUnavailableParts = ref(false);
	const designProcess = ref<DesignProcessStep[]>([
		{ id: 'process-start', action: 'start', at: Date.now(), beads: [] },
	]);
	const lastBeadAction = ref<{
		type: 'add' | 'replace' | 'remove' | 'clear' | 'apply';
		materialId?: string;
		name?: string;
		image?: string;
		size?: number;
		price?: number;
		specId?: string;
		at: number;
	} | null>(null);

	function cloneBeads(beads = braceletDesign.value): BraceletBead[] {
		return beads.map((bead) => ({ ...bead }));
	}

	function recordDesignStep(
		action: DesignProcessAction,
		meta: Pick<DesignProcessStep, 'fromIndex' | 'toIndex'> = {},
	) {
		const at = Date.now();
		designProcess.value.push({
			id: `process-${at}-${designProcess.value.length}`,
			action,
			at,
			beads: cloneBeads(),
			...meta,
		});
		if (designProcess.value.length > 120) {
			designProcess.value.splice(1, designProcess.value.length - 120);
		}
	}

	function resetDesignProcess(initialBeads: BraceletBead[] = braceletDesign.value) {
		designProcess.value = [
			{
				id: `process-start-${Date.now()}`,
				action: 'start',
				at: Date.now(),
				beads: cloneBeads(initialBeads),
			},
		];
	}

	/**
	 * 计算当前设计的总价
	 */
	const totalPrice = computed(() => {
		// sum(price * quantity) for all beads
		return braceletDesign.value.reduce((sum, b) => sum + b.price * b.quantity, 0);
	});

	/**
	 * 计算当前手链总周长（厘米）
	 */
	const circumference = computed(() => estimateCircumference(braceletDesign.value));

	/**
	 * 珠子是否未达到可成串数量：真实小程序用「珠子数量不足」提示。
	 */
	const isBeadCountInsufficient = computed(() => circumference.value < MIN_HAND_CIRCUMFERENCE_CM);
	const isHandTooSmall = computed(() => isBeadCountInsufficient.value);

	/**
	 * 添加珠子到手链设计（可以指定数量，默认 1）
	 * @param material 材料对象
	 * @param spec 规格对象（尺寸与价格）
	 * @param quantity 数量，默认为 1
	 */
	function addBead(material: Material, spec: MaterialSpec, quantity = 1) {
		// 当前已有珠子的数量，作为 orderIndex 基准
		const wasEmpty = braceletDesign.value.length === 0;
		const orderIndex = braceletDesign.value.length;
		for (let i = 0; i < quantity; i++) {
			braceletDesign.value.push({
				id: `bead-${Date.now()}-${orderIndex + i}`, // 唯一 id
				materialId: material.id,
				name: material.name,
				image: material.image,
				size: spec.size,
				price: spec.price,
				specId: spec.specId,
				quantity: 1,
				orderIndex: orderIndex + i,
			});
		}
		refreshOrderIndex();
		handCircumferenceCm.value = null;
		if (wasEmpty) {
			designSource.value = 'manual';
			hasUnavailableParts.value = false;
		}
		lastBeadAction.value = {
			type: 'add',
			materialId: material.id,
			name: material.name,
			image: material.image,
			size: spec.size,
			price: spec.price,
			specId: spec.specId,
			at: Date.now(),
		};
		recordDesignStep('add');
	}

	/**
	 * 移除指定 id 的珠子
	 * @param id 珠子 id
	 */
	function removeBead(id: string) {
		const removed = braceletDesign.value.find((b) => b.id === id);
		braceletDesign.value = braceletDesign.value.filter((b) => b.id !== id);
		refreshOrderIndex();
		handCircumferenceCm.value = null;
		if (!braceletDesign.value.length) {
			designSource.value = 'manual';
			hasUnavailableParts.value = false;
		}
		lastBeadAction.value = {
			type: 'remove',
			materialId: removed?.materialId,
			name: removed?.name,
			image: removed?.image,
			size: removed?.size,
			price: removed?.price,
			at: Date.now(),
		};
		recordDesignStep('remove');
	}

	function replaceBead(id: string, material: Material, spec: MaterialSpec) {
		const index = braceletDesign.value.findIndex((b) => b.id === id);
		if (index < 0) return;
		braceletDesign.value[index] = {
			...braceletDesign.value[index],
			materialId: material.id,
			name: material.name,
			image: material.image,
			size: spec.size,
			price: spec.price,
			specId: spec.specId,
			quantity: 1,
		};
		refreshOrderIndex();
		handCircumferenceCm.value = null;
		lastBeadAction.value = {
			type: 'replace',
			materialId: material.id,
			name: material.name,
			image: material.image,
			size: spec.size,
			price: spec.price,
			specId: spec.specId,
			at: Date.now(),
		};
		recordDesignStep('replace');
	}

	/**
	 * 清空当前手链设计
	 */
	function clearDesign(options: { record?: boolean } = {}) {
		braceletDesign.value = [];
		designSource.value = 'manual';
		handCircumferenceCm.value = null;
		hasUnavailableParts.value = false;
		lastBeadAction.value = { type: 'clear', at: Date.now() };
		if (options.record !== false) recordDesignStep('clear');
	}

	function clearLastBeadAction(at?: number) {
		if (at != null && lastBeadAction.value?.at !== at) return;
		lastBeadAction.value = null;
	}

	/**
	 * 手动重排珠子顺序（支持拖拽）
	 * @param fromIndex 原下标
	 * @param toIndex 目标下标
	 */
	function reorderBeads(fromIndex: number, toIndex: number) {
		if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
		const list = [...braceletDesign.value];
		const [item] = list.splice(fromIndex, 1);
		if (!item) return;
		list.splice(toIndex, 0, item);
		braceletDesign.value = list;
		refreshOrderIndex();
		recordDesignStep('move', { fromIndex, toIndex });
	}

	/**
	 * 刷新所有珠子的顺序下标（orderIndex）
	 */
	function refreshOrderIndex() {
		braceletDesign.value.forEach((b, i) => {
			b.orderIndex = i;
		});
	}

	/**
	 * 从设计广场「使用该设计」：用构成表覆盖当前手串
	 * @param composition 设计构成（材料名、尺寸、单价、数量、图片）
	 */
	function applyDesignFromPlaza(composition: DesignCompositionRow[], options: ApplyDesignOptions = {}) {
		const beads: BraceletBead[] = [];
		let orderIndex = 0;
		for (const row of composition) {
			for (let i = 0; i < row.quantity; i++) {
				beads.push({
					id: `bead-plaza-${Date.now()}-${orderIndex}`,
					materialId: row.materialId,
					name: row.name,
					image: row.image,
					size: row.size,
					price: row.price,
					quantity: 1,
					orderIndex,
				});
				orderIndex += 1;
			}
		}
		braceletDesign.value = beads;
		designSource.value = options.source ?? 'plaza';
		handCircumferenceCm.value = typeof options.handCircumferenceCm === 'number' ? options.handCircumferenceCm : null;
		hasUnavailableParts.value = !!options.hasUnavailableParts;
		lastBeadAction.value = { type: 'apply', at: Date.now() };
		recordDesignStep('apply');
	}

	function applyOrderedBeads(
		beads: Array<{ materialId: string; specId: string; name: string; image: string; size: number; price: number }>,
		options: ApplyDesignOptions = {},
	) {
		braceletDesign.value = beads.map((bead, orderIndex) => ({
			id: `bead-code-${Date.now()}-${orderIndex}`,
			materialId: bead.materialId,
			specId: bead.specId,
			name: bead.name,
			image: bead.image,
			size: bead.size,
			price: bead.price,
			quantity: 1,
			orderIndex,
		}));
		designSource.value = options.source ?? 'plaza';
		handCircumferenceCm.value = typeof options.handCircumferenceCm === 'number' ? options.handCircumferenceCm : null;
		hasUnavailableParts.value = !!options.hasUnavailableParts;
		lastBeadAction.value = { type: 'apply', at: Date.now() };
		recordDesignStep('apply');
	}

	return {
		braceletDesign, // 手链设计数据数组
		designSource,
		handCircumferenceCm,
		hasUnavailableParts,
		designProcess,
		resetDesignProcess,
		lastBeadAction,
		clearLastBeadAction,
		totalPrice, // 总价
		circumference, // 总周长
		isBeadCountInsufficient, // 珠子数量是否不足
		isHandTooSmall, // 长度是否过短
		addBead, // 添加珠子
		removeBead, // 移除珠子
		replaceBead, // 替换珠子
		clearDesign, // 清空设计
		reorderBeads, // 重排珠子顺序
		applyDesignFromPlaza, // 从设计广场套用设计
		applyOrderedBeads,
	};
});
