import { api, type DesignProcessVideoStepPayload } from '@/api';
import type { DesignProcessStep } from '@/stores/design';
import { resolveStaticUrl } from '@/utils/staticUrl';

export interface DesignProcessVideoResult {
	jobId: string;
	url: string;
	filename: string;
	mimeType: 'video/mp4';
	durationMs: number;
	width: number;
	height: number;
}

interface GenerateDesignProcessVideoOptions {
	steps: DesignProcessStep[];
	wristCm: number;
	onProgress?: (progress: number) => void;
}

function wait(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function toPayload(step: DesignProcessStep): DesignProcessVideoStepPayload {
	return {
		id: step.id,
		action: step.action,
		at: step.at,
		beads: step.beads.map((bead, orderIndex) => ({
			materialId: bead.materialId,
			specId: bead.specId || `${bead.materialId}-${bead.size}mm`,
			name: bead.name,
			size: bead.size,
			price: bead.price,
			orderIndex,
		})),
		...(step.fromIndex == null ? {} : { fromIndex: step.fromIndex }),
		...(step.toIndex == null ? {} : { toIndex: step.toIndex }),
	};
}

/**
 * 将操作历史交给服务端重放并合成 MP4。H5 与微信小程序共用该流程，
 * 不调用屏幕录制、canvas.captureStream 或任何系统录屏权限。
 */
export async function generateDesignProcessVideo({
	steps,
	wristCm,
	onProgress,
}: GenerateDesignProcessVideoOptions): Promise<DesignProcessVideoResult> {
	if (steps.filter((step) => step.action !== 'start').length < 1) {
		throw new Error('至少完成一次珠子操作后才能生成视频');
	}
	onProgress?.(1);
	const created = await api.createDesignProcessVideo({ steps: steps.map(toPayload), wristCm });
	const deadline = Date.now() + 15 * 60 * 1000;
	let job = created;
	while (job.status !== 'complete') {
		if (job.status === 'failed') throw new Error(job.error || '服务端生成过程视频失败');
		if (Date.now() >= deadline) throw new Error('视频生成超时，请稍后重试');
		onProgress?.(Math.max(1, Math.min(99, job.progress || 1)));
		await wait(900);
		job = await api.getDesignProcessVideo(job.id);
	}
	if (!job.videoUrl) throw new Error('服务端未返回视频文件');
	onProgress?.(100);
	return {
		jobId: job.id,
		url: resolveStaticUrl(job.videoUrl),
		filename: `珠岛-设计过程-${Date.now()}.mp4`,
		mimeType: 'video/mp4',
		durationMs: job.durationMs || 0,
		width: job.width || 720,
		height: job.height || 1280,
	};
}

export async function saveDesignProcessVideo(result: DesignProcessVideoResult): Promise<void> {
	// #ifdef H5
	const anchor = document.createElement('a');
	anchor.href = result.url;
	anchor.download = result.filename;
	anchor.click();
	// #endif

	// #ifdef MP-WEIXIN
	const download = await new Promise<UniApp.DownloadSuccessData>((resolve, reject) => {
		uni.downloadFile({ url: result.url, success: resolve, fail: reject });
	});
	if (download.statusCode !== 200) throw new Error('视频下载失败');
	await new Promise<void>((resolve, reject) => {
		uni.saveVideoToPhotosAlbum({ filePath: download.tempFilePath, success: () => resolve(), fail: reject });
	});
	// #endif
}
