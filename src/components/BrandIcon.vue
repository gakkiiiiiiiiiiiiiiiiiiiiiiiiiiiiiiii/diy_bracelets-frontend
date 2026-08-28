<script setup lang="ts">
import { computed } from 'vue';
import { resolveStaticUrl } from '@/utils/staticUrl';

export type BrandIconName =
	| 'arrow-left'
	| 'ellipsis'
	| 'minus'
	| 'locate-fixed'
	| 'circle-help'
	| 'circle-dot'
	| 'rotate-3d'
	| 'layers-3'
	| 'save'
	| 'shopping-bag'
	| 'circle-dashed'
	| 'search'
	| 'volume-2'
	| 'volume-x'
	| 'trash-2'
	| 'file-down'
	| 'share-2'
	| 'wand-sparkles'
	| 'x'
	| 'plus'
	| 'triangle-alert'
	| 'circle-check'
	| 'play';

const props = withDefaults(
	defineProps<{
		name: BrandIconName;
		tone?: 'brand' | 'inverse' | 'rose' | 'muted';
		label?: string;
	}>(),
	{ tone: 'brand', label: '' },
);

const source = computed(() => {
	const suffix = props.tone === 'brand' ? '' : `-${props.tone}`;
	return resolveStaticUrl(`/static/brand-icons/${props.name}${suffix}.png`);
});
</script>

<template>
	<image
		class="brand-icon"
		:src="source"
		mode="aspectFit"
		:aria-label="label || undefined"
		:aria-hidden="label ? undefined : true"
	/>
</template>

<style scoped>
.brand-icon {
	display: block;
	width: 100%;
	height: 100%;
	flex-shrink: 0;
}
</style>
