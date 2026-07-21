import type { DesignProcessAction, DesignProcessStep } from '@/stores/design';

export interface DesignProcessVideoResult {
	url: string;
	filename: string;
	mimeType: string;
	durationMs: number;
}

interface RecordDesignProcessVideoOptions {
	sourceCanvas: HTMLCanvasElement;
	steps: DesignProcessStep[];
	applyStep: (step: DesignProcessStep) => Promise<void>;
	brandName?: string;
	brandNameEn?: string;
	onProgress?: (progress: number) => void;
}

const ACTION_LABELS: Record<DesignProcessAction, string> = {
	start: '从空白开始',
	add: '添加一颗珠子',
	move: '调整珠子顺序',
	remove: '移除一颗珠子',
	replace: '替换一颗珠子',
	clear: '清空当前设计',
	apply: '载入一套设计',
};

function wait(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function selectMimeType() {
	const candidates = ['video/mp4;codecs=h264', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
	return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function drawRoundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) {
	ctx.beginPath();
	ctx.roundRect(x, y, width, height, radius);
	ctx.closePath();
}

function drawContainedCanvas(
	ctx: CanvasRenderingContext2D,
	source: HTMLCanvasElement,
	x: number,
	y: number,
	width: number,
	height: number,
) {
	const sourceWidth = source.width || source.clientWidth;
	const sourceHeight = source.height || source.clientHeight;
	if (!sourceWidth || !sourceHeight) return;
	const scale = Math.min(width / sourceWidth, height / sourceHeight);
	const drawWidth = sourceWidth * scale;
	const drawHeight = sourceHeight * scale;
	ctx.drawImage(source, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

/** H5 使用当前 Three.js 画布实时回放操作快照，并录制为浏览器支持的视频格式。 */
export async function recordDesignProcessVideo({
	sourceCanvas,
	steps,
	applyStep,
	brandName = '珠岛',
	brandNameEn = 'ZHUDAO',
	onProgress,
}: RecordDesignProcessVideoOptions): Promise<DesignProcessVideoResult> {
	if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
		throw new Error('当前环境暂不支持生成过程视频');
	}
	const output = document.createElement('canvas');
	output.width = 720;
	output.height = 900;
	const ctx = output.getContext('2d');
	if (!ctx || typeof output.captureStream !== 'function') {
		throw new Error('当前浏览器不支持画布视频录制');
	}

	const playableSteps = steps.length ? steps : [];
	if (playableSteps.length < 2) throw new Error('至少完成一次珠子操作后才能生成视频');
	const stepDurationMs = Math.max(320, Math.min(760, Math.round(16000 / playableSteps.length)));
	const introDurationMs = 700;
	const outroDurationMs = 1100;
	const durationMs = introDurationMs + playableSteps.length * stepDurationMs + outroDurationMs;
	let activeStep = playableSteps[0];
	let frameHandle = 0;
	let stopped = false;

	const drawFrame = () => {
		const background = ctx.createLinearGradient(0, 0, 720, 900);
		background.addColorStop(0, '#f3efe9');
		background.addColorStop(0.52, '#fcfaf6');
		background.addColorStop(1, '#e9e7e3');
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, 720, 900);

		ctx.fillStyle = '#273238';
		ctx.font = '600 24px -apple-system, BlinkMacSystemFont, sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText('我的手串诞生过程', 52, 64);
		ctx.fillStyle = 'rgba(39, 50, 56, 0.52)';
		ctx.font = '500 14px -apple-system, BlinkMacSystemFont, sans-serif';
		ctx.fillText(`${brandName} · ${brandNameEn}`, 52, 90);

		ctx.save();
		drawRoundedRect(ctx, 36, 112, 648, 648, 34);
		ctx.clip();
		const stageGradient = ctx.createLinearGradient(36, 112, 684, 760);
		stageGradient.addColorStop(0, '#f4f0ea');
		stageGradient.addColorStop(0.5, '#fdfbf7');
		stageGradient.addColorStop(1, '#edeae5');
		ctx.fillStyle = stageGradient;
		ctx.fillRect(36, 112, 648, 648);
		drawContainedCanvas(ctx, sourceCanvas, 36, 112, 648, 648);
		ctx.restore();

		ctx.fillStyle = 'rgba(39, 50, 56, 0.08)';
		drawRoundedRect(ctx, 52, 792, 616, 68, 22);
		ctx.fill();
		ctx.fillStyle = '#273238';
		ctx.font = '600 20px -apple-system, BlinkMacSystemFont, sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText(ACTION_LABELS[activeStep.action], 360, 822);
		ctx.fillStyle = 'rgba(39, 50, 56, 0.58)';
		ctx.font = '500 15px -apple-system, BlinkMacSystemFont, sans-serif';
		ctx.fillText(`${activeStep.beads.length} 颗珠子`, 360, 846);

		if (!stopped) frameHandle = requestAnimationFrame(drawFrame);
	};

	const stream = output.captureStream(30);
	const mimeType = selectMimeType();
	const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 5_000_000 } : undefined);
	const chunks: BlobPart[] = [];
	recorder.addEventListener('dataavailable', (event) => {
		if (event.data.size) chunks.push(event.data);
	});
	const stoppedPromise = new Promise<void>((resolve, reject) => {
		recorder.addEventListener('stop', () => resolve(), { once: true });
		recorder.addEventListener('error', () => reject(new Error('过程视频录制失败')), { once: true });
	});

	drawFrame();
	recorder.start(250);
	try {
		await applyStep(playableSteps[0]);
		await wait(introDurationMs);
		for (let index = 0; index < playableSteps.length; index += 1) {
			activeStep = playableSteps[index];
			await applyStep(activeStep);
			onProgress?.(Math.round(((index + 1) / playableSteps.length) * 90));
			await wait(stepDurationMs);
		}
		await wait(outroDurationMs);
	} finally {
		recorder.stop();
		await stoppedPromise;
		stopped = true;
		cancelAnimationFrame(frameHandle);
		stream.getTracks().forEach((track) => track.stop());
	}

	const resolvedMimeType = recorder.mimeType || mimeType || 'video/webm';
	const extension = resolvedMimeType.includes('mp4') ? 'mp4' : 'webm';
	const blob = new Blob(chunks, { type: resolvedMimeType });
	if (!blob.size) throw new Error('过程视频内容为空，请重试');
	onProgress?.(100);
	return {
		url: URL.createObjectURL(blob),
		filename: `珠岛-手串设计过程-${Date.now()}.${extension}`,
		mimeType: resolvedMimeType,
		durationMs,
	};
}

export function downloadDesignProcessVideo(result: DesignProcessVideoResult) {
	if (typeof document === 'undefined') return;
	const anchor = document.createElement('a');
	anchor.href = result.url;
	anchor.download = result.filename;
	anchor.click();
}
