import type { DesignProcessStep } from '@/stores/design';

export interface DesignProcessVideoResult {
	url: string;
	filename: string;
	mimeType: string;
	durationMs: number;
	width: number;
	height: number;
}

interface RecordDesignProcessVideoOptions {
	steps: DesignProcessStep[];
	applyStep: (step: DesignProcessStep) => Promise<void>;
	onCaptureReady?: () => Promise<void> | void;
	onProgress?: (progress: number) => void;
}

function wait(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function selectMimeType() {
	const candidates = ['video/mp4;codecs=h264', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
	return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

async function requestCurrentTabStream() {
	if (!navigator.mediaDevices?.getDisplayMedia) {
		throw new Error('当前浏览器不支持完整工作台录制');
	}
	try {
		return await navigator.mediaDevices.getDisplayMedia({
			video: { frameRate: { ideal: 30, max: 30 } },
			audio: false,
			preferCurrentTab: true,
			surfaceSwitching: 'exclude',
			selfBrowserSurface: 'include',
		} as DisplayMediaStreamOptions);
	} catch (error: any) {
		if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
			throw new Error('请选择“当前标签页”并允许共享，才能生成完整工作台视频');
		}
		throw error;
	}
}

/** 录制当前浏览器标签页，并在录制期间自动回放完整 DIY 工作台状态。 */
export async function recordDesignProcessVideo({
	steps,
	applyStep,
	onCaptureReady,
	onProgress,
}: RecordDesignProcessVideoOptions): Promise<DesignProcessVideoResult> {
	if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
		throw new Error('当前环境暂不支持生成过程视频');
	}
	if (steps.length < 2) throw new Error('至少完成一次珠子操作后才能生成视频');

	const stream = await requestCurrentTabStream();
	const videoTrack = stream.getVideoTracks()[0];
	if (!videoTrack) {
		stream.getTracks().forEach((track) => track.stop());
		throw new Error('没有获取到当前工作台画面');
	}
	videoTrack.contentHint = 'detail';
	const settings = videoTrack.getSettings();
	const width = Number(settings.width || window.innerWidth || 720);
	const height = Number(settings.height || window.innerHeight || 1280);
	const stepDurationMs = Math.max(380, Math.min(820, Math.round(18000 / steps.length)));
	const introDurationMs = 900;
	const outroDurationMs = 1400;
	const durationMs = introDurationMs + steps.length * stepDurationMs + outroDurationMs;
	const mimeType = selectMimeType();
	const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 7_000_000 } : undefined);
	const chunks: BlobPart[] = [];
	let stoppedByUser = false;

	recorder.addEventListener('dataavailable', (event) => {
		if (event.data.size) chunks.push(event.data);
	});
	videoTrack.addEventListener('ended', () => {
		stoppedByUser = true;
		if (recorder.state !== 'inactive') recorder.stop();
	});
	const stoppedPromise = new Promise<void>((resolve, reject) => {
		recorder.addEventListener('stop', () => resolve(), { once: true });
		recorder.addEventListener('error', () => reject(new Error('工作台视频录制失败')), { once: true });
	});

	try {
		await onCaptureReady?.();
		await wait(420);
		recorder.start(250);
		await applyStep(steps[0]);
		await wait(introDurationMs);
		for (let index = 0; index < steps.length; index += 1) {
			if (stoppedByUser) throw new Error('屏幕共享已停止，视频未生成完整');
			await applyStep(steps[index]);
			onProgress?.(Math.round(((index + 1) / steps.length) * 94));
			await wait(stepDurationMs);
		}
		await wait(outroDurationMs);
		if (recorder.state !== 'inactive') recorder.stop();
		await stoppedPromise;
	} finally {
		stream.getTracks().forEach((track) => track.stop());
	}

	const resolvedMimeType = recorder.mimeType || mimeType || 'video/webm';
	const extension = resolvedMimeType.includes('mp4') ? 'mp4' : 'webm';
	const blob = new Blob(chunks, { type: resolvedMimeType });
	if (!blob.size) throw new Error('工作台视频内容为空，请重试');
	onProgress?.(100);
	return {
		url: URL.createObjectURL(blob),
		filename: `珠岛-完整工作台设计过程-${Date.now()}.${extension}`,
		mimeType: resolvedMimeType,
		durationMs,
		width,
		height,
	};
}

export function downloadDesignProcessVideo(result: DesignProcessVideoResult) {
	if (typeof document === 'undefined') return;
	const anchor = document.createElement('a');
	anchor.href = result.url;
	anchor.download = result.filename;
	anchor.click();
}
