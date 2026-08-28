import type { DesignCompositionRow } from '@/api';
import type { BraceletBead } from '@/types';

function compositionKey(row: Pick<DesignCompositionRow, 'materialId' | 'specId' | 'size' | 'price'>) {
	return `${row.materialId}-${row.specId || `${row.size}-${row.price}`}`;
}

export function beadsToComposition(beads: BraceletBead[]): DesignCompositionRow[] {
	const groups = new Map<string, DesignCompositionRow>();
	for (const bead of beads) {
		const key = compositionKey(bead);
		const current = groups.get(key);
		if (current) {
			current.quantity += 1;
			current.amount = Number((current.price * current.quantity).toFixed(1));
			continue;
		}
		groups.set(key, {
			materialId: bead.materialId,
			specId: bead.specId,
			name: bead.name,
			image: bead.image,
			size: bead.size,
			price: bead.price,
			quantity: 1,
			amount: bead.price,
		});
	}
	return Array.from(groups.values());
}

export function cloneComposition(composition: DesignCompositionRow[] = []): DesignCompositionRow[] {
	return composition.map((row) => ({ ...row }));
}

function compositionRowQuantity(row: DesignCompositionRow) {
	return row.quantity && row.quantity > 0 ? row.quantity : 1;
}

export function compositionBeadCount(composition: DesignCompositionRow[] = []) {
	return composition.reduce((sum, row) => sum + compositionRowQuantity(row), 0);
}

export function summarizeComposition(composition: DesignCompositionRow[] = [], limit = 4) {
	const visible = composition
		.slice(0, limit)
		.map((row) => {
			const quantity = compositionRowQuantity(row);
			return `${row.name}${row.size ? `${row.size}mm` : ''}${quantity > 1 ? `×${quantity}` : ''}`;
		});
	return composition.length > limit ? `${visible.join('、')} 等` : visible.join('、');
}
