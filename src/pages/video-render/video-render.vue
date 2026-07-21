<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import BraceletCanvas from '@/components/BraceletCanvas.vue';
import { api } from '@/api';
import { useDesignStore } from '@/stores/design';
import type { BraceletBead } from '@/types';

const designStore = useDesignStore();
const canvasRef = ref<{ captureImage: (type?: string, quality?: number, outputSize?: number) => string | null } | null>(null);
const jobId = ref('');
const status = ref('等待网页渲染任务');

onLoad((options) => {
	jobId.value = String(options?.jobId || '');
});

function wait(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function uploadWithRetry(index: number, image: string) {
	let lastError: unknown;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			await api.uploadDesignProcessVideoFrame(jobId.value, index, image);
			return;
		} catch (error) {
			lastError = error;
			await wait(350 * (attempt + 1));
		}
	}
	throw lastError;
}

async function renderJob() {
	// #ifndef H5
	status.value = '该页面仅供服务端网页渲染器使用';
	return;
	// #endif
	if (!jobId.value) throw new Error('缺少视频任务 ID');
	const job = await api.getDesignProcessVideo(jobId.value);
	const loadedImages = new Set<string>();
	await wait(900);
	for (let index = 0; index < job.steps.length; index += 1) {
		const step = job.steps[index];
		const beads: BraceletBead[] = step.beads.map((bead, beadIndex) => ({
			id: `video-${index}-${beadIndex}`,
			materialId: bead.materialId,
			specId: bead.specId,
			name: bead.name,
			image: bead.image,
			size: bead.size,
			price: bead.price,
			quantity: 1,
			orderIndex: beadIndex,
		}));
		const hasNewTexture = beads.some((bead) => !loadedImages.has(bead.image));
		beads.forEach((bead) => loadedImages.add(bead.image));
		designStore.setDesignPlaybackSnapshot(beads);
		await nextTick();
		await wait(hasNewTexture ? 1100 : 320);
		const image = canvasRef.value?.captureImage('image/png', 0.96, 1024);
		if (!image) throw new Error(`第 ${index + 1} 步 WebGL 画面导出失败`);
		status.value = `上传网页渲染帧 ${index + 1}/${job.steps.length}`;
		await uploadWithRetry(index, image);
	}
	status.value = '网页渲染完成';
}

onMounted(() => {
	void renderJob().catch((error) => {
		status.value = error instanceof Error ? error.message : String(error);
		console.error('[video-render]', error);
	});
});
</script>

<template>
	<view class="render-page">
		<view class="render-stage"><BraceletCanvas ref="canvasRef" view-mode="top" mode="bracelet" /></view>
		<text class="render-status">{{ status }}</text>
	</view>
</template>

<style scoped>
.render-page { width: 1024px; height: 1100px; overflow: hidden; background: #f7f4ef; }
.render-stage { width: 1024px; height: 1024px; }
.render-status { display: block; height: 76px; color: #52636a; font-size: 18px; line-height: 76px; text-align: center; }
</style>
