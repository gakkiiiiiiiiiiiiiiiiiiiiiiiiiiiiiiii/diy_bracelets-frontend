<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { onHide, onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app';
import NavigationBar from '@/components/NavigationBar.vue';
import InfoTag from '@/components/InfoTag.vue';
import BraceletCanvas from '@/components/BraceletCanvas.vue';
import ActionButton from '@/components/ActionButton.vue';
import MaterialSearch from '@/components/MaterialSearch.vue';
import MaterialCategoryList from '@/components/MaterialCategoryList.vue';
import MaterialCard from '@/components/MaterialCard.vue';
import BrandIcon from '@/components/BrandIcon.vue';
import { useDesignStore } from '@/stores/design';
import { useMaterialsStore } from '@/stores/materials';
import { useSavedDesignsStore } from '@/stores/savedDesigns';
import { useUIStore } from '@/stores/ui';
import { useContentStore } from '@/stores/content';
import { beadsToComposition, compositionBeadCount } from '@/utils/designComposition';
import { addLocalCartItems, loadLocalCartItems, saveCheckoutDraft, saveLocalCartItems } from '@/utils/checkout';
import {
	clearEditingCartItem,
	clearEditingSavedDesign,
	DESIGN_ENTRY_SOURCE_STORAGE_KEY,
	readEditingCartItemId,
	readEditingSavedDesignId,
	rememberDesignEntrySource,
	type DesignEntrySource,
} from '@/utils/designNavigation';
import { MIN_HAND_CIRCUMFERENCE_CM } from '@/data/mock';
import type { Material, MaterialSpec } from '@/types';
import type { BraceletCodeResolution, CartItem, ResolvedBraceletBead } from '@/api';
import { api } from '@/api';
const designStore = useDesignStore();
const materialsStore = useMaterialsStore();
const savedDesignsStore = useSavedDesignsStore();
const uiStore = useUIStore();
const contentStore = useContentStore();
const braceletCanvasRef = ref<{ pauseRendering: () => void; resumeRendering: () => void } | null>(null);
const DRAFT_STORAGE_KEY = 'bracelet-draft';
const DRAFT_RESTORE_KEY = 'diy-bracelets-restore-draft-on-next-design-open';
const CURRENT_BRACELET_STORAGE_KEY = 'diy-bracelets-current-bracelet-design';
const TARGET_HAND_CIRCUMFERENCE_STORAGE_KEY = 'diy-bracelets-target-hand-circumference-cm';
const WRIST_TARGET_MIN_CM = 12;
const WRIST_TARGET_MAX_CM = 22;
const WRIST_TARGET_STEP_CM = 0.5;
const BEAD_FLIGHT_START_ANGLE = (5 * Math.PI) / 12;
const wristTargetOptions = [14, 14.5, 15, 15.5, 16, 16.5, 17, 17.5, 18];
const loadingReady = ref(false);
const loadingProgress = ref(0);
const entrySource = ref<DesignEntrySource>('bracelet');
const activeRouteSource = ref<DesignEntrySource | null>(null);
const modeOptions: Array<{ id: DesignEntrySource; label: string }> = [
	{ id: 'bracelet', label: '手串' },
	{ id: 'single', label: '单珠' },
];
let loadingTimer: ReturnType<typeof setTimeout> | null = null;
let loadingProgressTimer: ReturnType<typeof setInterval> | null = null;
let recentActionTimer: ReturnType<typeof setTimeout> | null = null;
let insufficientHintTimer: ReturnType<typeof setTimeout> | null = null;
let insufficientToastTimer: ReturnType<typeof setTimeout> | null = null;
let functionToastTimer: ReturnType<typeof setTimeout> | null = null;
let beadFlightTimer: ReturnType<typeof setTimeout> | null = null;

function onRouteHashChange() {
	syncEntrySource(readRouteSource());
	restoreDesignStateForCurrentSource();
}

function startPageLoading() {
	if (loadingTimer) clearTimeout(loadingTimer);
	if (loadingProgressTimer) clearInterval(loadingProgressTimer);
	// #ifdef H5
	// Keep H5 scroll views mounted from the first render. Delayed mounting inside
	// uni-app's cached tab pages can run the scroll-view activated hook before its
	// DOM ref exists.
	loadingReady.value = true;
	loadingProgress.value = 100;
	return;
	// #endif
	if (loadingReady.value && materialsStore.loaded) {
		loadingProgress.value = 100;
		return;
	}
	loadingReady.value = false;
	loadingProgress.value = 8;
	loadingProgressTimer = setInterval(() => {
		loadingProgress.value = Math.min(92, loadingProgress.value + 5);
	}, 120);
	loadingTimer = setTimeout(() => {
		if (loadingProgressTimer) clearInterval(loadingProgressTimer);
		loadingProgressTimer = null;
		loadingProgress.value = 100;
		loadingReady.value = true;
	}, 2200);
}

onMounted(() => {
	void contentStore.fetchContent();
	loadTargetHandCircumference();
	materialsStore.fetchFromApi();
	if (typeof window !== 'undefined') {
		window.addEventListener('hashchange', onRouteHashChange);
	}
	syncEntrySource(readRouteSource());
	restoreDesignStateForCurrentSource();
	syncTargetFromAppliedDesign();
	startPageLoading();
});

onShow(() => {
	syncEntrySource(readRouteSource());
	restoreDesignStateForCurrentSource();
	syncTargetFromAppliedDesign();
	startPageLoading();
	hideDesignTabBar();
	nextTick(() => braceletCanvasRef.value?.resumeRendering());
});

onHide(() => {
	braceletCanvasRef.value?.pauseRendering();
	uni.showTabBar({ animation: false, fail: () => undefined });
});

onUnmounted(() => {
	if (loadingTimer) clearTimeout(loadingTimer);
	if (loadingProgressTimer) clearInterval(loadingProgressTimer);
	if (recentActionTimer) clearTimeout(recentActionTimer);
	if (insufficientHintTimer) clearTimeout(insufficientHintTimer);
	if (insufficientToastTimer) clearTimeout(insufficientToastTimer);
	if (functionToastTimer) clearTimeout(functionToastTimer);
	if (beadFlightTimer) clearTimeout(beadFlightTimer);
	if (typeof window !== 'undefined') {
		window.removeEventListener('hashchange', onRouteHashChange);
	}
	uni.showTabBar({ animation: false, fail: () => undefined });
});

// 总价文本（带单位）
const totalPriceText = computed(() => `总价格: ${designStore.totalPrice.toFixed(1)} 元`);
// 是否可以完成设计按钮
const canFinish = computed(() => designStore.braceletDesign.length > 0);
const existingDesignSources = new Set(['plaza', 'saved', 'draft', 'order', 'cart', 'inspiration']);
const showSaveAction = computed(
	() =>
		canFinish.value &&
		!functionMenuOpen.value &&
		entrySource.value === 'bracelet',
);
const loadingTitle = computed(() =>
	designStore.braceletDesign.length > 0 && existingDesignSources.has(designStore.designSource)
		? '建立珠岛设计台...'
		: '获取珠子数据...',
);
const targetHandCircumferenceCm = ref(MIN_HAND_CIRCUMFERENCE_CM);
const wristSelectorOpen = ref(false);
const actualCircumference = computed(() => designStore.circumference);
const targetCircumference = computed(() => targetHandCircumferenceCm.value);
const isEffectiveBeadCountInsufficient = computed(
	() => entrySource.value === 'bracelet' && beadCount.value > 0 && actualCircumference.value < targetCircumference.value,
);
const handCircumferenceText = computed(() => `手围 - ${targetCircumference.value.toFixed(1)}cm`);
const beadCount = computed(() => designStore.braceletDesign.length);
const singleSelectionText = computed(() => `已选 ${beadCount.value} 颗单珠`);
const circumferenceProgress = computed(() => {
	if (entrySource.value === 'single') return Math.min(100, beadCount.value * 20);
	if (!beadCount.value) return 0;
	return Math.min(100, Math.round((actualCircumference.value / targetCircumference.value) * 100));
});
const circumferenceRemainingText = computed(() => {
	const remaining = Math.max(0, targetCircumference.value - actualCircumference.value);
	return remaining > 0 ? `还差 ${remaining.toFixed(1)}cm` : '可以成串';
});
const circumferenceRemainingCm = computed(() =>
	Number(Math.max(0, targetCircumference.value - actualCircumference.value).toFixed(1)),
);
const insufficientDetailText = computed(() => {
	if (!beadCount.value) return `${targetCircumferenceText.value} · 还未添加珠子`;
	return `当前 ${actualCircumference.value.toFixed(1)}cm · ${targetCircumferenceText.value} · ${circumferenceRemainingText.value}`;
});
const targetCircumferenceText = computed(() => `目标 ${targetCircumference.value.toFixed(1)}cm`);
const growthTargetText = computed(() => (entrySource.value === 'single' ? '单珠清单' : targetCircumferenceText.value));
const growthStageTitle = computed(() => {
	if (entrySource.value === 'single') return beadCount.value ? '已选单珠' : '待选第一颗';
	if (!beadCount.value) return '待选第一颗';
	if (circumferenceProgress.value < 45) return '正在起光';
	if (circumferenceProgress.value < 100) return '快成串了';
	return '已可成串';
});
const growthStageSub = computed(() => {
	if (entrySource.value === 'single') {
		if (!beadCount.value) return '单珠清单未开始';
		return `${beadCount.value}颗 · ¥${designStore.totalPrice.toFixed(1)}`;
	}
	if (!beadCount.value) return `${targetCircumferenceText.value} · 光感未开始`;
	if (circumferenceProgress.value < 100) return `${beadCount.value}颗 · ${circumferenceRemainingText.value}`;
	return `${beadCount.value}颗 · ${actualCircumference.value.toFixed(1)}cm`;
});
const latestBeadFeedback = computed(() => {
	if (!beadCount.value) return null;
	const bead = designStore.braceletDesign[beadCount.value - 1];
	if (!bead) return null;
	return {
		name: bead.name || '水晶珠',
		sizeText: `${bead.size}mm`,
		image: bead.image || '',
	};
});
const refillSuggestionText = computed(() => {
	if (!isEffectiveBeadCountInsufficient.value || !beadCount.value) return '';
	const latestBead = designStore.braceletDesign[beadCount.value - 1];
	const latestSize = Number(latestBead?.size || 8);
	const beadCm = Math.max(0.4, latestSize / 10);
	const recommendedCount = Math.max(1, Math.ceil(circumferenceRemainingCm.value / beadCm));
	return `还差 ${circumferenceRemainingCm.value.toFixed(1)}cm，按最近 ${latestSize}mm 规格约再加 ${recommendedCount} 颗`;
});
const finishButtonLabel = computed(() => {
	if (!canFinish.value) return contentStore.diy.selectHint;
	if (designStore.hasUnavailableParts) return '部分缺货';
	return entrySource.value === 'single' ? '完成选购' : contentStore.diy.finishLabel;
});
const unavailablePartNames = computed(() => {
	if (!designStore.hasUnavailableParts) return [];
	const names = designStore.braceletDesign
		.filter((bead) => /缺货|售罄|库存|镂空福球/.test(bead.name))
		.map((bead) => bead.name);
	const uniqueNames = Array.from(new Set(names));
	return uniqueNames.length ? uniqueNames : ['部分材质'];
});
const orderItemName = computed(() => {
	const count = designStore.braceletDesign.length;
	return entrySource.value === 'single' ? `单珠选购 · ${count}颗珠` : `定制手串 · ${count}颗珠`;
});
const functionMenuOpen = ref(false);
const viewMode = ref<'top' | 'side'>('side');
const shareTitle = computed(() => {
	if (!designStore.braceletDesign.length) return '珠岛｜从一颗珠子开始设计';
	return entrySource.value === 'single'
		? `我在珠岛挑了 ${designStore.braceletDesign.length} 颗水晶单珠`
		: `我在珠岛设计了 ${designStore.braceletDesign.length} 颗水晶手串`;
});
const shareImage = computed(() => designStore.braceletDesign.find((bead) => bead.image)?.image || '/static/tabbar/diy.png');
const shareSummary = computed(() => {
	if (!designStore.braceletDesign.length) {
		return '我正在珠岛设计水晶手串，来一起挑一串自己的光。';
	}
	const composition = getCompositionSummary();
	return `${shareTitle.value}，总价 ¥${designStore.totalPrice.toFixed(1)}。${composition ? `搭配：${composition}。` : ''}`;
});
const soundMuted = ref(true);
const inspirationMode = ref(false);
const inspirationLoading = ref(false);
const insufficientHintVisible = ref(false);
const insufficientToastVisible = ref(false);
const functionToastVisible = ref(false);
const braceletCodeOpen = ref(false);
const braceletCodeText = ref('');
const braceletCodeResolving = ref(false);
const braceletCodeResolution = ref<BraceletCodeResolution | null>(null);
const braceletCodeError = ref('');
const braceletCodeReplacements = ref<Record<number, number>>({});
const functionToastText = ref('');
const functionToastIcon = ref<'check' | 'play'>('check');
type DesignFeedbackKind = 'tap' | 'add' | 'play' | 'complete' | 'error';

// #ifdef H5
let designAudioContext: AudioContext | null = null;

function getDesignAudioContext() {
	if (typeof window === 'undefined') return null;
	const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioCtor) return null;
	if (!designAudioContext) designAudioContext = new AudioCtor();
	return designAudioContext;
}

function playH5DesignTone(kind: DesignFeedbackKind) {
	const ctx = getDesignAudioContext();
	if (!ctx) return;
	const presets: Record<DesignFeedbackKind, { from: number; to: number; gain: number; duration: number; type: OscillatorType }> = {
		tap: { from: 520, to: 640, gain: 0.032, duration: 0.07, type: 'sine' },
		add: { from: 620, to: 980, gain: 0.042, duration: 0.11, type: 'triangle' },
		play: { from: 680, to: 1180, gain: 0.038, duration: 0.13, type: 'sine' },
		complete: { from: 760, to: 1280, gain: 0.044, duration: 0.16, type: 'triangle' },
		error: { from: 260, to: 190, gain: 0.03, duration: 0.12, type: 'sine' },
	};
	const preset = presets[kind];
	const startAt = ctx.currentTime + 0.006;
	const endAt = startAt + preset.duration;
	const gain = ctx.createGain();
	const oscillator = ctx.createOscillator();
	oscillator.type = preset.type;
	oscillator.frequency.setValueAtTime(preset.from, startAt);
	oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, preset.to), endAt);
	gain.gain.setValueAtTime(0.0001, startAt);
	gain.gain.exponentialRampToValueAtTime(preset.gain, startAt + 0.018);
	gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
	oscillator.connect(gain);
	gain.connect(ctx.destination);
	const startTone = () => {
		oscillator.start(startAt);
		oscillator.stop(endAt + 0.02);
	};
	if (ctx.state === 'suspended') {
		ctx.resume().then(startTone).catch(() => undefined);
		return;
	}
	startTone();
}
// #endif

function playDesignFeedback(kind: DesignFeedbackKind = 'tap') {
	if (soundMuted.value) return;
	// #ifdef H5
	playH5DesignTone(kind);
	// #endif
	// #ifndef H5
	try {
		uni.vibrateShort?.({ type: kind === 'error' ? 'heavy' : 'light' } as unknown as UniApp.VibrateShortOptions);
	} catch {}
	// #endif
}

const designConfirmOpen = ref(false);
const designConfirmComposition = computed(() => beadsToComposition(designStore.braceletDesign));
const designConfirmMaterialRows = computed(() => designConfirmComposition.value.slice(0, 4));
const designConfirmPreviewBeads = computed(() => designStore.braceletDesign.slice(0, 18));
const designConfirmSummary = computed(() => getCompositionSummary() || '暂未选择材质');
const designConfirmTypeText = computed(() => (entrySource.value === 'single' ? '单珠选购' : '定制手串'));
const designConfirmTitle = computed(() => (entrySource.value === 'single' ? '确认单珠清单' : '确认这串设计'));
const designConfirmSizeText = computed(() =>
	entrySource.value === 'single'
		? `${beadCount.value} 颗珠`
		: `${beadCount.value} 颗珠 · 目标 ${targetCircumference.value.toFixed(1)}cm`,
);
const designConfirmMetaSecondText = computed(() =>
	entrySource.value === 'single'
		? `${designConfirmComposition.value.length} 种材质`
		: `预估 ${actualCircumference.value.toFixed(1)}cm`,
);
const designConfirmMiddleStatValue = computed(() =>
	entrySource.value === 'single' ? String(designConfirmComposition.value.length) : targetCircumference.value.toFixed(1),
);
const designConfirmMiddleStatLabel = computed(() => (entrySource.value === 'single' ? '材质' : '目标手围'));
const designConfirmNoteText = computed(() =>
	entrySource.value === 'single'
		? '单珠会按所选规格和数量打包，天然纹理、棉絮和色带以实物为准'
		: '下单后客服会核对库存、手围和实物色差，最终以确认结果为准',
);
const functionPanelCategories = computed(() => materialsStore.categories.slice(0, 5));
const hasMaterialSearchKeyword = computed(() => materialsStore.searchKeyword.trim().length > 0);
const showInUseMaterialTip = computed(
	() =>
		materialsStore.currentCategoryId === 'in-use' &&
		!hasMaterialSearchKeyword.value &&
		materialsStore.filteredMaterialSpecCards.length > 0,
);

watch(designConfirmOpen, (open) => {
	if (open) {
		hideDesignTabBar();
		return;
	}
	hideDesignTabBar();
});
type NoticeTabKey = 'tutorial' | 'purchase' | 'wrist' | 'size';

interface NoticePage {
	title: string;
	subtitle: string;
	visual: 'add' | 'press' | 'reorder' | 'delete' | 'info' | 'purchase' | 'measure' | 'size';
	points?: string[];
}

const noticeTabs: { key: NoticeTabKey; label: string }[] = [
	{ key: 'tutorial', label: '使用教程' },
	{ key: 'purchase', label: '购买须知' },
	{ key: 'wrist', label: '手围测量' },
	{ key: 'size', label: '珠子大小' },
];

const noticePages: Record<NoticeTabKey, NoticePage[]> = {
	tutorial: [
		{ title: '添加珠子', subtitle: '点击材料菜单中的珠子，将其添加至上方手串中', visual: 'add' },
		{ title: '查看实物图', subtitle: '长按珠子，查看珠子货品的实物图', visual: 'press' },
		{ title: '调整顺序', subtitle: '拖拽珠子到手串任意位置，以更换排列顺序', visual: 'reorder' },
		{ title: '删除珠子', subtitle: '拖拽珠子到圈外区域，即可删除珠子', visual: 'delete' },
		{ title: '界面信息', subtitle: '手串参数、保存、完成设计与材料栏都集中在设计页', visual: 'info' },
	],
	purchase: [
		{
			title: '购买须知',
			subtitle: '关于材质',
			visual: 'purchase',
			points: ['天然水晶纹理、棉絮、冰裂和色带存在个体差异', '页面价格按单颗规格累加，成品以客服最终确认为准', '手工制作会存在轻微尺寸误差'],
		},
		{
			title: '购买须知',
			subtitle: '关于工艺',
			visual: 'purchase',
			points: ['不同批次珠子颜色深浅和通透度会略有不同', '发晶、幽灵、胶花类纹理随机分布', '介意天然差异请谨慎下单'],
		},
		{
			title: '有关售后',
			subtitle: '珠岛定制手串退换政策',
			visual: 'purchase',
			points: ['天然水晶默认不支持无理由退换', '商品存在质量问题可及时联系处理', '定制款确认制作后不支持随意修改'],
		},
	],
	wrist: [
		{ title: '手围测量', subtitle: '方法一  软尺测量', visual: 'measure', points: ['将软尺绕手腕一圈，不要留有富余，不要拉紧', '女生平均手围为 15cm，男生平均手围为 17cm'] },
		{ title: '手围测量', subtitle: '方法二  直尺测量', visual: 'measure', points: ['取绳子环绕手腕一圈，不留富余，做好标记', '取直尺测量标记间绳子的长度，即为手围长度（单位厘米）'] },
		{ title: '手围测量', subtitle: '方法三  身高体重估计', visual: 'measure', points: ['表格为粗略估计，会有误差', '建议优先使用软尺或直尺方式测量'] },
	],
	size: [{ title: '珠子尺寸示意图', subtitle: '不同珠子直径的上手效果\n推荐手围 - 15mm', visual: 'size' }],
};

const noticeModalOpen = ref(false);
const activeNoticeTab = ref<NoticeTabKey>('tutorial');
const noticePageIndex = ref(0);
const currentNoticePages = computed(() => noticePages[activeNoticeTab.value]);
const currentNoticePage = computed(() => currentNoticePages.value[noticePageIndex.value] ?? currentNoticePages.value[0]);
const materialPreview = ref<{
	material: Material;
	spec: MaterialSpec;
	image: string;
} | null>(null);
const materialPreviewTitle = computed(() =>
	materialPreview.value ? `${materialPreview.value.material.name} ${materialPreview.value.spec.size}mm` : '',
);
const materialPreviewPrice = computed(() => (materialPreview.value ? `¥${materialPreview.value.spec.price} / 颗` : ''));

interface MaterialAddPayload {
	material: Material;
	spec: MaterialSpec;
	image: string;
	point: { x: number; y: number } | null;
}

interface BeadFlightState {
	id: number;
	image: string;
	sizePx: number;
	fromX: number;
	fromY: number;
	midX: number;
	midY: number;
	toX: number;
	toY: number;
}

interface RectLike {
	left: number;
	top: number;
	width: number;
	height: number;
}

const beadFlight = ref<BeadFlightState | null>(null);
const beadFlightStyle = computed(() => {
	const flight = beadFlight.value;
	if (!flight) return '';
	return [
		`--flight-size: ${flight.sizePx}px`,
		`--flight-from-x: ${flight.fromX}px`,
		`--flight-from-y: ${flight.fromY}px`,
		`--flight-mid-x: ${flight.midX}px`,
		`--flight-mid-y: ${flight.midY}px`,
		`--flight-to-x: ${flight.toX}px`,
		`--flight-to-y: ${flight.toY}px`,
	].join(';');
});

onLoad((query: Record<string, string | undefined>) => {
	syncEntrySource(query?.source);
});

onShareAppMessage(() => ({
	title: shareTitle.value,
	path: '/pages/design/design',
	imageUrl: shareImage.value,
}));

// 价格变动激活动画
const priceBump = ref(false);
// 珠子数量不足时“晃动”动画
const beadCountInsufficientShake = ref(false);
// 前一次的总价格，便于对比变化
const prevTotalPrice = ref<number | null>(null);

// 监听总价变化，触发价格bump动画
watch(
	() => designStore.totalPrice,
	(cur) => {
		if (prevTotalPrice.value !== null && prevTotalPrice.value !== cur) {
			priceBump.value = true;
			setTimeout(() => {
				priceBump.value = false;
			}, 420);
		}
		prevTotalPrice.value = cur;
	},
);

// 监听珠子数量不足，触发提示晃动动画
watch(
	() => isEffectiveBeadCountInsufficient.value,
	(is) => {
		if (is) {
			beadCountInsufficientShake.value = true;
			setTimeout(() => {
				beadCountInsufficientShake.value = false;
			}, 400);
		}
	},
);

watch(
	() => designStore.braceletDesign,
	() => {
		persistCurrentBracelet();
	},
	{ deep: true },
);

watch(
	() => designStore.lastBeadAction?.at,
	() => {
		const action = designStore.lastBeadAction;
		if (!action) {
			return;
		}
		if (action.type !== 'add') {
			return;
		}
		if (recentActionTimer) clearTimeout(recentActionTimer);
		const actionAt = action.at;
		recentActionTimer = setTimeout(() => {
			designStore.clearLastBeadAction(actionAt);
		}, 1500);
	},
);

function applyEntrySource(source?: string) {
	const previousSource = entrySource.value;
	entrySource.value = source === 'single' ? 'single' : 'bracelet';
	if (entrySource.value === 'single') {
		designStore.clearDesign();
		uiStore.setSelectedBeadId(null);
		functionMenuOpen.value = false;
		return;
	}
	const restored = restoreCurrentBraceletIfNeeded({ force: previousSource === 'single' });
	if (!restored && previousSource === 'single') {
		designStore.clearDesign();
		uiStore.setSelectedBeadId(null);
	}
}

function syncEntrySource(source?: string | null) {
	const hasExplicitSource = source === 'single' || source === 'bracelet';
	if (!hasExplicitSource && activeRouteSource.value) return;
	const normalized = source === 'single' ? 'single' : 'bracelet';
	if (activeRouteSource.value === normalized) return;
	activeRouteSource.value = normalized;
	applyEntrySource(normalized);
}

function switchEntrySource(target: DesignEntrySource) {
	if (target === entrySource.value) return;
	const currentCount = designStore.braceletDesign.length;
	const run = () => {
		if (target === 'single' && entrySource.value === 'bracelet') {
			persistCurrentBracelet();
		}
		activeRouteSource.value = target;
		rememberDesignEntrySource(target);
		applyEntrySource(target);
		syncTargetFromAppliedDesign();
		functionMenuOpen.value = false;
	};
	if (!currentCount) {
		run();
		return;
	}
	uni.showModal({
		title: target === 'single' ? '切换到单珠选购' : '切换到手串定制',
		content:
			target === 'single'
				? '当前手串会先保留为草稿，切到单珠后从空清单开始选择。'
				: '将恢复您之前的手串设计，当前单珠清单会被清空。',
		confirmText: '切换',
		confirmColor: '#527985',
		success: (res) => {
			if (res.confirm) run();
		},
	});
}

function readRouteSource() {
	if (typeof window !== 'undefined') {
		const queryText = window.location.hash.split('?')[1] || '';
		const source = new URLSearchParams(queryText).get('source') || undefined;
		if (source) return source;
	}
	try {
		const pages = getCurrentPages();
		const current = pages[pages.length - 1] as
			| {
					options?: Record<string, string | undefined>;
					$page?: { options?: Record<string, string | undefined> };
			  }
			| undefined;
		const source = current?.options?.source ?? current?.$page?.options?.source;
		if (source) return source;
	} catch {}
	try {
		const source = uni.getStorageSync(DESIGN_ENTRY_SOURCE_STORAGE_KEY);
		if (source) {
			uni.removeStorageSync(DESIGN_ENTRY_SOURCE_STORAGE_KEY);
			return String(source);
		}
	} catch {}
	return undefined;
}

function restoreDesignStateForCurrentSource() {
	if (entrySource.value !== 'bracelet') return;
	restoreDraftIfRequested();
	restoreCurrentBraceletIfNeeded();
}

function parseStoredBeads(raw: unknown) {
	try {
		const beads = typeof raw === 'string' ? JSON.parse(raw) : raw;
		if (!Array.isArray(beads)) return [];
		return beads
			.filter((bead) => bead?.materialId && bead?.name && Number.isFinite(Number(bead.size)) && Number.isFinite(Number(bead.price)))
			.map((bead) => ({
				materialId: String(bead.materialId),
				name: String(bead.name),
				image: bead.image ? String(bead.image) : '',
				size: Number(bead.size),
				price: Number(bead.price),
				quantity: 1,
			}));
	} catch {
		return [];
	}
}

function restoreCurrentBraceletIfNeeded(options: { force?: boolean } = {}) {
	if (entrySource.value !== 'bracelet') return false;
	if (!options.force && designStore.braceletDesign.length > 0) return false;
	const composition = parseStoredBeads(uni.getStorageSync(CURRENT_BRACELET_STORAGE_KEY));
	if (!composition.length) return false;
	designStore.applyDesignFromPlaza(composition, { source: 'saved' });
	uiStore.setSelectedBeadId(null);
	return true;
}

function persistCurrentBracelet() {
	if (entrySource.value !== 'bracelet') return;
	const list = designStore.braceletDesign;
	if (!list.length) {
		uni.removeStorageSync(CURRENT_BRACELET_STORAGE_KEY);
		return;
	}
	uni.setStorageSync(CURRENT_BRACELET_STORAGE_KEY, JSON.stringify(list));
}

function closeTransientDesignUi() {
	functionMenuOpen.value = false;
	wristSelectorOpen.value = false;
	designConfirmOpen.value = false;
	noticeModalOpen.value = false;
	materialPreview.value = null;
	insufficientHintVisible.value = false;
	insufficientToastVisible.value = false;
	if (insufficientHintTimer) clearTimeout(insufficientHintTimer);
	if (insufficientToastTimer) clearTimeout(insufficientToastTimer);
	uiStore.setSelectedBeadId(null);
}

function persistDraftForHomeReturn() {
	const list = designStore.braceletDesign;
	persistCurrentBracelet();
	if (!list.length) {
		uni.removeStorageSync(DRAFT_STORAGE_KEY);
		uni.removeStorageSync(DRAFT_RESTORE_KEY);
		return false;
	}
	uni.setStorageSync(DRAFT_STORAGE_KEY, JSON.stringify(list));
	uni.setStorageSync(DRAFT_RESTORE_KEY, '1');
	return true;
}

function goHomeFromDesign() {
	uni.showTabBar({ animation: false, fail: () => undefined });
	uni.switchTab({
		url: '/pages/home/home',
		fail: () => {
			uni.reLaunch({ url: '/pages/home/home' });
		},
	});
}

function onCapsuleSecondary() {
	const hasDraft = persistDraftForHomeReturn();
	clearEditingCartItem();
	closeTransientDesignUi();
	uni.showToast({ title: hasDraft ? '已暂存设计' : '已返回首页', icon: 'none' });
	setTimeout(goHomeFromDesign, hasDraft ? 260 : 120);
}

function onCapsuleCenter() {
	closeTransientDesignUi();
	viewMode.value = 'side';
	showFunctionToast('视图已居中', 'check');
	playDesignFeedback('tap');
}

function getCompositionSummary() {
	const groups = new Map<string, { name: string; size: number; count: number }>();
	for (const bead of designStore.braceletDesign) {
		const key = `${bead.materialId}-${bead.size}-${bead.price}`;
		const current = groups.get(key);
		if (current) {
			current.count += 1;
		} else {
			groups.set(key, { name: bead.name, size: bead.size, count: 1 });
		}
	}
	const list = Array.from(groups.values());
	const visible = list.slice(0, 4).map((item) => `${item.name}${item.size}mm×${item.count}`);
	return list.length > 4 ? `${visible.join('、')} 等` : visible.join('、');
}

function restoreDraftIfRequested() {
	const shouldRestore = !!uni.getStorageSync(DRAFT_RESTORE_KEY);
	if (!shouldRestore) return;
	uni.removeStorageSync(DRAFT_RESTORE_KEY);
	const draft = uni.getStorageSync(DRAFT_STORAGE_KEY);
	if (!draft) return;
	try {
		const beads = typeof draft === 'string' ? JSON.parse(draft) : draft;
		if (!Array.isArray(beads) || beads.length === 0) return;
		const composition = beadsToComposition(
			beads
				.filter((bead) => bead?.materialId && bead?.name && bead?.size && typeof bead.price === 'number')
				.map((bead, index) => ({
					id: bead.id || `bead-draft-${Date.now()}-${index}`,
					materialId: bead.materialId,
					name: bead.name,
					image: bead.image || '',
					size: Number(bead.size),
					price: Number(bead.price),
					quantity: 1,
					orderIndex: index,
				})),
		);
		if (!composition.length) return;
		designStore.applyDesignFromPlaza(composition, { source: 'draft' });
		uiStore.setSelectedBeadId(null);
		uni.showToast({ title: '已恢复草稿', icon: 'success' });
	} catch {
		uni.showToast({ title: '草稿不可用', icon: 'none' });
	}
}

function normalizeWristTarget(value: number) {
	const rounded = Math.round(value / WRIST_TARGET_STEP_CM) * WRIST_TARGET_STEP_CM;
	const clamped = Math.min(WRIST_TARGET_MAX_CM, Math.max(WRIST_TARGET_MIN_CM, rounded));
	return Number(clamped.toFixed(1));
}

function setTargetHandCircumference(value: number, options: { persist?: boolean } = { persist: true }) {
	targetHandCircumferenceCm.value = normalizeWristTarget(value);
	if (options.persist !== false) {
		uni.setStorageSync(TARGET_HAND_CIRCUMFERENCE_STORAGE_KEY, String(targetHandCircumferenceCm.value));
	}
}

function loadTargetHandCircumference() {
	const stored = Number(uni.getStorageSync(TARGET_HAND_CIRCUMFERENCE_STORAGE_KEY));
	if (Number.isFinite(stored) && stored > 0) {
		setTargetHandCircumference(stored, { persist: false });
	}
}

function syncTargetFromAppliedDesign() {
	const applied = designStore.handCircumferenceCm;
	if (typeof applied === 'number' && Number.isFinite(applied) && applied > 0) {
		setTargetHandCircumference(applied, { persist: false });
	}
}

function openWristSelector() {
	wristSelectorOpen.value = true;
}

function closeWristSelector() {
	wristSelectorOpen.value = false;
}

function selectWristTarget(value: number) {
	setTargetHandCircumference(value);
}

function adjustWristTarget(delta: number) {
	setTargetHandCircumference(targetHandCircumferenceCm.value + delta);
}

// “更多/重置”操作，清空手链设计
function onMoreReset() {
	if (designStore.braceletDesign.length === 0) return;
	uni.showModal({
		title: '重置设计',
		content: '确定清空当前设计？',
		success: (res) => {
			if (res.confirm) {
				designStore.clearDesign();
				uiStore.setSelectedBeadId(null);
				functionMenuOpen.value = false;
			}
		},
	});
}

// 删除操作，清空手链设计
function onDelete() {
	if (designStore.braceletDesign.length === 0) return;
	uni.showModal({
		title: '清空设计',
		content: '确定清空当前设计？',
		success: (res) => {
			if (res.confirm) {
				designStore.clearDesign();
				uiStore.setSelectedBeadId(null);
				functionMenuOpen.value = false;
			}
		},
	});
}

function toggleFunctionMenu() {
	functionMenuOpen.value = !functionMenuOpen.value;
}

function setDesignViewMode(mode: 'top' | 'side') {
	viewMode.value = mode;
	functionMenuOpen.value = false;
}

function closeFunctionMenu() {
	functionMenuOpen.value = false;
}

function onClearDesign() {
	closeFunctionMenu();
	onDelete();
}

function toggleSoundMuted() {
	soundMuted.value = !soundMuted.value;
	showFunctionToast(soundMuted.value ? '音效已关闭' : '音效已开启', 'check');
	if (!soundMuted.value) playDesignFeedback('tap');
}

function showFunctionToast(text: string, icon: 'check' | 'play' = 'check') {
	if (functionToastTimer) clearTimeout(functionToastTimer);
	functionToastText.value = text;
	functionToastIcon.value = icon;
	functionToastVisible.value = true;
	functionToastTimer = setTimeout(() => {
		functionToastVisible.value = false;
	}, 1800);
}

function onFunctionCategoryTap(categoryId: string) {
	materialsStore.setCategory(categoryId);
	closeFunctionMenu();
	playDesignFeedback('tap');
}

function openInUseCategory() {
	if (!beadCount.value) return;
	materialsStore.setCategory('in-use');
	closeFunctionMenu();
}

async function onInspirationMode() {
	if (inspirationLoading.value) return;
	inspirationLoading.value = true;
	try {
		const inspiration = await api.useRandomInspiration();
		let exactApplied = false;
		if (inspiration.braceletCode) {
			const resolved = await api.resolveBraceletCode(inspiration.braceletCode);
			if (resolved.valid) {
				designStore.applyOrderedBeads(resolved.beads.filter(Boolean) as ResolvedBraceletBead[], {
					source: 'inspiration', handCircumferenceCm: resolved.payload.wristCm,
				});
				exactApplied = true;
			}
		}
		if (!exactApplied) {
			designStore.applyDesignFromPlaza(inspiration.composition, {
				source: 'inspiration', handCircumferenceCm: inspiration.wristCm,
			});
		}
		clearEditingSavedDesign();
		uiStore.setSelectedBeadId(null);
		inspirationMode.value = true;
		syncTargetFromAppliedDesign();
		closeFunctionMenu();
		showFunctionToast(`灵感 · ${inspiration.title}`, 'play');
		playDesignFeedback('play');
	} catch (error: any) {
		uni.showToast({ title: error?.message || '暂时没有可用灵感', icon: 'none' });
	} finally {
		inspirationLoading.value = false;
	}
}

async function onImportDesign() {
	closeFunctionMenu();
	if (!savedDesignsStore.loaded) {
		await savedDesignsStore.fetchList();
	}
	const list = savedDesignsStore.list;
	if (!list.length) {
		const draft = uni.getStorageSync(DRAFT_STORAGE_KEY);
		if (!draft) {
			uni.showToast({ title: '暂无可导入设计', icon: 'none' });
			return;
		}
		try {
			const beads = JSON.parse(draft);
			if (!Array.isArray(beads) || !beads.length) throw new Error('empty draft');
				designStore.applyDesignFromPlaza(
					beads.map((b) => ({
					materialId: b.materialId,
					name: b.name,
					image: b.image,
					size: b.size,
					price: b.price,
					quantity: 1,
				})),
					{ source: 'draft' },
				);
				clearEditingSavedDesign();
				uni.showToast({ title: '已导入草稿', icon: 'success' });
			} catch {
			uni.showToast({ title: '草稿不可用', icon: 'none' });
		}
		return;
	}
	uni.showActionSheet({
		itemList: list.slice(0, 6).map((item) => item.title),
		success: (res) => {
			const item = list[res.tapIndex];
			if (!item) return;
			const beads = savedDesignsStore.getBeadsForDesign(item.id);
			if (!beads.length) return;
				designStore.applyDesignFromPlaza(
					beads.map((b) => ({
					materialId: b.materialId,
					name: b.name,
					image: b.image,
					size: b.size,
					price: b.price,
					quantity: 1,
				})),
					{ source: 'saved' },
				);
				clearEditingSavedDesign();
				uni.showToast({ title: '已导入设计', icon: 'success' });
			},
	});
}

const braceletCodeOptions = computed(() =>
	materialsStore.materials.flatMap((material) =>
		material.specs
			.filter((spec) => spec.specId)
			.map((spec) => ({
				label: `${material.name} · ${spec.size}mm · ¥${spec.price}`,
				materialId: material.id,
				specId: spec.specId as string,
				name: material.name,
				image: material.image,
				size: spec.size,
				price: spec.price,
			})),
	),
);
const braceletCodeOptionLabels = computed(() => braceletCodeOptions.value.map((option) => option.label));
const resolvedCodeBeads = computed(() => {
	if (!braceletCodeResolution.value) return [];
	return braceletCodeResolution.value.beads.map((bead, index) => {
		if (bead) return bead;
		const replacementIndex = braceletCodeReplacements.value[index];
		const replacement = braceletCodeOptions.value[replacementIndex];
		if (!replacement) return null;
		return { index, originalMaterialId: braceletCodeResolution.value!.payload.beads[index].materialId, available: true, ...replacement } as ResolvedBraceletBead;
	});
});
const canConfirmBraceletCode = computed(() => !!braceletCodeResolution.value && resolvedCodeBeads.value.length > 0 && resolvedCodeBeads.value.every(Boolean));

function openBraceletCodeImport() {
	closeFunctionMenu();
	braceletCodeOpen.value = true;
	braceletCodeText.value = '';
	braceletCodeResolution.value = null;
	braceletCodeReplacements.value = {};
	braceletCodeError.value = '';
}

function closeBraceletCodeImport() {
	if (braceletCodeResolving.value) return;
	braceletCodeOpen.value = false;
}

async function resolveBraceletCode() {
	const code = braceletCodeText.value.trim();
	if (!code) {
		braceletCodeError.value = '请先粘贴手串代码';
		return;
	}
	braceletCodeResolving.value = true;
	braceletCodeError.value = '';
	try {
		if (!materialsStore.loaded) await materialsStore.fetchFromApi();
		braceletCodeResolution.value = await api.resolveBraceletCode(code);
		braceletCodeReplacements.value = {};
	} catch {
		braceletCodeResolution.value = null;
		braceletCodeError.value = '代码无法解析，请检查是否复制完整';
	} finally {
		braceletCodeResolving.value = false;
	}
}

function onBraceletReplacementChange(beadIndex: number, event: { detail?: { value?: string | number } }) {
	const value = Number(event.detail?.value ?? -1);
	if (value < 0) return;
	braceletCodeReplacements.value = { ...braceletCodeReplacements.value, [beadIndex]: value };
}

function braceletCodeReplacementLabel(index: number) {
	const optionIndex = braceletCodeReplacements.value[index];
	return braceletCodeOptions.value[optionIndex]?.label || '选择替代水晶珠';
}

function braceletCodePreviewStyle(index: number, count: number) {
	const angle = -Math.PI / 2 + (index / Math.max(1, count)) * Math.PI * 2;
	return { transform: `translate(${Math.cos(angle) * 112}rpx, ${Math.sin(angle) * 112}rpx)` };
}

function confirmBraceletCodeImport() {
	if (!braceletCodeResolution.value || !canConfirmBraceletCode.value) return;
	designStore.applyOrderedBeads(resolvedCodeBeads.value.filter(Boolean) as ResolvedBraceletBead[], {
		source: 'draft',
		handCircumferenceCm: braceletCodeResolution.value.payload.wristCm,
		hasUnavailableParts: false,
	});
	uiStore.setSelectedBeadId(null);
	braceletCodeOpen.value = false;
	uni.showToast({ title: '手串代码已导入', icon: 'success' });
}

function onShareDesign() {
	closeFunctionMenu();
	if (!designStore.braceletDesign.length) {
		uni.showModal({
			title: '分享设计',
			content: '先添加几颗珠子，再分享你的手串设计。',
			showCancel: false,
		});
		return;
	}
	// #ifdef MP-WEIXIN
	uni.showShareMenu({ withShareTicket: true });
	// #endif
	uni.setClipboardData({
		data: shareSummary.value,
		success: () => {
			uni.showModal({
				title: '分享设计',
				content: '分享文案已复制。小程序端可继续使用右上角菜单发送给朋友。',
				showCancel: false,
			});
		},
		fail: () => {
			uni.showModal({
				title: '分享设计',
				content: shareSummary.value,
				showCancel: false,
			});
		},
	});
}

async function saveCurrentDesignToList() {
	if (designStore.braceletDesign.length === 0) {
		uni.showToast({ title: '请至少添加一颗珠子', icon: 'none' });
		return false;
	}
	uni.setStorageSync(DRAFT_STORAGE_KEY, JSON.stringify(designStore.braceletDesign));
	if (!savedDesignsStore.loaded) {
		await savedDesignsStore.fetchList();
	}
	const editingSavedDesignId = readEditingSavedDesignId();
	if (editingSavedDesignId) {
		const currentSavedDesign = savedDesignsStore.get(editingSavedDesignId);
		if (currentSavedDesign) {
			const updated = savedDesignsStore.update(editingSavedDesignId, designStore.braceletDesign);
			if (updated) {
				uni.removeStorageSync(DRAFT_STORAGE_KEY);
				uni.removeStorageSync(DRAFT_RESTORE_KEY);
				uni.showToast({ title: '已更新我的设计', icon: 'success' });
				return true;
			}
		}
		clearEditingSavedDesign();
	}
	const title = `我的设计 ${new Date().toLocaleDateString('zh-CN')}`;
	const saved = savedDesignsStore.add(title, designStore.braceletDesign);
	if (!saved) {
		uni.showToast({ title: '设计槽位已满', icon: 'none' });
		return false;
	}
	uni.removeStorageSync(DRAFT_STORAGE_KEY);
	uni.removeStorageSync(DRAFT_RESTORE_KEY);
	uni.showToast({ title: '已保存到我的设计', icon: 'success' });
	return true;
}

// 源小程序底部红色“保存”会进入「我的设计」，同时保留草稿兜底。
async function onSave() {
	if (await saveCurrentDesignToList()) await offerInspirationSubmission();
}

// 导航菜单中的保存入口复用同一套保存语义
async function onSaveToList() {
	if (await saveCurrentDesignToList()) await offerInspirationSubmission();
}

function showModal(options: Parameters<typeof uni.showModal>[0]) {
	return new Promise<UniApp.ShowModalRes>((resolve) => {
		uni.showModal({ ...options, success: resolve, fail: () => resolve({ confirm: false, cancel: true } as UniApp.ShowModalRes) });
	});
}

function currentOrderedBeads() {
	return designStore.braceletDesign.flatMap((bead) => {
		const material = materialsStore.materials.find((item) => item.id === bead.materialId);
		const specId = bead.specId || material?.specs.find((spec) => spec.size === bead.size && spec.price === bead.price)?.specId;
		return specId ? [{ materialId: bead.materialId, specId }] : [];
	});
}

async function offerInspirationSubmission() {
	const decision = await showModal({
		title: '加入灵感岛？',
		content: '投稿后会进入作品审核，通过后其他岛民就能看到并使用这套设计。',
		confirmText: '加入',
		cancelText: '暂不',
	});
	if (!decision.confirm) return;
	const naming = await showModal({
		title: '给作品取个名字',
		content: '',
		editable: true,
		placeholderText: '例如：雾蓝潮汐',
		confirmText: '提交审核',
	});
	const title = String(naming.content || '').trim();
	if (!naming.confirm) return;
	if (!title) {
		uni.showToast({ title: '请输入作品名', icon: 'none' });
		return;
	}
	const orderedBeads = currentOrderedBeads();
	if (orderedBeads.length !== designStore.braceletDesign.length) {
		uni.showToast({ title: '部分珠子规格无法复现，暂不能投稿', icon: 'none' });
		return;
	}
	uni.showLoading({ title: '提交作品中' });
	try {
		await api.submitInspiration({
			title,
			author: '岛民',
			composition: beadsToComposition(designStore.braceletDesign),
			orderedBeads,
			wristCm: targetCircumference.value,
		});
		uni.showToast({ title: '已提交，等待审核', icon: 'success' });
	} catch (error: any) {
		uni.showToast({ title: error?.message || '提交失败，请稍后重试', icon: 'none' });
	} finally {
		uni.hideLoading();
	}
}

// 完成设计，校验输入和显示警告
function onFinish() {
	if (!canFinish.value) {
		uni.showToast({ title: '请至少添加一颗珠子', icon: 'none' });
		return;
	}
	if (designStore.hasUnavailableParts) {
		showUnavailablePartsModal();
		return;
	}
	if (entrySource.value !== 'single' && isEffectiveBeadCountInsufficient.value) {
		showInsufficientHint();
		return;
	}
	openDesignConfirm();
}

function showUnavailablePartsModal() {
	playDesignFeedback('error');
	const parts = unavailablePartNames.value.map((name) => `${name}（缺货）`).join('\n');
	uni.showModal({
		title: '',
		content: `十分抱歉！以下材质已售罄或库存不足，当前无法进行购买，请尝试更换它们。\n\n* 您仍可以点击左上角返回键保存您的设计，我们将尽快为您进行补货\n\n${parts}`,
		confirmText: '好的',
		showCancel: false,
	});
}

function showInsufficientHint() {
	playDesignFeedback('error');
	if (insufficientHintTimer) clearTimeout(insufficientHintTimer);
	if (insufficientToastTimer) clearTimeout(insufficientToastTimer);
	insufficientToastVisible.value = false;
	insufficientHintVisible.value = true;
	beadCountInsufficientShake.value = true;
	setTimeout(() => {
		beadCountInsufficientShake.value = false;
	}, 400);
	insufficientHintTimer = setTimeout(() => {
		insufficientHintVisible.value = false;
	}, 2800);
}

function showInsufficientToast() {
	if (!isEffectiveBeadCountInsufficient.value) return;
	if (insufficientToastTimer) clearTimeout(insufficientToastTimer);
	if (insufficientHintTimer) clearTimeout(insufficientHintTimer);
	insufficientHintVisible.value = false;
	insufficientToastVisible.value = true;
	beadCountInsufficientShake.value = true;
	setTimeout(() => {
		beadCountInsufficientShake.value = false;
	}, 400);
	insufficientToastTimer = setTimeout(() => {
		insufficientToastVisible.value = false;
	}, 2600);
}

function openWristNoticeFromHint() {
	if (insufficientHintTimer) clearTimeout(insufficientHintTimer);
	if (insufficientToastTimer) clearTimeout(insufficientToastTimer);
	insufficientHintVisible.value = false;
	insufficientToastVisible.value = false;
	functionMenuOpen.value = false;
	activeNoticeTab.value = 'wrist';
	noticePageIndex.value = 0;
	noticeModalOpen.value = true;
}

function openWristSelectorFromToast() {
	if (insufficientToastTimer) clearTimeout(insufficientToastTimer);
	insufficientToastVisible.value = false;
	openWristSelector();
}

function openDesignConfirm() {
	functionMenuOpen.value = false;
	designConfirmOpen.value = true;
	playDesignFeedback('complete');
}

function closeDesignConfirm() {
	designConfirmOpen.value = false;
}

function designConfirmBeadStyle(index: number, total: number) {
	const count = Math.max(total, 1);
	const angle = index * (360 / count);
	return {
		transform: `rotate(${angle}deg) translateX(68rpx) rotate(${-angle}deg)`,
	};
}

function buildDesignCartItem(): CartItem | null {
	const currentDesign = designStore.braceletDesign;
	if (!currentDesign.length) return null;
	const composition = designConfirmComposition.value.length ? designConfirmComposition.value : beadsToComposition(currentDesign);
	const beadCount = compositionBeadCount(composition);
	const isSingleMode = entrySource.value === 'single';
	return {
		id: `cart-design-${Date.now()}`,
		name: isSingleMode ? `单珠选购 · ${beadCount}颗珠` : orderItemName.value,
		image: currentDesign.find((bead) => bead.image)?.image || '',
		price: Number(designStore.totalPrice.toFixed(1)),
		qty: 1,
		type: isSingleMode ? '单珠选购' : '定制设计',
		...(isSingleMode
			? {}
			: {
					handCircumferenceCm: targetCircumference.value,
					estimatedCircumferenceCm: actualCircumference.value,
		}),
		composition,
	};
}

function updateEditingCartItem(item: CartItem) {
	const editingCartItemId = readEditingCartItemId();
	if (!editingCartItemId) return false;
	const cartItems = loadLocalCartItems();
	const index = cartItems.findIndex((cartItem) => cartItem.id === editingCartItemId);
	if (index < 0) {
		clearEditingCartItem();
		return false;
	}
	const previous = cartItems[index];
	cartItems[index] = {
		...item,
		id: previous.id,
		qty: Number(previous.qty || 1),
	};
	saveLocalCartItems(cartItems);
	clearEditingCartItem();
	return true;
}

function goOrder(mode: 'cart' | 'checkout' = 'cart') {
	const item = buildDesignCartItem();
	if (!item) return;
	if (mode === 'checkout') {
		clearEditingCartItem();
		saveCheckoutDraft('buy-now', [item], [item.id]);
		closeDesignConfirm();
		uni.showTabBar({ animation: false, fail: () => undefined });
		uni.navigateTo({ url: '/pages/checkout/checkout' });
		return;
	}
	const updatedCartItem = updateEditingCartItem(item);
	if (!updatedCartItem) {
		addLocalCartItems([item]);
	}
	closeDesignConfirm();
	uni.showToast({ title: updatedCartItem ? '已更新购物车' : '已加入购物车', icon: 'success' });
	setTimeout(() => {
		uni.showTabBar({ animation: false, fail: () => undefined });
		uni.switchTab({ url: '/pages/cart/cart' });
	}, 450);
}

function confirmDesignToCart() {
	goOrder('cart');
}

function confirmDesignCheckout() {
	goOrder('checkout');
}

function onNotice() {
	functionMenuOpen.value = false;
	activeNoticeTab.value = 'tutorial';
	noticePageIndex.value = 0;
	noticeModalOpen.value = true;
}

function closeNoticeModal() {
	noticeModalOpen.value = false;
}

function switchNoticeTab(tab: NoticeTabKey) {
	activeNoticeTab.value = tab;
	noticePageIndex.value = 0;
}

function prevNoticePage() {
	if (noticePageIndex.value > 0) {
		noticePageIndex.value -= 1;
	}
}

function nextNoticePage() {
	if (noticePageIndex.value < currentNoticePages.value.length - 1) {
		noticePageIndex.value += 1;
	}
}

function openMaterialPreview(payload: { material: Material; spec: MaterialSpec; image: string }) {
	materialPreview.value = payload;
}

function openBeadPreview(beadId: string) {
	const bead = designStore.braceletDesign.find((item) => item.id === beadId);
	if (!bead) return;
	functionMenuOpen.value = false;
	const material =
		materialsStore.materials.find((item) => item.id === bead.materialId) ??
		({
			id: bead.materialId,
			name: bead.name,
			image: bead.image,
			categoryId: 'custom',
			specs: [{ size: bead.size, price: bead.price }],
		} satisfies Material);
	const spec = material.specs.find((item) => item.size === bead.size && item.price === bead.price) ?? {
		size: bead.size,
		price: bead.price,
	};
	materialPreview.value = {
		material,
		spec,
		image: bead.image || material.image,
	};
}

function getViewportSize() {
	if (typeof window !== 'undefined') {
		return { width: window.innerWidth, height: window.innerHeight };
	}
	try {
		const info = uni.getWindowInfo?.();
		if (info?.windowWidth && info?.windowHeight) return { width: info.windowWidth, height: info.windowHeight };
	} catch {}
	return { width: 375, height: 812 };
}

function getCanvasRect(callback: (rect: RectLike | null) => void) {
	if (typeof document !== 'undefined') {
		const el = document.querySelector('.canvas-section');
		if (el) {
			const rect = el.getBoundingClientRect();
			callback({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
			return;
		}
	}
	try {
		uni.createSelectorQuery()
			.select('.canvas-section')
			.boundingClientRect((rect) => {
				const candidate = Array.isArray(rect) ? rect[0] : rect;
				if (
					candidate &&
					Number.isFinite(Number(candidate.left)) &&
					Number.isFinite(Number(candidate.top)) &&
					Number.isFinite(Number(candidate.width)) &&
					Number.isFinite(Number(candidate.height))
				) {
					callback({
						left: Number(candidate.left),
						top: Number(candidate.top),
						width: Number(candidate.width),
						height: Number(candidate.height),
					});
					return;
				}
				callback(null);
			})
			.exec();
	} catch {
		callback(null);
	}
}

function getFlightTarget(rect: RectLike | null, sizePx: number) {
	const viewport = getViewportSize();
	const frame = rect ?? {
		left: 0,
		top: Math.round(viewport.height * 0.18),
		width: viewport.width,
		height: Math.round(viewport.height * 0.48),
	};
	const total = Math.max(1, designStore.braceletDesign.length);
	const index = Math.max(0, total - 1);
	const angle = BEAD_FLIGHT_START_ANGLE + (index / total) * Math.PI * 2;
	const centerX = frame.left + frame.width / 2;
	const centerY = frame.top + frame.height / 2;
	const radius = Math.min(frame.width, frame.height) * (0.23 + Math.min(total, 18) * 0.004);
	return {
		x: centerX + Math.cos(angle) * radius - sizePx / 2,
		y: centerY + Math.sin(angle) * radius - sizePx / 2,
	};
}

function onMaterialAdd(payload: MaterialAddPayload) {
	playDesignFeedback('add');
	const viewport = getViewportSize();
	const sizePx = Math.round(Math.max(30, Math.min(54, payload.spec.size * 4.2)));
	const start = payload.point ?? {
		x: viewport.width * 0.5,
		y: viewport.height * 0.82,
	};
	getCanvasRect((rect) => {
		const target = getFlightTarget(rect, sizePx);
		const fromX = start.x - sizePx / 2;
		const fromY = start.y - sizePx / 2;
		const arcLift = Math.max(68, Math.abs(fromY - target.y) * 0.22);
		const midX = (fromX + target.x) / 2;
		const midY = Math.min(fromY, target.y) - arcLift;
		if (beadFlightTimer) clearTimeout(beadFlightTimer);
		beadFlight.value = {
			id: Date.now(),
			image: payload.image,
			sizePx,
			fromX,
			fromY,
			midX,
			midY,
			toX: target.x,
			toY: target.y,
		};
		beadFlightTimer = setTimeout(() => {
			beadFlight.value = null;
		}, 680);
	});
}

function closeMaterialPreview() {
	materialPreview.value = null;
}

function clearMaterialSearch() {
	materialsStore.setSearchKeyword('');
}

function onMaterialToolTap() {
	if (!designStore.braceletDesign.length) {
		uni.showToast({ title: '先添加珠子', icon: 'none' });
		return;
	}
	materialsStore.setSearchKeyword('');
	materialsStore.setCategory('in-use');
	uni.showToast({ title: '已切到正在使用', icon: 'none' });
}

function onHelp() {
	onNotice();
}

function hideDesignTabBar() {
	uni.hideTabBar({ animation: false, fail: () => undefined });
}

</script>

<template>
	<view
		class="page app-subpage design-page"
		:class="{
			'page--inspiration': inspirationMode,
			'page--loading': !loadingReady,
			'page--ready': loadingReady,
			'page--confirm-open': designConfirmOpen,
		}"
	>
		<!-- 顶部自定义导航栏，含重置按钮 -->
		<NavigationBar
			@share="onShareDesign"
			@reset="onMoreReset"
			@save-to-list="onSaveToList"
			@help="onHelp"
			@secondary="onCapsuleSecondary"
			@center="onCapsuleCenter"
		/>
		<view v-if="!loadingReady" class="loading-screen">
			<view class="loading-content">
				<view class="loading-ring" />
				<view class="loading-row">
					<text class="loading-title">{{ loadingTitle }}</text>
					<text class="loading-percent">{{ loadingProgress }}%</text>
				</view>
				<view class="loading-track">
					<view class="loading-fill" :style="{ width: `${loadingProgress}%` }" />
				</view>
				<text class="loading-subtitle">正在为您准备设计页面，请稍候...</text>
			</view>
		</view>
		<template v-else>
		<!-- 顶部信息区：玻璃卡片 -->
		<view class="info-section">
			<view class="info-tags">
				<view class="info-tags__left">
					<view class="mode-switch" aria-label="DIY模式">
						<view
							v-for="option in modeOptions"
							:key="option.id"
							class="mode-switch__item"
							:class="{ 'mode-switch__item--active': entrySource === option.id }"
							@tap="switchEntrySource(option.id)"
						>
							{{ option.label }}
						</view>
					</view>
					<view class="info-tag-wrap" @tap="onNotice">
						<InfoTag type="notice" :label="contentStore.diy.noticeLabel" />
					</view>
				</view>
				<view class="info-tags__right">
					<view
						v-if="isEffectiveBeadCountInsufficient"
						class="info-tag-wrap info-tag-wrap--warn"
						@tap="showInsufficientToast"
					>
						<InfoTag
							type="warn"
							label="珠子数量不足"
							:shake="beadCountInsufficientShake"
						/>
					</view>
					<view v-else-if="canFinish && entrySource === 'bracelet'" class="info-tag-wrap" @tap="openWristSelector">
						<InfoTag :label="handCircumferenceText" />
					</view>
					<view v-else-if="canFinish" class="info-tag-wrap">
						<InfoTag :label="singleSelectionText" />
					</view>
					<view class="price-tag-wrap" :class="{ 'price-tag-wrap--bump': priceBump }">
						<InfoTag :label="totalPriceText" />
					</view>
				</view>
			</view>
		</view>
		<!-- 中部画布区：手链设计效果图 -->
		<view class="canvas-section">
			<view class="canvas-card">
				<BraceletCanvas ref="braceletCanvasRef" :view-mode="viewMode" :mode="entrySource" @bead-preview="openBeadPreview" />
				<view class="view-mode-toggle">
					<view
						class="view-mode-button"
						:class="{ 'view-mode-button--active': viewMode === 'top' }"
						aria-label="俯视"
						title="俯视"
						@tap.stop="setDesignViewMode('top')"
					>
						<BrandIcon
							class="view-mode-icon"
							name="circle-dot"
							:tone="viewMode === 'top' ? 'inverse' : 'muted'"
						/>
					</view>
					<view
						class="view-mode-button"
						:class="{ 'view-mode-button--active': viewMode === 'side' }"
						aria-label="侧视"
						title="侧视"
						@tap.stop="setDesignViewMode('side')"
					>
						<BrandIcon
							class="view-mode-icon"
							name="rotate-3d"
							:tone="viewMode === 'side' ? 'inverse' : 'muted'"
						/>
					</view>
				</view>
				<view class="growth-panel" :class="{ 'growth-panel--complete': canFinish && !isEffectiveBeadCountInsufficient }">
					<view class="growth-panel__copy">
						<text class="growth-panel__eyebrow">成串进度</text>
						<text class="growth-panel__title">{{ growthStageTitle }}</text>
						<text class="growth-panel__sub">{{ growthStageSub }}</text>
						<text v-if="latestBeadFeedback" :key="`recent-${beadCount}`" class="growth-panel__recent">
							最近 · {{ latestBeadFeedback.name }} {{ latestBeadFeedback.sizeText }}
						</text>
					</view>
					<view class="growth-panel__meter">
						<view class="growth-panel__track">
							<view class="growth-panel__fill" :style="{ width: `${circumferenceProgress}%` }" />
						</view>
						<text class="growth-panel__value">{{ circumferenceProgress }}%</text>
						<view class="growth-panel__target" @tap.stop="entrySource === 'bracelet' && openWristSelector()">
							{{ growthTargetText }}
						</view>
					</view>
				</view>
			</view>
		</view>
		<!-- 底部操作区和材料选择区 -->
		<view class="bottom-section">
			<!-- 操作按钮行：初始只展示功能与选珠提示，加珠后展示保存与完成设计 -->
			<view class="action-row">
				<view class="action-row__left">
					<view class="function-menu-wrap" :class="{ 'function-menu-wrap--open': functionMenuOpen }">
						<ActionButton
							type="delete"
							icon="layers-3"
							:icon-tone="functionMenuOpen ? 'inverse' : 'brand'"
							label="功能"
							@click="toggleFunctionMenu"
						/>
					</view>
					<ActionButton type="delete" icon="wand-sparkles" :label="inspirationLoading ? '寻找中' : '灵感'" :disabled="inspirationLoading" @click="onInspirationMode" />
					<ActionButton v-if="showSaveAction" type="save" icon="save" :label="contentStore.diy.saveLabel" @click="onSave" />
				</view>
				<view class="action-row__spacer" />
				<view class="action-row__right">
					<ActionButton
						type="primary"
						:tone="designStore.hasUnavailableParts ? 'danger' : 'default'"
						:icon="entrySource === 'single' ? 'single' : 'cart'"
						:label="finishButtonLabel"
						:disabled="!canFinish"
						@click="onFinish"
					/>
				</view>
			</view>
			<!-- 材料选择区 -->
			<view class="material-panel">
				<template v-if="functionMenuOpen">
					<view class="function-panel">
						<view class="function-panel__side">
							<view class="function-panel__tab function-panel__tab--active">功能</view>
							<view
								v-for="category in functionPanelCategories"
								:key="category.id"
								class="function-panel__tab"
								@tap="onFunctionCategoryTap(category.id)"
							>
								{{ category.name }}
							</view>
						</view>
						<view class="function-panel__cards">
							<view class="function-card" :class="{ 'function-card--muted': soundMuted }" @tap="toggleSoundMuted">
								<BrandIcon class="function-card__icon" :name="soundMuted ? 'volume-x' : 'volume-2'" :tone="soundMuted ? 'muted' : 'brand'" />
								<text class="function-card__label">{{ soundMuted ? '开启音效' : '关闭音效' }}</text>
							</view>
							<view class="function-card" @tap="onClearDesign">
								<BrandIcon class="function-card__icon" name="trash-2" />
								<text class="function-card__label">清空设计</text>
							</view>
							<view class="function-card" @tap="onImportDesign">
								<BrandIcon class="function-card__icon" name="file-down" />
								<text class="function-card__label">导入设计</text>
							</view>
							<view class="function-card" @tap="openBraceletCodeImport">
								<BrandIcon class="function-card__icon" name="file-down" />
								<text class="function-card__label">手串代码</text>
							</view>
							<view class="function-card" @tap="onShareDesign">
								<BrandIcon class="function-card__icon" name="share-2" />
								<text class="function-card__label">分享设计</text>
							</view>
							<view class="function-card" :class="{ 'function-card--active': inspirationMode }" @tap="onInspirationMode">
								<BrandIcon class="function-card__icon" name="wand-sparkles" />
								<text class="function-card__label">随机灵感</text>
							</view>
						</view>
					</view>
				</template>
				<template v-else>
					<view v-if="refillSuggestionText" class="refill-suggestion" @tap="openInUseCategory">
						<view class="refill-suggestion__dot" />
						<view class="refill-suggestion__copy">
							<text class="refill-suggestion__title">继续补珠即可成串</text>
							<text class="refill-suggestion__text">{{ refillSuggestionText }}</text>
						</view>
						<text class="refill-suggestion__action">查看已用</text>
					</view>
					<!-- 搜索框 -->
					<MaterialSearch @tool="onMaterialToolTap" />
					<view class="material-body">
						<!-- 左侧材料分类 -->
						<MaterialCategoryList />
						<!-- 右侧材料列表，滚动容器 -->
						<scroll-view class="material-grid-wrap" scroll-y>
							<view v-if="materialsStore.filteredMaterialSpecCards.length" class="material-grid">
								<!-- 单个材料卡片，支持动画 -->
								<view v-for="item in materialsStore.filteredMaterialSpecCards" :key="item.id" class="material-grid-item">
										<MaterialCard
											:material="item.material"
											:spec="item.spec"
											:used-count="item.usedCount"
											@add="onMaterialAdd"
											@preview="openMaterialPreview"
										/>
									</view>
							</view>
							<view v-if="showInUseMaterialTip" class="in-use-tip">长按珠子选择区域查看实物图哦！ v2.0.6</view>
							<view v-if="!materialsStore.filteredMaterialSpecCards.length" class="material-empty">
								<view class="material-empty__icon"><BrandIcon name="search" tone="muted" /></view>
								<view class="material-empty__title">没有找到相关珠子</view>
								<view class="material-empty__text">
									{{ hasMaterialSearchKeyword ? '换个材质名或尺寸试试' : '当前分类暂无可用珠子' }}
								</view>
								<view v-if="hasMaterialSearchKeyword" class="material-empty__action" @tap="clearMaterialSearch">清空搜索</view>
							</view>
						</scroll-view>
					</view>
				</template>
			</view>
			</view>
			</template>
			<view v-if="beadFlight" :key="beadFlight.id" class="bead-flight" :style="beadFlightStyle">
				<view class="bead-flight__shadow" />
				<image v-if="beadFlight.image" class="bead-flight__img" :src="beadFlight.image" mode="aspectFill" />
				<view v-else class="bead-flight__fallback" />
			</view>
			<view v-if="designConfirmOpen" class="design-confirm-mask" @tap="closeDesignConfirm">
				<view class="design-confirm-sheet" @tap.stop>
					<view class="design-confirm-grip" />
					<view class="design-confirm-head">
						<view>
							<view class="design-confirm-eyebrow">{{ designConfirmTypeText }}</view>
							<view class="design-confirm-title">{{ designConfirmTitle }}</view>
						</view>
						<view class="design-confirm-close" aria-label="关闭" @tap="closeDesignConfirm"><BrandIcon name="x" tone="muted" /></view>
					</view>

					<view class="design-confirm-card">
						<view class="design-confirm-preview">
							<view class="design-confirm-ring">
								<image
									v-for="(bead, index) in designConfirmPreviewBeads"
									:key="`${bead.id}-${index}`"
									class="design-confirm-bead"
									:src="bead.image"
									mode="aspectFill"
									:style="designConfirmBeadStyle(index, designConfirmPreviewBeads.length)"
								/>
								<view class="design-confirm-logo">珠岛</view>
							</view>
						</view>
						<view class="design-confirm-copy">
							<view class="design-confirm-name">{{ orderItemName }}</view>
							<view class="design-confirm-summary">{{ designConfirmSummary }}</view>
							<view class="design-confirm-meta">
								<text>{{ designConfirmSizeText }}</text>
								<text>{{ designConfirmMetaSecondText }}</text>
							</view>
						</view>
					</view>

					<view class="design-confirm-stats">
						<view class="design-confirm-stat">
							<text class="design-confirm-stat__value">{{ beadCount }}</text>
							<text class="design-confirm-stat__label">珠子</text>
						</view>
						<view class="design-confirm-stat">
							<text class="design-confirm-stat__value">{{ designConfirmMiddleStatValue }}</text>
							<text class="design-confirm-stat__label">{{ designConfirmMiddleStatLabel }}</text>
						</view>
						<view class="design-confirm-stat">
							<text class="design-confirm-stat__value price">¥{{ designStore.totalPrice.toFixed(1) }}</text>
							<text class="design-confirm-stat__label">预估价</text>
						</view>
					</view>

					<view class="design-confirm-materials">
						<view class="design-confirm-section-title">主要材质</view>
						<view class="design-confirm-material-list">
							<view v-for="row in designConfirmMaterialRows" :key="`${row.materialId}-${row.size}-${row.price}`" class="design-confirm-material">
								<image class="design-confirm-material__img" :src="row.image" mode="aspectFill" />
								<view class="design-confirm-material__body">
									<text class="design-confirm-material__name">{{ row.name }}</text>
									<text class="design-confirm-material__spec">{{ row.size }}mm · {{ row.quantity }}颗 · ¥{{ row.amount.toFixed(1) }}</text>
								</view>
							</view>
						</view>
					</view>

					<view class="design-confirm-note">
						<view class="design-confirm-note__dot" />
						<text>{{ designConfirmNoteText }}</text>
					</view>

					<view class="design-confirm-actions">
						<button class="design-confirm-btn ghost" @tap="confirmDesignToCart">加入购物车</button>
						<button class="design-confirm-btn" @tap="confirmDesignCheckout">立即结算</button>
					</view>
				</view>
			</view>
			<view v-if="braceletCodeOpen" class="bracelet-code-overlay" @tap="closeBraceletCodeImport">
				<view class="bracelet-code-sheet" @tap.stop>
					<view class="bracelet-code-head">
						<view><text class="bracelet-code-eyebrow">DIY 复现</text><text class="bracelet-code-title">粘贴手串代码</text></view>
						<view class="bracelet-code-close" @tap="closeBraceletCodeImport"><BrandIcon name="x" tone="muted" /></view>
					</view>
					<textarea v-model="braceletCodeText" class="bracelet-code-input" maxlength="-1" placeholder="ZD1.eyJ2IjoxLC4uLg.1234abcd" :disabled="braceletCodeResolving" />
					<view v-if="braceletCodeError" class="bracelet-code-error">{{ braceletCodeError }}</view>
					<view class="bracelet-code-parse" :class="{ 'bracelet-code-parse--loading': braceletCodeResolving }" @tap="resolveBraceletCode">
						{{ braceletCodeResolving ? '正在解析…' : '解析并预览' }}
					</view>

					<template v-if="braceletCodeResolution">
						<view class="bracelet-code-summary">
							<view class="bracelet-code-ring">
								<image v-for="(bead, index) in resolvedCodeBeads" :key="index" v-show="bead" class="bracelet-code-bead" :src="bead?.image" mode="aspectFill" :style="braceletCodePreviewStyle(index, resolvedCodeBeads.length)" />
								<view class="bracelet-code-ring__center"><text>{{ braceletCodeResolution.payload.wristCm }}cm</text><text>{{ braceletCodeResolution.payload.beads.length }}颗</text></view>
							</view>
							<view class="bracelet-code-stats">
								<view><text>预计价格</text><strong>¥{{ resolvedCodeBeads.reduce((sum, bead) => sum + (bead?.price || 0), 0).toFixed(1) }}</strong></view>
								<view><text>代码版本</text><strong>ZD1</strong></view>
								<view><text>替代映射</text><strong>{{ braceletCodeResolution.substitutions.length }}</strong></view>
							</view>
						</view>
						<view v-if="braceletCodeResolution.missing.length" class="bracelet-code-missing">
							<text class="bracelet-code-missing__title">{{ braceletCodeResolution.missing.length }} 颗素材需要替换</text>
							<view v-for="missing in braceletCodeResolution.missing" :key="missing.index" class="bracelet-code-missing__row">
								<view><text>第 {{ missing.index + 1 }} 颗 · {{ missing.reason }}</text><small>{{ missing.materialId }}</small></view>
								<picker mode="selector" :range="braceletCodeOptionLabels" :value="braceletCodeReplacements[missing.index] ?? 0" @change="onBraceletReplacementChange(missing.index, $event)">
									<view class="bracelet-code-replacement">{{ braceletCodeReplacementLabel(missing.index) }}</view>
								</picker>
							</view>
						</view>
						<view class="bracelet-code-confirm" :class="{ 'bracelet-code-confirm--disabled': !canConfirmBraceletCode }" @tap="confirmBraceletCodeImport">确认导入到 DIY</view>
					</template>
				</view>
			</view>
			<view v-if="materialPreview" class="actual-photo-overlay" @tap="closeMaterialPreview">
			<view class="actual-photo-dialog" @tap.stop>
				<view class="actual-photo-header">
					<view class="actual-photo-heading">
						<text class="actual-photo-eyebrow">本批次货品实物图</text>
						<text class="actual-photo-title">{{ materialPreviewTitle }}</text>
					</view>
					<view class="actual-photo-close" aria-label="关闭" @tap="closeMaterialPreview"><BrandIcon name="x" tone="muted" /></view>
				</view>
				<view class="actual-photo-frame">
					<image v-if="materialPreview.image" class="actual-photo-img" :src="materialPreview.image" mode="aspectFit" />
					<view class="actual-photo-gloss" />
				</view>
				<view class="actual-photo-info">
					<view class="actual-photo-row">
						<text class="actual-photo-label">材质</text>
						<text class="actual-photo-value">{{ materialPreview.material.name }}</text>
					</view>
					<view class="actual-photo-row">
						<text class="actual-photo-label">规格</text>
						<text class="actual-photo-value">{{ materialPreview.spec.size }}mm</text>
					</view>
					<view class="actual-photo-row">
						<text class="actual-photo-label">单价</text>
						<text class="actual-photo-value actual-photo-value--price">{{ materialPreviewPrice }}</text>
					</view>
				</view>
				<view class="actual-photo-note">天然纹理、棉絮和色带以实物为准</view>
			</view>
		</view>
		<view v-if="insufficientHintVisible" class="insufficient-hint" @tap="openWristNoticeFromHint">
			<BrandIcon class="insufficient-hint__icon" name="triangle-alert" tone="rose" />
			<view class="insufficient-hint__copy">
				<text class="insufficient-hint__title">手串尺寸偏小</text>
				<text class="insufficient-hint__line">{{ insufficientDetailText }}</text>
				<text class="insufficient-hint__line">点击查看手围测量说明</text>
			</view>
		</view>
		<view v-if="insufficientToastVisible" class="insufficient-toast" @tap="openWristSelectorFromToast">
			<BrandIcon class="insufficient-toast__icon" name="triangle-alert" tone="rose" />
			<view class="insufficient-toast__copy">
				<text class="insufficient-toast__title">手串尺寸偏小</text>
				<text class="insufficient-toast__line">{{ insufficientDetailText }}</text>
				<text class="insufficient-toast__line">继续加珠或点此调整目标手围</text>
			</view>
		</view>
		<view v-if="functionToastVisible" class="function-toast">
			<view class="function-toast__icon">
				<BrandIcon :name="functionToastIcon === 'play' ? 'play' : 'circle-check'" tone="inverse" />
			</view>
			<text class="function-toast__text">{{ functionToastText }}</text>
		</view>
		<view v-if="wristSelectorOpen" class="wrist-target-overlay" @tap="closeWristSelector">
			<view class="wrist-target-sheet" @tap.stop>
				<view class="wrist-target-header">
					<view>
						<text class="wrist-target-eyebrow">目标手围</text>
						<text class="wrist-target-title">{{ targetCircumference.toFixed(1) }}cm</text>
					</view>
					<view class="wrist-target-close" aria-label="关闭" @tap="closeWristSelector"><BrandIcon name="x" tone="muted" /></view>
				</view>
				<view class="wrist-target-stepper">
					<view class="wrist-target-stepper__btn" aria-label="减小手围" @tap="adjustWristTarget(-WRIST_TARGET_STEP_CM)"><BrandIcon name="minus" /></view>
					<view class="wrist-target-stepper__value">
						<text>{{ targetCircumference.toFixed(1) }}</text>
						<text>cm</text>
					</view>
					<view class="wrist-target-stepper__btn" aria-label="增大手围" @tap="adjustWristTarget(WRIST_TARGET_STEP_CM)"><BrandIcon name="plus" /></view>
				</view>
				<view class="wrist-target-options">
					<view
						v-for="option in wristTargetOptions"
						:key="option"
						class="wrist-target-option"
						:class="{ 'wrist-target-option--active': option === targetCircumference }"
						@tap="selectWristTarget(option)"
					>
						{{ option.toFixed(1) }}cm
					</view>
				</view>
				<view class="wrist-target-summary">
					<text>当前手串 {{ actualCircumference.toFixed(1) }}cm</text>
					<text>{{ circumferenceRemainingText }}</text>
				</view>
				<view class="wrist-target-done" @tap="closeWristSelector">完成</view>
			</view>
		</view>
		<view v-if="noticeModalOpen" class="notice-overlay" @tap="closeNoticeModal">
			<view class="notice-dialog" @tap.stop>
				<view class="notice-tabs">
					<view
						v-for="tab in noticeTabs"
						:key="tab.key"
						class="notice-tab"
						:class="{ 'notice-tab--active': activeNoticeTab === tab.key }"
						@tap="switchNoticeTab(tab.key)"
					>
						{{ tab.label }}
					</view>
				</view>
				<view class="notice-close" aria-label="关闭" @tap="closeNoticeModal"><BrandIcon name="x" tone="muted" /></view>
				<view
					class="notice-content"
					:class="{ 'notice-content--tutorial': activeNoticeTab === 'tutorial', 'notice-content--poster': activeNoticeTab !== 'tutorial' }"
				>
					<template v-if="activeNoticeTab === 'tutorial'">
						<view class="notice-poster" :class="`notice-poster--${currentNoticePage.visual}`">
							<view class="notice-poster__watermark notice-poster__watermark--one">珠岛</view>
							<view class="notice-poster__watermark notice-poster__watermark--two">ZHUDAO</view>
							<view class="notice-poster__scene">
								<view class="poster-phone">
									<view class="poster-phone__top">
										<text>ZHUDAO</text>
									</view>
									<view class="poster-phone__ring">
										<view
											v-for="item in 14"
											:key="item"
											class="poster-phone__bead"
											:class="{
												'poster-phone__bead--add': currentNoticePage.visual === 'add' && item === 9,
												'poster-phone__bead--drag': currentNoticePage.visual === 'reorder' && item === 5,
												'poster-phone__bead--delete': currentNoticePage.visual === 'delete' && item === 12,
												'poster-phone__bead--info': currentNoticePage.visual === 'info' && item === 2,
											}"
										/>
										<view v-if="currentNoticePage.visual === 'info'" class="poster-callout poster-callout--top">手串参数</view>
											<view v-if="currentNoticePage.visual === 'info'" class="poster-callout poster-callout--left">{{ contentStore.diy.saveLabel }}</view>
											<view v-if="currentNoticePage.visual === 'info'" class="poster-callout poster-callout--right">{{ contentStore.diy.finishLabel }}</view>
										<view v-if="currentNoticePage.visual === 'press'" class="poster-photo">
											<view class="poster-photo__title">本批次货品实物图</view>
											<view class="poster-photo__img" />
										</view>
									</view>
									<view class="poster-phone__materials">
										<view class="poster-phone__category">白水晶</view>
										<view class="poster-phone__card" :class="{ 'poster-phone__card--target': currentNoticePage.visual === 'add' || currentNoticePage.visual === 'press' }">
											<view class="poster-phone__card-bead" />
											<text>白水晶</text>
										</view>
										<view class="poster-phone__card">
											<view class="poster-phone__card-bead" />
											<text>白水晶</text>
										</view>
										<view class="poster-phone__card">
											<view class="poster-phone__card-bead" />
											<text>白水晶</text>
										</view>
									</view>
									<view v-if="currentNoticePage.visual === 'add'" class="poster-guide-label poster-guide-label--category">点击切换类别</view>
									<view v-if="currentNoticePage.visual === 'add'" class="poster-guide-label poster-guide-label--select">点击选择珠子</view>
									<view v-if="currentNoticePage.visual === 'press'" class="poster-guide-label poster-guide-label--press">长按查看实物图</view>
									<view v-if="currentNoticePage.visual === 'reorder'" class="poster-guide-label poster-guide-label--drag">拖拽调整顺序</view>
									<view v-if="currentNoticePage.visual === 'delete'" class="poster-guide-label poster-guide-label--delete">拖至圈外删除</view>
									<view v-if="currentNoticePage.visual === 'add' || currentNoticePage.visual === 'press'" class="poster-finger" />
									<view v-if="currentNoticePage.visual === 'delete'" class="poster-delete-zone" />
								</view>
							</view>
							<view class="notice-poster__copy">
								<text class="notice-poster__title">{{ currentNoticePage.title }}</text>
								<text class="notice-poster__subtitle">{{ currentNoticePage.subtitle }}</text>
							</view>
						</view>
					</template>
					<template v-else>
						<view v-if="activeNoticeTab === 'purchase'" class="notice-info-poster" :class="{ 'notice-info-poster--after-sale': noticePageIndex === 2 }">
							<view class="notice-info-poster__bg" />
							<view v-if="noticePageIndex < 2" class="purchase-note-card">
								<text class="purchase-note-card__title">{{ currentNoticePage.title }}</text>
								<text class="purchase-note-card__subtitle">· {{ currentNoticePage.subtitle }}</text>
								<view class="purchase-note-card__points">
									<text v-for="(point, index) in currentNoticePage.points" :key="point" class="purchase-note-card__point">{{ index + 1 }}. {{ point }}</text>
								</view>
							</view>
							<view v-else class="after-sale-card">
								<text class="after-sale-card__headline">有关售后</text>
								<text class="after-sale-card__subhead">{{ currentNoticePage.subtitle }}</text>
								<view class="after-sale-card__rule">
									<text class="after-sale-card__tag">无法退换</text>
									<text>天然水晶默认不支持无理由退换，定制款确认后进入制作流程。</text>
								</view>
								<view class="after-sale-card__rule">
									<text class="after-sale-card__tag">可退范围</text>
									<text>未发货、实物货不符、质量问题等情况请及时联系客服。</text>
								</view>
								<view class="after-sale-card__rule">
									<text class="after-sale-card__tag">维修服务</text>
									<text>订单一年内可提供基础维护，具体以客服沟通为准。</text>
								</view>
								<view class="after-sale-card__character" />
							</view>
						</view>
						<view v-else-if="activeNoticeTab === 'wrist'" class="wrist-guide-poster" :class="`wrist-guide-poster--${noticePageIndex}`">
							<view class="notice-poster__watermark notice-poster__watermark--one">珠岛</view>
							<view class="wrist-guide-poster__header">
								<text class="wrist-guide-poster__title">{{ currentNoticePage.title }}</text>
								<text class="wrist-guide-poster__subtitle">{{ currentNoticePage.subtitle }}</text>
							</view>
							<view v-if="noticePageIndex === 0" class="wrist-soft-demo">
								<view class="wrist-soft-demo__hand" />
								<view class="wrist-soft-demo__tape" />
							</view>
							<view v-else-if="noticePageIndex === 1" class="wrist-ruler-demo">
								<view class="wrist-ruler-demo__wrap" />
								<view class="wrist-ruler-demo__ruler" />
								<view class="wrist-ruler-demo__hand" />
							</view>
							<view v-else class="wrist-table-demo">
								<view class="wrist-table-demo__grid">
									<text v-for="cell in 72" :key="cell" class="wrist-table-demo__cell">{{ cell % 8 === 1 ? (145 + Math.floor(cell / 8) * 5) : cell % 3 === 0 ? '15.5' : '' }}</text>
								</view>
								<text class="wrist-table-demo__note">（粗略估计，有误差）</text>
							</view>
							<view class="wrist-guide-poster__points">
								<text v-for="point in currentNoticePage.points" :key="point" class="wrist-guide-poster__point">· {{ point }}</text>
							</view>
						</view>
						<view v-else class="bead-size-poster">
							<view class="notice-poster__watermark notice-poster__watermark--two">珠岛</view>
							<view class="bead-size-poster__header">
								<text class="bead-size-poster__title">{{ currentNoticePage.title }}</text>
								<text class="bead-size-poster__subtitle">{{ currentNoticePage.subtitle }}</text>
							</view>
							<view class="bead-size-poster__hands">
								<view class="bead-size-poster__item">
									<text class="bead-size-poster__label">8mm</text>
									<view class="bead-size-poster__hand bead-size-poster__hand--small">
										<view class="bead-size-poster__bracelet" />
									</view>
								</view>
								<view class="bead-size-poster__item">
									<text class="bead-size-poster__label">10mm</text>
									<view class="bead-size-poster__hand bead-size-poster__hand--medium">
										<view class="bead-size-poster__bracelet" />
									</view>
								</view>
								<view class="bead-size-poster__item">
									<text class="bead-size-poster__label">12mm</text>
									<view class="bead-size-poster__hand bead-size-poster__hand--large">
										<view class="bead-size-poster__bracelet" />
									</view>
								</view>
							</view>
						</view>
					</template>
				</view>
				<view class="notice-pager">
					<view class="notice-page-btn" :class="{ 'notice-page-btn--hidden': noticePageIndex === 0 }" @tap="prevNoticePage">上一页</view>
					<text class="notice-page-count">{{ noticePageIndex + 1 }} / {{ currentNoticePages.length }}</text>
					<view
						class="notice-page-btn"
						:class="{ 'notice-page-btn--hidden': noticePageIndex >= currentNoticePages.length - 1 }"
						@tap="nextNoticePage"
					>
						下一页
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

// 页面整体
.page {
	height: 100vh;
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: column;
	background: linear-gradient(180deg, #fffdf9 0%, #faf8f5 48%, #f3f0ec 100%);
	padding-bottom: env(safe-area-inset-bottom);
	overflow: hidden;
}

/* #ifdef H5 */
:global(uni-page-body:has(> .design-page)) {
	height: 100vh;
	padding-bottom: 0 !important;
	overflow: hidden;
}

:global(body:has(uni-page-body > .design-page)) {
	overflow: hidden !important;
}

:global(uni-app:has(.design-page.page--confirm-open) uni-tabbar),
:global(uni-app:has(.design-page.page--confirm-open) .uni-tabbar-bottom) {
	display: none !important;
	pointer-events: none !important;
}
/* #endif */

.page::before,
.page::after {
	content: '';
	position: absolute;
	pointer-events: none;
	z-index: -1;
}

.page::before {
	display: none;
}

.page::after {
	display: none;
}

.page--loading {
	background: #fff;
}

.actual-photo-overlay {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 90;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 36rpx;
	box-sizing: border-box;
	background: rgba(0, 0, 0, 0.5);
	animation: actual-photo-fade-in 0.16s ease-out both;
}

.actual-photo-dialog {
	width: 660rpx;
	max-width: 100%;
	border-radius: 24rpx;
	overflow: hidden;
	background: #fff;
	box-shadow: 0 30rpx 80rpx rgba(0, 0, 0, 0.25);
	animation: actual-photo-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.actual-photo-header {
	position: relative;
	min-height: 116rpx;
	padding: 28rpx 84rpx 22rpx 34rpx;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	border-bottom: 1rpx solid rgba(226, 229, 238, 0.96);
}

.actual-photo-heading {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.actual-photo-eyebrow {
	color: #a45b5e;
	font-size: 23rpx;
	font-weight: 900;
	line-height: 1.1;
}

.actual-photo-title {
	color: #171c29;
	font-size: 34rpx;
	font-weight: 900;
	line-height: 1.15;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.actual-photo-close {
	position: absolute;
	top: 30rpx;
	right: 28rpx;
	width: 44rpx;
	height: 44rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 8rpx;
	box-sizing: border-box;
}

.actual-photo-frame {
	position: relative;
	height: 500rpx;
	margin: 26rpx 34rpx 0;
	border-radius: 20rpx;
	overflow: hidden;
	background:
		radial-gradient(circle at 36% 20%, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0) 34%),
		linear-gradient(135deg, #f5f0eb 0%, #f8f8fb 48%, #eceff5 100%);
	box-shadow:
		inset 0 0 0 1rpx rgba(223, 226, 235, 0.88),
		0 12rpx 28rpx rgba(65, 72, 96, 0.1);
	display: flex;
	align-items: center;
	justify-content: center;
}

.actual-photo-img {
	width: 76%;
	height: 76%;
	filter: drop-shadow(0 20rpx 30rpx rgba(62, 70, 92, 0.18));
}

.actual-photo-gloss {
	position: absolute;
	left: 12%;
	right: 12%;
	top: 16%;
	height: 26%;
	border-radius: 50%;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.46), rgba(255, 255, 255, 0));
	pointer-events: none;
}

.actual-photo-info {
	margin: 24rpx 34rpx 0;
	border-radius: 18rpx;
	background: #f7f8fb;
	border: 1rpx solid rgba(228, 231, 239, 0.92);
	overflow: hidden;
}

.actual-photo-row {
	min-height: 62rpx;
	padding: 0 22rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	border-bottom: 1rpx solid rgba(228, 231, 239, 0.88);
}

.actual-photo-row:last-child {
	border-bottom: none;
}

.actual-photo-label {
	color: #858c9d;
	font-size: 24rpx;
	font-weight: 800;
}

.actual-photo-value {
	color: #202637;
	font-size: 25rpx;
	font-weight: 900;
	text-align: right;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.actual-photo-value--price {
	color: #527985;
}

.actual-photo-note {
	margin: 22rpx 34rpx 32rpx;
	color: #7b8292;
	font-size: 23rpx;
	font-weight: 700;
	line-height: 1.35;
	text-align: center;
}

.insufficient-hint {
	position: fixed;
	left: 50%;
	top: 154rpx;
	z-index: 34;
	width: 620rpx;
	min-height: 118rpx;
	padding: 18rpx 24rpx;
	border-radius: 10rpx;
	background: rgba(255, 255, 255, 0.96);
	box-shadow: 0 10rpx 28rpx rgba(34, 39, 54, 0.18);
	box-sizing: border-box;
	display: flex;
	align-items: center;
	gap: 18rpx;
	transform: translateX(-50%);
	animation: insufficient-hint-in 2.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.insufficient-hint__icon {
	width: 32rpx;
	height: 32rpx;
	flex-shrink: 0;
}

.insufficient-hint__copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.insufficient-hint__title {
	color: #202329;
	font-size: 30rpx;
	font-weight: 900;
	line-height: 1.2;
}

.insufficient-hint__line {
	margin-top: 4rpx;
	color: #202329;
	font-size: 24rpx;
	font-weight: 700;
	line-height: 1.25;
}

.insufficient-toast {
	position: fixed;
	left: 50%;
	top: 142rpx;
	z-index: 35;
	width: 640rpx;
	min-height: 116rpx;
	padding: 17rpx 22rpx;
	border-radius: 10rpx;
	background: rgba(255, 255, 255, 0.98);
	box-shadow: 0 10rpx 26rpx rgba(35, 39, 52, 0.18);
	box-sizing: border-box;
	display: flex;
	align-items: center;
	gap: 16rpx;
	transform: translateX(-50%);
	animation: insufficient-toast-in 2.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.insufficient-toast::before {
	content: '';
	position: absolute;
	left: 50%;
	top: -12rpx;
	width: 24rpx;
	height: 24rpx;
	margin-left: -12rpx;
	background: rgba(255, 255, 255, 0.98);
	box-shadow: -4rpx -4rpx 10rpx rgba(35, 39, 52, 0.04);
	transform: rotate(45deg);
}

.insufficient-toast__icon {
	z-index: 1;
	width: 32rpx;
	height: 32rpx;
	flex-shrink: 0;
}

.insufficient-toast__copy {
	position: relative;
	z-index: 1;
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 3rpx;
	text-align: center;
}

.insufficient-toast__title {
	color: #202329;
	font-size: 27rpx;
	font-weight: 900;
	line-height: 1.18;
}

.insufficient-toast__line {
	color: #2b3141;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.32;
}

.function-toast {
	position: fixed;
	left: 50%;
	top: 112rpx;
	z-index: 36;
	min-width: 228rpx;
	height: 72rpx;
	padding: 0 24rpx;
	border-radius: 12rpx;
	background: rgba(255, 255, 255, 0.98);
	box-shadow: 0 10rpx 28rpx rgba(35, 39, 52, 0.16);
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 13rpx;
	transform: translateX(-50%);
	animation: function-toast-in 1.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.function-toast__icon {
	width: 32rpx;
	height: 32rpx;
	border-radius: 50%;
	flex-shrink: 0;
	background: #2fd36a;
	box-shadow: 0 5rpx 10rpx rgba(38, 185, 91, 0.24);
}

.function-toast__text {
	color: #242832;
	font-size: 27rpx;
	font-weight: 800;
	line-height: 1;
	white-space: nowrap;
}

.wrist-target-overlay {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 72;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	background: rgba(20, 24, 34, 0.38);
	animation: notice-fade-in 0.16s ease-out both;
}

.wrist-target-sheet {
	width: 100%;
	padding: 28rpx 30rpx calc(32rpx + env(safe-area-inset-bottom));
	border-radius: 30rpx 30rpx 0 0;
	background: #fff;
	box-shadow: 0 -18rpx 60rpx rgba(25, 30, 44, 0.2);
	box-sizing: border-box;
	animation: bottom-sheet-in 0.26s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.wrist-target-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24rpx;
}

.wrist-target-eyebrow,
.wrist-target-title {
	display: block;
	line-height: 1.1;
}

.wrist-target-eyebrow {
	color: #8a91a3;
	font-size: 24rpx;
	font-weight: 900;
}

.wrist-target-title {
	margin-top: 8rpx;
	color: #365760;
	font-size: 50rpx;
	font-weight: 900;
}

.wrist-target-close {
	width: 52rpx;
	height: 52rpx;
	border-radius: 50%;
	background: #f2f4f8;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 12rpx;
	box-sizing: border-box;
}

.wrist-target-stepper {
	margin-top: 26rpx;
	height: 96rpx;
	display: grid;
	grid-template-columns: 92rpx 1fr 92rpx;
	align-items: center;
	border-radius: 20rpx;
	background: #f6f8fb;
	border: 1rpx solid rgba(226, 231, 241, 0.95);
	overflow: hidden;
}

.wrist-target-stepper__btn {
	height: 96rpx;
	background: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 30rpx;
	box-sizing: border-box;
}

.wrist-target-stepper__btn:active,
.wrist-target-option:active,
.wrist-target-done:active,
.wrist-target-close:active {
	transform: scale(0.97);
}

.wrist-target-stepper__value {
	display: flex;
	align-items: baseline;
	justify-content: center;
	gap: 8rpx;
	color: #365760;
	font-weight: 900;
}

.wrist-target-stepper__value text:first-child {
	font-size: 46rpx;
}

.wrist-target-stepper__value text:last-child {
	color: #7b8396;
	font-size: 24rpx;
}

.wrist-target-options {
	margin-top: 24rpx;
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 14rpx;
}

.wrist-target-option {
	height: 58rpx;
	border-radius: 999rpx;
	background: #f5f7fb;
	border: 1rpx solid rgba(224, 229, 240, 0.96);
	color: #5e6678;
	font-size: 24rpx;
	font-weight: 900;
	line-height: 56rpx;
	text-align: center;
}

.wrist-target-option--active {
	background: #527985;
	border-color: #527985;
	color: #fff;
	box-shadow: 0 10rpx 22rpx rgba(82, 121, 133, 0.2);
}

.wrist-target-summary {
	margin-top: 22rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
	padding: 0 4rpx;
	color: #7b8396;
	font-size: 23rpx;
	font-weight: 800;
}

.wrist-target-summary text:last-child {
	color: #527985;
}

.wrist-target-done {
	margin-top: 28rpx;
	height: 76rpx;
	border-radius: 18rpx;
	background: #1f2638;
	color: #fff;
	font-size: 28rpx;
	font-weight: 900;
	line-height: 76rpx;
	text-align: center;
	box-shadow: 0 12rpx 28rpx rgba(31, 38, 56, 0.18);
}

.notice-overlay {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 80;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 30rpx;
	background: rgba(0, 0, 0, 0.46);
	box-sizing: border-box;
	animation: notice-fade-in 0.18s ease-out both;
}

.notice-dialog {
	position: relative;
	width: 704rpx;
	max-width: 100%;
	max-height: 74vh;
	border-radius: 22rpx;
	background: #fff;
	box-shadow: 0 28rpx 70rpx rgba(0, 0, 0, 0.22);
	overflow: hidden;
	animation: notice-dialog-in 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.notice-tabs {
	height: 118rpx;
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 14rpx;
	align-items: center;
	padding: 28rpx 60rpx 24rpx 60rpx;
	box-sizing: border-box;
	border-bottom: 3rpx solid #1f2635;
}

.notice-tab {
	height: 64rpx;
	border-radius: 8rpx;
	background: #eff0f5;
	color: #242d42;
	font-size: 25rpx;
	font-weight: 800;
	display: flex;
	align-items: center;
	justify-content: center;
	white-space: nowrap;
	transition:
		background u.$duration-state u.$ease-brand,
		color u.$duration-state u.$ease-brand,
		transform u.$duration-press u.$ease-out;
}

.notice-tab--active {
	background: #527985;
	color: #fff;
	box-shadow: 0 10rpx 22rpx rgba(82, 121, 133, 0.2);
}

.notice-tab:active {
	transform: scale(0.97);
}

.notice-close {
	position: absolute;
	top: 20rpx;
	right: 20rpx;
	width: 36rpx;
	height: 36rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 6rpx;
	box-sizing: border-box;
	z-index: 2;
}

.notice-content {
	position: relative;
	min-height: 560rpx;
	padding: 24rpx 54rpx 18rpx;
	box-sizing: border-box;
	background:
		linear-gradient(135deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.98)),
		repeating-linear-gradient(45deg, transparent 0 40rpx, rgba(30, 36, 52, 0.035) 40rpx 42rpx);
}

.notice-content--tutorial {
	min-height: 560rpx;
	padding: 0;
	background: #fff;
	overflow: hidden;
}

.notice-content--poster {
	min-height: 560rpx;
	padding: 0;
	background: #fff;
	overflow: hidden;
}

.notice-poster {
	position: relative;
	height: 560rpx;
	padding: 28rpx 42rpx 22rpx;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: space-between;
	background:
		radial-gradient(circle at 20% 18%, rgba(232, 236, 244, 0.45), transparent 30%),
		radial-gradient(circle at 78% 68%, rgba(232, 236, 244, 0.42), transparent 34%),
		#fff;
}

.notice-poster::before,
.notice-poster::after {
	content: '珠岛';
	position: absolute;
	color: rgba(24, 30, 45, 0.045);
	font-size: 58rpx;
	font-weight: 900;
	letter-spacing: 8rpx;
	transform: rotate(-28deg);
	pointer-events: none;
}

.notice-poster::before {
	left: 76rpx;
	top: 108rpx;
}

.notice-poster::after {
	right: 56rpx;
	bottom: 120rpx;
}

.notice-poster__watermark {
	position: absolute;
	color: rgba(24, 30, 45, 0.035);
	font-weight: 900;
	pointer-events: none;
}

.notice-poster__watermark--one {
	left: 70rpx;
	bottom: 210rpx;
	font-size: 46rpx;
	writing-mode: vertical-rl;
	letter-spacing: 7rpx;
}

.notice-poster__watermark--two {
	right: 76rpx;
	top: 120rpx;
	font-size: 30rpx;
	transform: rotate(28deg);
}

.notice-poster__scene {
	position: relative;
	z-index: 1;
	width: 100%;
	height: 356rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.notice-poster__copy {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	min-height: 118rpx;
}

.notice-poster__title {
	color: #090b10;
	font-size: 46rpx;
	font-weight: 900;
	line-height: 1.12;
	letter-spacing: 0;
}

.notice-poster__subtitle {
	margin-top: 12rpx;
	max-width: 530rpx;
	color: #1b2030;
	font-size: 25rpx;
	font-weight: 900;
	line-height: 1.32;
	white-space: pre-line;
}

.notice-poster--add .notice-poster__copy,
.notice-poster--press .notice-poster__copy {
	order: -1;
	margin-bottom: 6rpx;
}

.notice-poster--add .notice-poster__scene,
.notice-poster--press .notice-poster__scene {
	height: 392rpx;
}

.notice-poster--info .notice-poster__copy {
	align-self: flex-start;
	margin-left: 38rpx;
	writing-mode: vertical-rl;
	min-height: 270rpx;
	justify-content: center;
}

.notice-poster--info .notice-poster__title {
	font-size: 44rpx;
	letter-spacing: 6rpx;
}

.notice-poster--info .notice-poster__subtitle {
	display: none;
}

.notice-poster--info .notice-poster__scene {
	position: absolute;
	right: 30rpx;
	top: 32rpx;
	width: 470rpx;
	height: 470rpx;
}

.poster-phone {
	position: relative;
	width: 520rpx;
	height: 330rpx;
	border-radius: 4rpx;
	background: rgba(255, 255, 255, 0.9);
	box-shadow: inset 0 0 0 2rpx rgba(232, 235, 242, 0.86);
	overflow: hidden;
}

.notice-poster--add .poster-phone,
.notice-poster--press .poster-phone {
	height: 350rpx;
}

.notice-poster--info .poster-phone {
	width: 430rpx;
	height: 438rpx;
}

.poster-phone__top {
	height: 34rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #11151f;
	font-size: 18rpx;
	font-weight: 900;
	border-bottom: 1rpx solid rgba(226, 229, 236, 0.9);
}

.poster-phone__ring {
	position: absolute;
	left: 50%;
	top: 54rpx;
	width: 182rpx;
	height: 182rpx;
	margin-left: -91rpx;
	border-radius: 50%;
	border: 4rpx solid rgba(218, 220, 227, 0.9);
}

.notice-poster--reorder .poster-phone__ring,
.notice-poster--delete .poster-phone__ring {
	top: 50rpx;
	width: 250rpx;
	height: 250rpx;
	margin-left: -125rpx;
	border-width: 5rpx;
}

.notice-poster--info .poster-phone__ring {
	top: 72rpx;
	width: 200rpx;
	height: 200rpx;
	margin-left: -100rpx;
}

.poster-phone__bead {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 29rpx;
	height: 29rpx;
	margin: -15rpx 0 0 -15rpx;
	border-radius: 50%;
	background: radial-gradient(circle at 32% 26%, #fff 0 17%, #ead2df 40%, #d5a6bf 100%);
	box-shadow: 0 4rpx 9rpx rgba(113, 82, 102, 0.18);
}

.poster-phone__bead:nth-child(1) { transform: rotate(0deg) translateX(91rpx) rotate(0deg); }
.poster-phone__bead:nth-child(2) { transform: rotate(26deg) translateX(91rpx) rotate(-26deg); }
.poster-phone__bead:nth-child(3) { transform: rotate(52deg) translateX(91rpx) rotate(-52deg); }
.poster-phone__bead:nth-child(4) { transform: rotate(78deg) translateX(91rpx) rotate(-78deg); }
.poster-phone__bead:nth-child(5) { transform: rotate(104deg) translateX(91rpx) rotate(-104deg); }
.poster-phone__bead:nth-child(6) { transform: rotate(130deg) translateX(91rpx) rotate(-130deg); }
.poster-phone__bead:nth-child(7) { transform: rotate(156deg) translateX(91rpx) rotate(-156deg); }
.poster-phone__bead:nth-child(8) { transform: rotate(182deg) translateX(91rpx) rotate(-182deg); }
.poster-phone__bead:nth-child(9) { transform: rotate(208deg) translateX(91rpx) rotate(-208deg); }
.poster-phone__bead:nth-child(10) { transform: rotate(234deg) translateX(91rpx) rotate(-234deg); }
.poster-phone__bead:nth-child(11) { transform: rotate(260deg) translateX(91rpx) rotate(-260deg); }
.poster-phone__bead:nth-child(12) { transform: rotate(286deg) translateX(91rpx) rotate(-286deg); }
.poster-phone__bead:nth-child(13) { transform: rotate(312deg) translateX(91rpx) rotate(-312deg); }
.poster-phone__bead:nth-child(14) { transform: rotate(338deg) translateX(91rpx) rotate(-338deg); }

.notice-poster--reorder .poster-phone__bead:nth-child(1),
.notice-poster--delete .poster-phone__bead:nth-child(1) { transform: rotate(0deg) translateX(125rpx) rotate(0deg); }
.notice-poster--reorder .poster-phone__bead:nth-child(2),
.notice-poster--delete .poster-phone__bead:nth-child(2) { transform: rotate(26deg) translateX(125rpx) rotate(-26deg); }
.notice-poster--reorder .poster-phone__bead:nth-child(3),
.notice-poster--delete .poster-phone__bead:nth-child(3) { transform: rotate(52deg) translateX(125rpx) rotate(-52deg); }
.notice-poster--reorder .poster-phone__bead:nth-child(4),
.notice-poster--delete .poster-phone__bead:nth-child(4) { transform: rotate(78deg) translateX(125rpx) rotate(-78deg); }
.notice-poster--reorder .poster-phone__bead:nth-child(5),
.notice-poster--delete .poster-phone__bead:nth-child(5) { transform: rotate(104deg) translateX(125rpx) rotate(-104deg); }
.notice-poster--reorder .poster-phone__bead:nth-child(6),
.notice-poster--delete .poster-phone__bead:nth-child(6) { transform: rotate(130deg) translateX(125rpx) rotate(-130deg); }
.notice-poster--reorder .poster-phone__bead:nth-child(7),
.notice-poster--delete .poster-phone__bead:nth-child(7) { transform: rotate(156deg) translateX(125rpx) rotate(-156deg); }
.notice-poster--reorder .poster-phone__bead:nth-child(8),
.notice-poster--delete .poster-phone__bead:nth-child(8) { transform: rotate(182deg) translateX(125rpx) rotate(-182deg); }
.notice-poster--reorder .poster-phone__bead:nth-child(9),
.notice-poster--delete .poster-phone__bead:nth-child(9) { transform: rotate(208deg) translateX(125rpx) rotate(-208deg); }
.notice-poster--reorder .poster-phone__bead:nth-child(10),
.notice-poster--delete .poster-phone__bead:nth-child(10) { transform: rotate(234deg) translateX(125rpx) rotate(-234deg); }
.notice-poster--reorder .poster-phone__bead:nth-child(11),
.notice-poster--delete .poster-phone__bead:nth-child(11) { transform: rotate(260deg) translateX(125rpx) rotate(-260deg); }
.notice-poster--reorder .poster-phone__bead:nth-child(12),
.notice-poster--delete .poster-phone__bead:nth-child(12) { transform: rotate(286deg) translateX(125rpx) rotate(-286deg); }
.notice-poster--reorder .poster-phone__bead:nth-child(13),
.notice-poster--delete .poster-phone__bead:nth-child(13) { transform: rotate(312deg) translateX(125rpx) rotate(-312deg); }
.notice-poster--reorder .poster-phone__bead:nth-child(14),
.notice-poster--delete .poster-phone__bead:nth-child(14) { transform: rotate(338deg) translateX(125rpx) rotate(-338deg); }

.poster-phone__bead--add,
.poster-phone__bead--drag,
.poster-phone__bead--delete,
.poster-phone__bead--info {
	width: 42rpx;
	height: 42rpx;
	margin: -21rpx 0 0 -21rpx;
	background: radial-gradient(circle at 32% 26%, #fff 0 15%, #c83c6e 42%, #8c204a 100%);
	box-shadow: 0 12rpx 24rpx rgba(166, 43, 83, 0.28);
	z-index: 3;
}

.poster-phone__bead--info {
	background: radial-gradient(circle at 32% 26%, #fff 0 15%, #3387ba 42%, #1a4f78 100%);
}

.poster-phone__bead--drag::after,
.poster-phone__bead--delete::after,
.poster-finger {
	content: '';
	position: absolute;
	width: 54rpx;
	height: 78rpx;
	border-radius: 26rpx 26rpx 20rpx 20rpx;
	background: linear-gradient(180deg, #f7b0a4, #db5d4d);
	box-shadow: 0 8rpx 15rpx rgba(203, 85, 72, 0.18);
	transform: rotate(-24deg);
}

.poster-finger {
	left: 174rpx;
	top: 216rpx;
	z-index: 4;
}

.notice-poster--press .poster-finger {
	left: 160rpx;
	top: 142rpx;
}

.poster-phone__bead--drag::after {
	left: -14rpx;
	top: 42rpx;
}

.poster-phone__bead--delete::after {
	left: 34rpx;
	top: 34rpx;
}

.poster-delete-zone {
	position: absolute;
	right: 20rpx;
	top: 48rpx;
	width: 214rpx;
	height: 188rpx;
	border-radius: 6rpx;
	background: rgba(239, 64, 86, 0.18);
	border: 2rpx dashed rgba(218, 50, 70, 0.5);
	z-index: 1;
}

.poster-photo {
	position: absolute;
	left: -56rpx;
	bottom: -150rpx;
	width: 324rpx;
	padding: 12rpx;
	border-radius: 4rpx;
	background: #fff;
	border: 2rpx solid rgba(93, 96, 104, 0.45);
	box-shadow: 0 8rpx 18rpx rgba(58, 64, 82, 0.18);
	z-index: 5;
}

.poster-photo__title {
	color: #171b25;
	font-size: 20rpx;
	font-weight: 900;
}

.poster-photo__img {
	margin-top: 10rpx;
	width: 190rpx;
	height: 72rpx;
	border-radius: 4rpx;
	background:
		radial-gradient(circle at 80% 24%, rgba(255, 255, 255, 0.85) 0 7rpx, transparent 8rpx),
		linear-gradient(135deg, #605f6d, #d7c9c4 45%, #f0d4c7);
}

.poster-callout {
	position: absolute;
	z-index: 5;
	height: 34rpx;
	padding: 0 12rpx;
	border-radius: 5rpx;
	background: rgba(255, 255, 255, 0.94);
	border: 2rpx solid rgba(198, 45, 65, 0.55);
	color: #c72d43;
	font-size: 18rpx;
	font-weight: 900;
	line-height: 32rpx;
	white-space: nowrap;
}

.poster-callout--top {
	left: 188rpx;
	top: -28rpx;
}

.poster-callout--left {
	left: -34rpx;
	bottom: 44rpx;
	writing-mode: vertical-rl;
	height: auto;
	padding: 10rpx 7rpx;
	line-height: 1;
}

.poster-callout--right {
	right: -68rpx;
	bottom: 38rpx;
}

.poster-guide-label {
	position: absolute;
	z-index: 6;
	height: 34rpx;
	padding: 0 12rpx;
	border-radius: 4rpx;
	background: rgba(255, 255, 255, 0.96);
	border: 2rpx solid rgba(210, 45, 62, 0.7);
	color: #d32d42;
	font-size: 18rpx;
	font-weight: 900;
	line-height: 32rpx;
	white-space: nowrap;
	box-shadow: 0 6rpx 12rpx rgba(177, 49, 64, 0.08);
}

.poster-guide-label::after {
	content: '';
	position: absolute;
	left: 50%;
	bottom: -12rpx;
	width: 18rpx;
	height: 18rpx;
	margin-left: -9rpx;
	background: inherit;
	border-right: 2rpx solid rgba(210, 45, 62, 0.7);
	border-bottom: 2rpx solid rgba(210, 45, 62, 0.7);
	transform: rotate(45deg);
}

.poster-guide-label--category {
	left: 14rpx;
	top: 232rpx;
}

.poster-guide-label--category::after {
	left: 50rpx;
}

.poster-guide-label--select {
	left: 180rpx;
	top: 232rpx;
}

.poster-guide-label--select::after {
	left: 60rpx;
}

.poster-guide-label--press {
	left: 46rpx;
	top: 92rpx;
}

.poster-guide-label--press::after {
	left: 96rpx;
}

.poster-guide-label--drag {
	left: 214rpx;
	top: 58rpx;
}

.poster-guide-label--drag::after,
.poster-guide-label--delete::after {
	left: 36rpx;
}

.poster-guide-label--delete {
	right: 42rpx;
	top: 56rpx;
}

.poster-phone__materials {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 102rpx;
	display: grid;
	grid-template-columns: 92rpx repeat(3, 1fr);
	gap: 10rpx;
	padding: 10rpx 14rpx;
	box-sizing: border-box;
	border-top: 1rpx solid rgba(225, 228, 236, 0.86);
	background: rgba(250, 251, 253, 0.94);
}

.notice-poster--reorder .poster-phone__materials,
.notice-poster--delete .poster-phone__materials {
	display: none;
}

.notice-poster--info .poster-phone__materials {
	grid-template-columns: repeat(3, 1fr);
	height: 92rpx;
	left: 96rpx;
}

.notice-poster--info .poster-phone__category {
	display: none;
}

.poster-phone__category {
	color: #365760;
	font-size: 19rpx;
	font-weight: 900;
	display: flex;
	align-items: center;
	justify-content: center;
	border-left: 4rpx solid #527985;
}

.poster-phone__card {
	border-radius: 10rpx;
	background: #fff;
	box-shadow: 0 5rpx 14rpx rgba(72, 82, 112, 0.1);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 3rpx;
	color: #2b3141;
	font-size: 17rpx;
	font-weight: 800;
	overflow: hidden;
}

.poster-phone__card--target {
	border: 3rpx solid rgba(211, 45, 66, 0.58);
	box-shadow:
		0 6rpx 16rpx rgba(211, 45, 66, 0.13),
		0 0 0 4rpx rgba(211, 45, 66, 0.06);
	animation: tutorial-target-pulse 1.35s ease-in-out infinite;
}

.poster-phone__card-bead {
	width: 38rpx;
	height: 38rpx;
	border-radius: 50%;
	background:
		linear-gradient(90deg, transparent 0 46%, rgba(60, 68, 82, 0.2) 47% 53%, transparent 54%),
		radial-gradient(circle at 34% 28%, #fff 0 18%, #ece8f2 42%, #cec4d9 100%);
	box-shadow: 0 3rpx 8rpx rgba(72, 80, 104, 0.16);
}

@keyframes tutorial-target-pulse {
	0%,
	100% {
		box-shadow:
			0 6rpx 16rpx rgba(211, 45, 66, 0.12),
			0 0 0 4rpx rgba(211, 45, 66, 0.05);
	}
	50% {
		box-shadow:
			0 9rpx 20rpx rgba(211, 45, 66, 0.18),
			0 0 0 8rpx rgba(211, 45, 66, 0.09);
	}
}

.notice-info-poster {
	position: relative;
	height: 560rpx;
	padding: 34rpx 34rpx 24rpx;
	box-sizing: border-box;
	overflow: hidden;
	background: #f5efe7;
}

.notice-info-poster__bg {
	position: absolute;
	inset: 0;
	background:
		radial-gradient(circle at 18% 18%, rgba(255, 255, 255, 0.74) 0 52rpx, transparent 54rpx),
		radial-gradient(circle at 82% 20%, rgba(70, 70, 70, 0.16) 0 38rpx, transparent 40rpx),
		radial-gradient(circle at 70% 78%, rgba(110, 88, 64, 0.16) 0 70rpx, transparent 72rpx),
		linear-gradient(130deg, rgba(122, 96, 64, 0.14), transparent 34%),
		repeating-linear-gradient(12deg, rgba(116, 87, 56, 0.06) 0 8rpx, transparent 8rpx 24rpx),
		#efe5d8;
}

.purchase-note-card {
	position: relative;
	z-index: 1;
	width: 520rpx;
	margin: 0 auto;
	padding: 30rpx 34rpx;
	border-radius: 18rpx;
	background: rgba(255, 250, 244, 0.72);
	box-shadow: 0 16rpx 38rpx rgba(78, 56, 38, 0.14);
	box-sizing: border-box;
	backdrop-filter: blur(8rpx);
}

.purchase-note-card__title {
	display: block;
	color: #5a3f2e;
	font-size: 48rpx;
	font-weight: 900;
	text-align: center;
	line-height: 1.1;
}

.purchase-note-card__subtitle {
	display: block;
	margin-top: 24rpx;
	color: #4d382c;
	font-size: 26rpx;
	font-weight: 900;
}

.purchase-note-card__points {
	margin-top: 18rpx;
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}

.purchase-note-card__point {
	color: #4d443e;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.48;
}

.notice-info-poster--after-sale {
	padding: 20rpx 34rpx 18rpx;
	background:
		linear-gradient(90deg, rgba(255, 255, 255, 0.4) 1rpx, transparent 1rpx),
		linear-gradient(rgba(255, 255, 255, 0.4) 1rpx, transparent 1rpx),
		#f4eadc;
	background-size: 34rpx 34rpx;
}

.notice-info-poster--after-sale .notice-info-poster__bg {
	background:
		radial-gradient(circle at 86% 7%, rgba(133, 98, 54, 0.18) 0 38rpx, transparent 39rpx),
		radial-gradient(circle at 88% 20%, rgba(40, 40, 40, 0.14) 0 30rpx, transparent 31rpx),
		linear-gradient(145deg, rgba(137, 91, 35, 0.24), transparent 36%),
		transparent;
}

.after-sale-card {
	position: relative;
	z-index: 1;
	height: 522rpx;
	padding: 12rpx 18rpx;
	box-sizing: border-box;
	color: #322820;
	overflow: hidden;
}

.after-sale-card__headline {
	display: block;
	position: relative;
	z-index: 2;
	color: #fff;
	font-size: 72rpx;
	font-weight: 900;
	line-height: 1;
	text-shadow: 0 4rpx 0 rgba(116, 79, 36, 0.72);
}

.after-sale-card__subhead {
	display: block;
	position: relative;
	z-index: 2;
	margin: 18rpx 0 16rpx;
	height: 42rpx;
	padding: 0 18rpx;
	background: rgba(158, 104, 48, 0.78);
	color: #fffaf2;
	font-size: 25rpx;
	font-weight: 900;
	line-height: 42rpx;
}

.after-sale-card__rule {
	position: relative;
	z-index: 2;
	margin-top: 10rpx;
	padding-bottom: 10rpx;
	border-bottom: 2rpx solid rgba(93, 66, 38, 0.28);
	display: flex;
	flex-direction: column;
	gap: 6rpx;
	color: #4a3a2d;
	font-size: 21rpx;
	font-weight: 800;
	line-height: 1.38;
}

.after-sale-card__tag {
	align-self: flex-start;
	min-width: 112rpx;
	height: 34rpx;
	padding: 0 14rpx;
	background: #b37b3b;
	color: #fff;
	font-size: 22rpx;
	font-weight: 900;
	line-height: 34rpx;
	text-align: center;
}

.after-sale-card__character {
	position: absolute;
	z-index: 1;
	right: -56rpx;
	bottom: -102rpx;
	width: 188rpx;
	height: 158rpx;
	border-radius: 50% 50% 34% 34%;
	background: #fff;
	border: 6rpx solid #3b2d26;
	pointer-events: none;
	transform: rotate(-10deg);
}

.after-sale-card__character::before,
.after-sale-card__character::after {
	content: '';
	position: absolute;
	top: 54rpx;
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
	background: #3b2d26;
}

.after-sale-card__character::before {
	left: 70rpx;
}

.after-sale-card__character::after {
	left: 116rpx;
}

.wrist-guide-poster,
.bead-size-poster {
	position: relative;
	height: 560rpx;
	padding: 30rpx 42rpx 24rpx;
	box-sizing: border-box;
	overflow: hidden;
	background:
		radial-gradient(circle at 26% 22%, rgba(236, 239, 246, 0.48), transparent 32%),
		radial-gradient(circle at 82% 72%, rgba(236, 239, 246, 0.42), transparent 34%),
		#fff;
}

.wrist-guide-poster__header,
.bead-size-poster__header {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.wrist-guide-poster__title,
.bead-size-poster__title {
	color: #090b10;
	font-size: 42rpx;
	font-weight: 900;
	line-height: 1.1;
}

.wrist-guide-poster__subtitle,
.bead-size-poster__subtitle {
	margin-top: 8rpx;
	color: #222838;
	font-size: 25rpx;
	font-weight: 900;
	line-height: 1.35;
	white-space: pre-line;
}

.wrist-soft-demo,
.wrist-ruler-demo {
	position: relative;
	z-index: 1;
	width: 420rpx;
	height: 230rpx;
	margin: 20rpx auto 0;
}

.wrist-soft-demo__hand {
	position: absolute;
	left: 162rpx;
	top: 26rpx;
	width: 130rpx;
	height: 168rpx;
	border-radius: 72rpx 72rpx 42rpx 42rpx;
	border: 5rpx solid #222838;
	border-bottom-width: 8rpx;
	transform: rotate(26deg);
	background: transparent;
}

.wrist-soft-demo__hand::before {
	content: '';
	position: absolute;
	left: -58rpx;
	top: 38rpx;
	width: 106rpx;
	height: 62rpx;
	border: 5rpx solid #222838;
	border-right: none;
	border-bottom: none;
	border-radius: 70rpx 0 0 24rpx;
	transform: rotate(-44deg);
}

.wrist-soft-demo__tape {
	position: absolute;
	left: 124rpx;
	top: 132rpx;
	width: 170rpx;
	height: 26rpx;
	border-radius: 999rpx;
	border: 5rpx solid #9a7b62;
	transform: rotate(70deg);
}

.wrist-soft-demo__tape::after {
	content: '';
	position: absolute;
	left: 16rpx;
	right: 16rpx;
	top: 9rpx;
	height: 4rpx;
	background: repeating-linear-gradient(90deg, #9a7b62 0 4rpx, transparent 4rpx 14rpx);
}

.wrist-ruler-demo__wrap {
	position: absolute;
	left: 42rpx;
	top: 78rpx;
	width: 128rpx;
	height: 92rpx;
	border: 5rpx solid #222838;
	border-radius: 50%;
	transform: rotate(-22deg);
}

.wrist-ruler-demo__ruler {
	position: absolute;
	right: 36rpx;
	top: 56rpx;
	width: 190rpx;
	height: 34rpx;
	border: 5rpx solid #222838;
	transform: rotate(-28deg);
	background: repeating-linear-gradient(90deg, transparent 0 12rpx, rgba(34, 40, 56, 0.42) 12rpx 16rpx);
}

.wrist-ruler-demo__hand {
	position: absolute;
	right: 86rpx;
	top: 116rpx;
	width: 92rpx;
	height: 112rpx;
	border: 5rpx solid #222838;
	border-top: none;
	border-radius: 0 0 52rpx 52rpx;
	transform: rotate(18deg);
}

.wrist-table-demo {
	position: relative;
	z-index: 1;
	margin: 18rpx auto 0;
	width: 520rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.wrist-table-demo__grid {
	width: 500rpx;
	display: grid;
	grid-template-columns: repeat(8, 1fr);
	border-left: 2rpx solid #8b8f99;
	border-top: 2rpx solid #8b8f99;
	background: rgba(255, 255, 255, 0.84);
}

.wrist-table-demo__cell {
	height: 30rpx;
	border-right: 2rpx solid #8b8f99;
	border-bottom: 2rpx solid #8b8f99;
	color: #4e5564;
	font-size: 15rpx;
	font-weight: 700;
	line-height: 30rpx;
	text-align: center;
}

.wrist-table-demo__note {
	margin-top: 24rpx;
	color: #1b2030;
	font-size: 24rpx;
	font-weight: 900;
}

.wrist-guide-poster__points {
	position: relative;
	z-index: 1;
	margin: 18rpx auto 0;
	width: 530rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8rpx;
	text-align: center;
}

.wrist-guide-poster__point {
	color: #222838;
	font-size: 23rpx;
	font-weight: 900;
	line-height: 1.35;
}

.wrist-guide-poster--2 .wrist-guide-poster__points {
	margin-top: 12rpx;
}

.bead-size-poster__hands {
	position: relative;
	z-index: 1;
	margin-top: 38rpx;
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 18rpx;
	align-items: end;
}

.bead-size-poster__item {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 22rpx;
}

.bead-size-poster__label {
	color: #090b10;
	font-size: 34rpx;
	font-weight: 900;
}

.bead-size-poster__hand {
	position: relative;
	width: 112rpx;
	height: 230rpx;
	border-radius: 60rpx 60rpx 28rpx 28rpx;
	background: linear-gradient(180deg, #fff0eb 0%, #f4c9bf 100%);
	box-shadow: inset 0 0 0 2rpx rgba(196, 143, 132, 0.12);
}

.bead-size-poster__hand::before {
	content: '';
	position: absolute;
	left: -20rpx;
	top: 8rpx;
	width: 108rpx;
	height: 62rpx;
	border-radius: 56rpx 42rpx 34rpx 30rpx;
	background: linear-gradient(180deg, #fff5f1 0%, #f3cabe 100%);
	transform: rotate(-20deg);
}

.bead-size-poster__bracelet {
	position: absolute;
	left: 14rpx;
	bottom: 56rpx;
	width: 86rpx;
	height: 28rpx;
	border-radius: 50%;
	border: 7rpx dotted #c5a66f;
	transform: rotate(-8deg);
}

.bead-size-poster__hand--medium .bead-size-poster__bracelet {
	border-width: 9rpx;
	border-color: #d59a4b;
}

.bead-size-poster__hand--large .bead-size-poster__bracelet {
	border-width: 11rpx;
	border-color: #7b344d;
}

.notice-visual {
	position: relative;
	height: 374rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

.notice-copy {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-top: 8rpx;
	text-align: center;
}

.notice-title {
	color: #151923;
	font-size: 44rpx;
	font-weight: 900;
	line-height: 1.15;
}

.notice-subtitle {
	margin-top: 12rpx;
	max-width: 520rpx;
	color: #333847;
	font-size: 25rpx;
	font-weight: 800;
	line-height: 1.45;
}

.notice-points {
	width: 100%;
	margin-top: 16rpx;
	padding: 16rpx 22rpx;
	border-radius: 14rpx;
	background: rgba(255, 255, 255, 0.72);
	border: 1rpx solid rgba(226, 229, 238, 0.9);
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
	text-align: left;
}

.notice-point {
	color: #3d4353;
	font-size: 23rpx;
	font-weight: 700;
	line-height: 1.38;
}

.notice-pager {
	height: 86rpx;
	display: grid;
	grid-template-columns: 1fr auto 1fr;
	align-items: center;
	gap: 16rpx;
	padding: 0 56rpx 28rpx;
	box-sizing: border-box;
	background: #fff;
}

.notice-page-btn {
	height: 52rpx;
	min-width: 104rpx;
	padding: 0 18rpx;
	border-radius: 8rpx;
	background: #eef0f5;
	color: #4a5060;
	font-size: 24rpx;
	font-weight: 800;
	display: flex;
	align-items: center;
	justify-content: center;
	justify-self: start;
}

.notice-page-btn:last-child {
	justify-self: end;
}

.notice-page-btn--hidden {
	opacity: 0;
	pointer-events: none;
}

.notice-page-count {
	color: #1c2230;
	font-size: 28rpx;
	font-weight: 800;
}

.phone-demo {
	position: relative;
	width: 520rpx;
	height: 350rpx;
	border-radius: 18rpx;
	background: rgba(255, 255, 255, 0.82);
	box-shadow: inset 0 0 0 2rpx rgba(232, 235, 242, 0.82);
	overflow: hidden;
}

.phone-demo__top {
	height: 40rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #151923;
	font-size: 18rpx;
	font-weight: 900;
	border-bottom: 1rpx solid rgba(225, 228, 236, 0.88);
}

.phone-demo__ring {
	position: absolute;
	left: 50%;
	top: 54rpx;
	width: 190rpx;
	height: 190rpx;
	margin-left: -95rpx;
	border-radius: 50%;
	border: 4rpx solid rgba(216, 218, 226, 0.9);
}

.phone-demo__bead {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 28rpx;
	height: 28rpx;
	margin: -14rpx 0 0 -14rpx;
	border-radius: 50%;
	background: radial-gradient(circle at 32% 28%, #fff 0 18%, #d6c8d8 42%, #b69fb8 100%);
	box-shadow: 0 4rpx 9rpx rgba(95, 84, 103, 0.16);
}

.phone-demo__bead:nth-child(1) { transform: rotate(0deg) translateX(95rpx) rotate(0deg); }
.phone-demo__bead:nth-child(2) { transform: rotate(26deg) translateX(95rpx) rotate(-26deg); }
.phone-demo__bead:nth-child(3) { transform: rotate(52deg) translateX(95rpx) rotate(-52deg); }
.phone-demo__bead:nth-child(4) { transform: rotate(78deg) translateX(95rpx) rotate(-78deg); }
.phone-demo__bead:nth-child(5) { transform: rotate(104deg) translateX(95rpx) rotate(-104deg); }
.phone-demo__bead:nth-child(6) { transform: rotate(130deg) translateX(95rpx) rotate(-130deg); }
.phone-demo__bead:nth-child(7) { transform: rotate(156deg) translateX(95rpx) rotate(-156deg); }
.phone-demo__bead:nth-child(8) { transform: rotate(182deg) translateX(95rpx) rotate(-182deg); }
.phone-demo__bead:nth-child(9) { transform: rotate(208deg) translateX(95rpx) rotate(-208deg); }
.phone-demo__bead:nth-child(10) { transform: rotate(234deg) translateX(95rpx) rotate(-234deg); }
.phone-demo__bead:nth-child(11) { transform: rotate(260deg) translateX(95rpx) rotate(-260deg); }
.phone-demo__bead:nth-child(12) { transform: rotate(286deg) translateX(95rpx) rotate(-286deg); }
.phone-demo__bead:nth-child(13) { transform: rotate(312deg) translateX(95rpx) rotate(-312deg); }
.phone-demo__bead:nth-child(14) { transform: rotate(338deg) translateX(95rpx) rotate(-338deg); }

.phone-demo__bead--active,
.phone-demo__bead--drag,
.phone-demo__bead--delete {
	width: 38rpx;
	height: 38rpx;
	margin: -19rpx 0 0 -19rpx;
	background: radial-gradient(circle at 30% 25%, #fff 0 16%, #d94f6c 42%, #9c2643 100%);
	box-shadow: 0 12rpx 24rpx rgba(185, 43, 70, 0.28);
}

.phone-demo__bead--drag::after,
.phone-demo__bead--delete::after {
	content: '';
	position: absolute;
	left: -16rpx;
	top: 42rpx;
	width: 52rpx;
	height: 72rpx;
	border-radius: 22rpx 22rpx 18rpx 18rpx;
	background: linear-gradient(180deg, #f8b4a9, #dc604e);
	transform: rotate(-28deg);
	opacity: 0.9;
}

.phone-demo__bead--delete::before {
	content: '';
	position: absolute;
	left: 40rpx;
	top: -18rpx;
	width: 118rpx;
	height: 86rpx;
	border-radius: 10rpx;
	background: rgba(239, 64, 86, 0.2);
}

.phone-demo__photo {
	position: absolute;
	left: 30rpx;
	bottom: -102rpx;
	width: 160rpx;
	height: 96rpx;
	border-radius: 10rpx;
	background: linear-gradient(135deg, #d3c0ba, #8c8f98);
	color: #fff;
	font-size: 23rpx;
	font-weight: 900;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 8rpx 18rpx rgba(58, 64, 82, 0.18);
}

.phone-demo__label {
	position: absolute;
	height: 36rpx;
	padding: 0 12rpx;
	border-radius: 8rpx;
	background: rgba(255, 255, 255, 0.92);
	border: 2rpx solid rgba(218, 50, 70, 0.48);
	color: #d92b43;
	font-size: 19rpx;
	font-weight: 900;
	line-height: 34rpx;
	white-space: nowrap;
}

.phone-demo__label--top {
	left: 136rpx;
	top: -24rpx;
}

.phone-demo__label--left {
	left: -80rpx;
	bottom: 10rpx;
}

.phone-demo__label--right {
	right: -84rpx;
	bottom: 10rpx;
}

.phone-demo__materials {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 96rpx;
	display: grid;
	grid-template-columns: 92rpx repeat(3, 1fr);
	gap: 10rpx;
	padding: 10rpx 14rpx;
	box-sizing: border-box;
	border-top: 1rpx solid rgba(225, 228, 236, 0.86);
	background: rgba(250, 251, 253, 0.92);
}

.phone-demo__category {
	color: #365760;
	font-size: 20rpx;
	font-weight: 900;
	display: flex;
	align-items: center;
	justify-content: center;
	border-left: 4rpx solid #527985;
}

.phone-demo__card {
	border-radius: 12rpx;
	background:
		radial-gradient(circle at 50% 38%, #fff 0 17%, #e5e1ec 18% 44%, transparent 45%),
		#fff;
	box-shadow: 0 5rpx 14rpx rgba(72, 82, 112, 0.1);
}

.notice-visual--purchase .phone-demo {
	width: 500rpx;
	background:
		linear-gradient(rgba(255, 255, 255, 0.74), rgba(255, 255, 255, 0.9)),
		linear-gradient(135deg, #dac8bd, #f3eee9);
}

.notice-visual--purchase .phone-demo::before {
	content: '购买须知';
	position: absolute;
	left: 50%;
	top: 42rpx;
	transform: translateX(-50%);
	color: #4a332d;
	font-size: 44rpx;
	font-weight: 900;
}

.notice-visual--purchase .phone-demo__ring,
.notice-visual--purchase .phone-demo__materials,
.notice-visual--purchase .phone-demo__top {
	display: none;
}

.notice-visual--purchase .phone-demo::after {
	content: '关于材质\\A天然水晶纹理存在差异\\A请以发货实物为准';
	white-space: pre;
	position: absolute;
	left: 74rpx;
	right: 74rpx;
	top: 116rpx;
	color: #4c423e;
	font-size: 26rpx;
	font-weight: 800;
	line-height: 1.8;
	text-align: left;
}

.measure-demo {
	position: relative;
	width: 460rpx;
	height: 330rpx;
}

.measure-demo__hand {
	position: absolute;
	left: 188rpx;
	top: 44rpx;
	width: 74rpx;
	height: 218rpx;
	border-radius: 38rpx 38rpx 30rpx 30rpx;
	background: linear-gradient(180deg, #fff0ec, #f1c8bd);
	transform: rotate(24deg);
	box-shadow: inset 0 0 0 2rpx rgba(219, 161, 148, 0.2);
}

.measure-demo__hand::before {
	content: '';
	position: absolute;
	left: -45rpx;
	top: 10rpx;
	width: 110rpx;
	height: 88rpx;
	border-radius: 60rpx 38rpx 44rpx 34rpx;
	background: linear-gradient(180deg, #fff5f1, #f2cbbf);
	transform: rotate(-28deg);
}

.measure-demo__tape {
	position: absolute;
	left: 118rpx;
	top: 184rpx;
	width: 234rpx;
	height: 28rpx;
	border-radius: 999rpx;
	border: 4rpx solid #9aa0ad;
	transform: rotate(-18deg);
}

.measure-demo__note {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 18rpx;
	color: #2f3544;
	font-size: 28rpx;
	font-weight: 900;
	text-align: center;
}

.size-demo {
	width: 100%;
	height: 328rpx;
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	align-items: end;
	gap: 18rpx;
}

.size-demo__item {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 22rpx;
}

.size-demo__label {
	color: #111723;
	font-size: 38rpx;
	font-weight: 900;
}

.size-demo__hand {
	position: relative;
	width: 92rpx;
	height: 190rpx;
	border-radius: 52rpx 52rpx 30rpx 30rpx;
	background: linear-gradient(180deg, #fff2ee, #f0c6ba);
}

.size-demo__hand::before {
	content: '';
	position: absolute;
	left: -22rpx;
	top: 4rpx;
	width: 104rpx;
	height: 64rpx;
	border-radius: 46rpx 40rpx 34rpx 34rpx;
	background: linear-gradient(180deg, #fff5f1, #f1c9bf);
}

.size-demo__bracelet {
	position: absolute;
	left: 12rpx;
	bottom: 28rpx;
	width: 68rpx;
	height: 30rpx;
	border-radius: 50%;
	border: 6rpx dotted #c9a552;
	transform: rotate(-8deg);
}

.size-demo__hand--medium .size-demo__bracelet {
	border-width: 8rpx;
	border-color: #d79a55;
}

.size-demo__hand--large .size-demo__bracelet {
	border-width: 10rpx;
	border-color: #a74246;
}

@keyframes actual-photo-fade-in {
	from { opacity: 0; }
	to { opacity: 1; }
}

@keyframes actual-photo-in {
	from {
		opacity: 0;
		transform: translateY(24rpx) scale(0.96);
	}
	to {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

@keyframes insufficient-hint-in {
	0% {
		opacity: 0;
		transform: translate(-50%, -12rpx) scale(0.96);
	}
	12% {
		opacity: 1;
		transform: translate(-50%, 0) scale(1);
	}
	84% {
		opacity: 1;
		transform: translate(-50%, 0) scale(1);
	}
	100% {
		opacity: 0;
		transform: translate(-50%, -8rpx) scale(0.98);
	}
}

@keyframes insufficient-toast-in {
	0% {
		opacity: 0;
		transform: translate(-50%, -10rpx) scale(0.96);
	}
	12% {
		opacity: 1;
		transform: translate(-50%, 0) scale(1);
	}
	82% {
		opacity: 1;
		transform: translate(-50%, 0) scale(1);
	}
	100% {
		opacity: 0;
		transform: translate(-50%, -8rpx) scale(0.98);
	}
}

@keyframes function-toast-in {
	0% {
		opacity: 0;
		transform: translate(-50%, -10rpx) scale(0.94);
	}
	14% {
		opacity: 1;
		transform: translate(-50%, 0) scale(1);
	}
	78% {
		opacity: 1;
		transform: translate(-50%, 0) scale(1);
	}
	100% {
		opacity: 0;
		transform: translate(-50%, -8rpx) scale(0.98);
	}
}

@keyframes notice-fade-in {
	from { opacity: 0; }
	to { opacity: 1; }
}

@keyframes notice-dialog-in {
	from {
		opacity: 0;
		transform: translateY(28rpx) scale(0.96);
	}
	to {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

.loading-screen {
	flex: 1;
	min-height: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #fff;
	padding: 0 32rpx;
	box-sizing: border-box;
}

.loading-content {
	width: 100%;
	max-width: 700rpx;
	margin-top: 80rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	animation: loading-fade 0.24s ease-out both;
}

.loading-ring {
	position: relative;
	width: 148rpx;
	height: 148rpx;
	border-radius: 50%;
	border: 10rpx solid transparent;
	border-top-color: #527985;
	border-right-color: #527985;
	animation: loading-spin 1s linear infinite;
	box-sizing: border-box;
}

.loading-ring::after {
	content: '';
	position: absolute;
	inset: -10rpx;
	border-radius: 50%;
	border: 10rpx solid rgba(82, 121, 133, 0.12);
	box-sizing: border-box;
}

.loading-row {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 120rpx;
	padding: 0 24rpx;
	box-sizing: border-box;
}

.loading-title,
.loading-percent {
	color: #667084;
	font-size: 29rpx;
	font-weight: 800;
	line-height: 1.2;
}

.loading-track {
	width: 100%;
	height: 16rpx;
	margin-top: 20rpx;
	border-radius: 999rpx;
	background: #e3e7ee;
	overflow: hidden;
}

.loading-fill {
	height: 100%;
	border-radius: inherit;
	background: linear-gradient(90deg, #527985 0%, #d0a09d 100%);
	transition: width 0.16s ease-out;
}

.loading-subtitle {
	margin-top: 50rpx;
	color: #667084;
	font-size: 26rpx;
	font-weight: 800;
	text-align: center;
	line-height: 1.45;
}

.page--ready .info-section {
	animation: top-shell-in 0.32s ease-out both;
}

.page--ready .bottom-section {
	animation: bottom-sheet-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes loading-fade {
	from {
		opacity: 0;
		transform: translateY(10rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes loading-spin {
	to {
		transform: rotate(360deg);
	}
}

@keyframes top-shell-in {
	from {
		opacity: 0;
		transform: translateY(-10rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes bottom-sheet-in {
	from {
		opacity: 0;
		transform: translateY(52rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

// 顶部信息区
.info-section {
	padding: 8rpx 16rpx 8rpx;
	flex-shrink: 0;
	position: relative;
	z-index: 6;
	background: #fffdf9;
}

// 信息标签布局
.info-tags {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 16rpx;
	row-gap: 8rpx;
	min-height: 66rpx;
}

.info-tags__left {
	display: flex;
	align-items: center;
	gap: 12rpx;
	min-width: 0;
	max-width: 100%;
}

.info-tags__right {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-left: auto;
	min-width: 0;
	max-width: 100%;
}

.info-section :deep(.info-tag--notice) {
	background: #527985;
	border-color: rgba(255, 255, 255, 0.32);
	box-shadow: 0 8rpx 18rpx rgba(82, 121, 133, 0.2);
}

.info-section :deep(.info-tag--default) {
	background: rgba(242, 240, 235, 0.92);
	color: #6f7773;
	border-color: rgba(82, 121, 133, 0.1);
}

.info-section :deep(.info-tag--warn) {
	background: rgba(250, 239, 232, 0.94);
	color: #946d62;
}

.mode-switch {
	display: flex;
	align-items: center;
	gap: 4rpx;
	height: 54rpx;
	padding: 4rpx;
	border-radius: 999rpx;
	background: #edf1ef;
	border: 1rpx solid rgba(82, 121, 133, 0.16);
	box-sizing: border-box;
	flex-shrink: 0;
}

.mode-switch__item {
	min-width: 70rpx;
	height: 44rpx;
	padding: 0 14rpx;
	border-radius: 999rpx;
	color: #737a77;
	font-size: 23rpx;
	font-weight: 900;
	line-height: 44rpx;
	text-align: center;
	box-sizing: border-box;
	transition:
		background-color 0.16s ease,
		color 0.16s ease,
		box-shadow 0.16s ease,
		transform 0.16s ease;
}

.mode-switch__item--active {
	background: #527985;
	color: #fff;
	box-shadow: 0 6rpx 14rpx rgba(82, 121, 133, 0.2);
}

.mode-switch__item:active {
	transform: scale(0.96);
}

// 可点的信息标签包裹
.info-tag-wrap {
	cursor: pointer;
}

// 总价标签（动画）
.price-tag-wrap {
	display: inline-block;
	transition: transform u.$duration-price-return u.$ease-in-out;
}

.price-tag-wrap--bump {
	animation: price-bump 0.44s cubic-bezier(0.34, 1.56, 0.64, 1);
}

// 价格跳动动画
@keyframes price-bump {
	0% {
		transform: scale(1);
	}
	28% {
		transform: scale(1.06);
	}
	72% {
		transform: scale(1.06);
	}
	100% {
		transform: scale(1);
	}
}

// 中部画布区域（无左右边距，手串画布撑满）
.canvas-section {
	flex: 1;
	min-height: 0;
	padding: 0;
	display: flex;
	align-items: stretch;
}

// 画布玻璃卡片（无左右 padding，画布贴边）
.canvas-card {
	position: relative;
	width: 100%;
	height: 100%;
	border-radius: 0;
	padding: 0;
	max-width: none;
	margin: 0 auto;
	animation: fade-in-up 0.46s cubic-bezier(0.22, 1, 0.36, 1);
}

.view-mode-toggle {
	position: absolute;
	right: 22rpx;
	top: 22rpx;
	z-index: 6;
	display: flex;
	align-items: center;
	gap: 6rpx;
	padding: 6rpx;
	border-radius: 999rpx;
	background: rgba(255, 253, 249, 0.86);
	border: 1rpx solid rgba(82, 121, 133, 0.2);
	box-shadow: 0 12rpx 30rpx rgba(67, 85, 86, 0.12);
	backdrop-filter: blur(18rpx);
	box-sizing: border-box;
}

.view-mode-button {
	position: relative;
	width: 58rpx;
	height: 58rpx;
	border-radius: 999rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	transition:
		background-color 0.2s ease,
		transform 0.2s ease,
		box-shadow 0.2s ease;
}

.view-mode-button--active {
	background: #527985;
	box-shadow: 0 8rpx 18rpx rgba(82, 121, 133, 0.2);
}

.view-mode-button:active {
	transform: scale(0.94);
}

.view-mode-icon {
	width: 34rpx;
	height: 34rpx;
}

.growth-panel {
	position: absolute;
	left: 24rpx;
	right: 24rpx;
	bottom: 26rpx;
	z-index: 4;
	min-height: 106rpx;
	padding: 15rpx 18rpx;
	border-radius: 20rpx;
	background: rgba(255, 255, 255, 0.88);
	border: 1rpx solid rgba(222, 227, 238, 0.92);
	box-shadow: 0 14rpx 34rpx rgba(70, 79, 104, 0.11);
	backdrop-filter: blur(16rpx);
	box-sizing: border-box;
	display: none;
	align-items: center;
	gap: 18rpx;
	pointer-events: auto;
	animation: growth-panel-in 0.36s 0.08s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.growth-panel--complete {
	background: rgba(252, 255, 251, 0.9);
	border-color: rgba(203, 225, 211, 0.95);
	box-shadow: 0 14rpx 34rpx rgba(72, 118, 86, 0.1);
}

.growth-panel__copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 3rpx;
}

.growth-panel__eyebrow {
	color: #8a91a3;
	font-size: 20rpx;
	font-weight: 900;
	line-height: 1.1;
	white-space: nowrap;
}

.growth-panel__title {
	color: #365760;
	font-size: 30rpx;
	font-weight: 900;
	line-height: 1.08;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.growth-panel__sub {
	color: #7b8396;
	font-size: 22rpx;
	font-weight: 800;
	line-height: 1.15;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.growth-panel__recent {
	color: #b47776;
	font-size: 20rpx;
	font-weight: 900;
	line-height: 1.1;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	animation: recent-line-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.growth-panel__meter {
	width: 216rpx;
	flex-shrink: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr) 56rpx;
	align-items: center;
	gap: 8rpx 12rpx;
}

.growth-panel__track {
	position: relative;
	flex: 1;
	height: 12rpx;
	border-radius: 999rpx;
	overflow: hidden;
	background: #e7ebf2;
	box-shadow: inset 0 1rpx 2rpx rgba(49, 57, 76, 0.08);
}

.growth-panel__fill {
	height: 100%;
	border-radius: inherit;
	background: linear-gradient(90deg, #d0a09d 0%, #8fa9a8 52%, #527985 100%);
	transition: width 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.growth-panel__value {
	width: 56rpx;
	color: #527985;
	font-size: 22rpx;
	font-weight: 900;
	line-height: 1;
	text-align: right;
}

.growth-panel__target {
	grid-column: 1 / 3;
	justify-self: end;
	height: 38rpx;
	padding: 0 16rpx;
	border-radius: 999rpx;
	background: rgba(82, 121, 133, 0.09);
	border: 1rpx solid rgba(82, 121, 133, 0.22);
	color: #527985;
	font-size: 20rpx;
	font-weight: 900;
	line-height: 36rpx;
	white-space: nowrap;
}

.growth-panel__target:active {
	transform: scale(0.96);
}

// 淡入上移动画
@keyframes fade-in-up {
	from {
		opacity: 0;
		transform: translateY(24rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes growth-panel-in {
	from {
		opacity: 0;
		transform: translateY(16rpx) scale(0.985);
	}
	to {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

@keyframes recent-line-in {
	from {
		opacity: 0;
		transform: translateY(5rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.design-confirm-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 90;
	background: rgba(16, 18, 24, 0.44);
	display: flex;
	align-items: flex-end;
	animation: fade-in 0.18s ease-out both;
}

.design-confirm-sheet {
	width: 100%;
	max-height: 82vh;
	padding: 14rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
	border-radius: 32rpx 32rpx 0 0;
	background: #f7f7fb;
	box-shadow: 0 -18rpx 48rpx rgba(21, 24, 34, 0.18);
	box-sizing: border-box;
	animation: confirm-sheet-in 0.24s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.design-confirm-grip {
	width: 74rpx;
	height: 8rpx;
	margin: 0 auto 24rpx;
	border-radius: 999rpx;
	background: #d9dbe1;
}

.design-confirm-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24rpx;
	margin-bottom: 22rpx;
}

.design-confirm-eyebrow {
	color: #527985;
	font-size: 23rpx;
	font-weight: 900;
	line-height: 1.2;
}

.design-confirm-title {
	margin-top: 6rpx;
	color: #1f222b;
	font-size: 36rpx;
	font-weight: 900;
	line-height: 1.16;
}

.design-confirm-close {
	width: 58rpx;
	height: 58rpx;
	border-radius: 50%;
	background: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 14rpx;
	box-sizing: border-box;
	box-shadow: 0 8rpx 18rpx rgba(31, 35, 48, 0.06);
	flex-shrink: 0;
}

.design-confirm-card {
	display: flex;
	gap: 24rpx;
	padding: 24rpx;
	border-radius: 20rpx;
	background: #fff;
	box-sizing: border-box;
	box-shadow: 0 10rpx 28rpx rgba(31, 35, 48, 0.06);
}

.design-confirm-preview {
	width: 180rpx;
	height: 180rpx;
	border-radius: 18rpx;
	background:
		repeating-linear-gradient(90deg, rgba(226, 220, 213, 0.42) 0 8rpx, rgba(255, 255, 255, 0.5) 8rpx 16rpx),
		#f3efeb;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	overflow: hidden;
}

.design-confirm-ring {
	position: relative;
	width: 148rpx;
	height: 148rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
}

.design-confirm-bead {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 24rpx;
	height: 24rpx;
	margin: -12rpx 0 0 -12rpx;
	border-radius: 50%;
	box-shadow:
		inset -3rpx -4rpx 7rpx rgba(31, 35, 45, 0.16),
		inset 3rpx 3rpx 6rpx rgba(255, 255, 255, 0.55),
		0 4rpx 8rpx rgba(49, 54, 68, 0.16);
}

.design-confirm-logo {
	width: 64rpx;
	color: rgba(88, 82, 86, 0.36);
	font-size: 14rpx;
	font-weight: 900;
	line-height: 1.05;
	text-align: center;
}

.design-confirm-copy {
	flex: 1;
	min-width: 0;
	padding-top: 2rpx;
}

.design-confirm-name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: #20232b;
	font-size: 30rpx;
	font-weight: 900;
	line-height: 1.25;
}

.design-confirm-summary {
	margin-top: 14rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	color: #737782;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.42;
}

.design-confirm-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 10rpx;
	margin-top: 16rpx;
}

.design-confirm-meta text {
	height: 38rpx;
	line-height: 38rpx;
	padding: 0 14rpx;
	border-radius: 999rpx;
	background: #f4f4f6;
	color: #6f737d;
	font-size: 21rpx;
	font-weight: 900;
}

.design-confirm-stats {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 14rpx;
	margin-top: 18rpx;
}

.design-confirm-stat {
	min-height: 92rpx;
	padding: 16rpx 10rpx;
	border-radius: 16rpx;
	background: #fff;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 6rpx;
}

.design-confirm-stat__value {
	color: #222630;
	font-size: 29rpx;
	font-weight: 900;
	line-height: 1.05;
}

.design-confirm-stat__value.price {
	color: #527985;
}

.design-confirm-stat__label {
	color: #9b9ea7;
	font-size: 21rpx;
	font-weight: 800;
}

.design-confirm-materials {
	margin-top: 20rpx;
	padding: 22rpx 22rpx 12rpx;
	border-radius: 18rpx;
	background: #fff;
	box-sizing: border-box;
}

.design-confirm-section-title {
	color: #232630;
	font-size: 27rpx;
	font-weight: 900;
	line-height: 1.2;
}

.design-confirm-material-list {
	margin-top: 16rpx;
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 14rpx;
}

.design-confirm-material {
	display: flex;
	align-items: center;
	gap: 12rpx;
	min-width: 0;
	min-height: 64rpx;
}

.design-confirm-material__img {
	width: 52rpx;
	height: 52rpx;
	border-radius: 50%;
	background: #f1f1f3;
	flex-shrink: 0;
}

.design-confirm-material__body {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 5rpx;
}

.design-confirm-material__name,
.design-confirm-material__spec {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.design-confirm-material__name {
	color: #2a2d36;
	font-size: 23rpx;
	font-weight: 900;
}

.design-confirm-material__spec {
	color: #9a9da6;
	font-size: 20rpx;
	font-weight: 800;
}

.design-confirm-note {
	display: flex;
	align-items: center;
	gap: 12rpx;
	margin-top: 18rpx;
	min-height: 58rpx;
	padding: 12rpx 18rpx;
	border-radius: 14rpx;
	background: #fff8f8;
	color: #8f6368;
	font-size: 22rpx;
	font-weight: 800;
	line-height: 1.35;
	box-sizing: border-box;
}

.design-confirm-note__dot {
	width: 10rpx;
	height: 10rpx;
	border-radius: 50%;
	background: #d0a09d;
	flex-shrink: 0;
}

.design-confirm-actions {
	display: grid;
	grid-template-columns: 0.9fr 1.1fr;
	gap: 18rpx;
	margin-top: 24rpx;
}

.design-confirm-btn {
	height: 88rpx;
	line-height: 88rpx;
	margin: 0;
	border-radius: 999rpx;
	background: #527985;
	color: #fff;
	font-size: 29rpx;
	font-weight: 900;
}

.design-confirm-btn.ghost {
	background: #fff;
	color: #527985;
	border: 2rpx solid rgba(82, 121, 133, 0.4);
}

@keyframes confirm-sheet-in {
	from {
		opacity: 0;
		transform: translateY(38rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.bead-flight {
	position: fixed;
	left: 0;
	top: 0;
	width: var(--flight-size);
	height: var(--flight-size);
	z-index: 40;
	pointer-events: none;
	border-radius: 50%;
	animation: bead-flight-path 0.64s cubic-bezier(0.2, 0.86, 0.24, 1) both;
	will-change: transform, opacity;
}

.bead-flight__img,
.bead-flight__fallback {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	border-radius: 50%;
	overflow: hidden;
	box-shadow:
		inset -5rpx -7rpx 12rpx rgba(44, 48, 58, 0.16),
		inset 5rpx 5rpx 11rpx rgba(255, 255, 255, 0.7),
		0 16rpx 28rpx rgba(42, 46, 58, 0.22);
	animation: bead-flight-spin 0.64s cubic-bezier(0.2, 0.86, 0.24, 1) both;
}

.bead-flight__fallback {
	background:
		radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.95) 0 15%, rgba(255, 255, 255, 0) 31%),
		linear-gradient(135deg, #f3edf4 0%, #dfe8ee 100%);
}

.bead-flight::after {
	content: '';
	position: absolute;
	left: 18%;
	top: 13%;
	width: 34%;
	height: 22%;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.82);
	filter: blur(1rpx);
	transform: rotate(-22deg);
	animation: bead-flight-glint 0.64s ease-out both;
}

.bead-flight__shadow {
	position: absolute;
	left: 9%;
	right: 9%;
	bottom: -22%;
	height: 46%;
	border-radius: 50%;
	background: radial-gradient(ellipse at center, rgba(50, 48, 58, 0.28), rgba(50, 48, 58, 0) 68%);
	filter: blur(7rpx);
	transform: rotate(-18deg);
	animation: bead-flight-shadow 0.64s cubic-bezier(0.2, 0.86, 0.24, 1) both;
}

@keyframes bead-flight-path {
	0% {
		opacity: 0.92;
		transform: translate3d(var(--flight-from-x), var(--flight-from-y), 0) scale(0.82);
	}
	44% {
		opacity: 1;
		transform: translate3d(var(--flight-mid-x), var(--flight-mid-y), 0) scale(1.16);
	}
	78% {
		opacity: 0.92;
		transform: translate3d(var(--flight-to-x), var(--flight-to-y), 0) scale(0.92);
	}
	100% {
		opacity: 0;
		transform: translate3d(var(--flight-to-x), var(--flight-to-y), 0) scale(0.68);
	}
}

@keyframes bead-flight-spin {
	0% {
		transform: rotate(-16deg) scale(0.92);
	}
	56% {
		transform: rotate(24deg) scale(1.04);
	}
	100% {
		transform: rotate(38deg) scale(1);
	}
}

@keyframes bead-flight-shadow {
	0% {
		opacity: 0.16;
		transform: translateY(16rpx) rotate(-18deg) scale(0.72);
	}
	44% {
		opacity: 0.12;
		transform: translateY(46rpx) rotate(-18deg) scale(0.92);
	}
	100% {
		opacity: 0;
		transform: translateY(8rpx) rotate(-18deg) scale(0.58);
	}
}

@keyframes bead-flight-glint {
	0% {
		opacity: 0.42;
		transform: rotate(-22deg) translateX(-4rpx);
	}
	50% {
		opacity: 0.9;
		transform: rotate(-22deg) translateX(4rpx);
	}
	100% {
		opacity: 0;
		transform: rotate(-22deg) translateX(7rpx);
	}
}

// 底部操作区和材料列表
.bottom-section {
	background: #fffdf9;
	border-radius: 0;
	border-top: 1rpx solid rgba(82, 121, 133, 0.16);
	box-shadow: 0 -3rpx 12rpx rgba(67, 85, 86, 0.06);
	padding: 4rpx 0 0;
	padding-bottom: env(safe-area-inset-bottom);
	flex-shrink: 0;
	overflow: hidden;
}

// 操作按钮行：左侧两组按钮紧挨，中间撑开，右侧「完成设计」靠右
.action-row {
	display: flex;
	align-items: center;
	padding: 0 16rpx 4rpx 24rpx;
	z-index: 2;
}

.action-row__left {
	display: flex;
	gap: 14rpx;
}

.action-row :deep(.action-btn--delete) {
	background: #fffdf9;
	color: #527985;
	border-color: #527985;
}

.action-row :deep(.action-btn--save) {
	background: #fff8f5;
	color: #a87573;
	border-color: #d0a09d;
	box-shadow: 0 7rpx 18rpx rgba(208, 160, 157, 0.16);
}

.action-row :deep(.action-btn--primary) {
	background: #527985;
	color: #fff;
	border-color: #527985;
	box-shadow: 0 7rpx 18rpx rgba(82, 121, 133, 0.2);
}

.action-row :deep(.action-btn--primary.action-btn--disabled) {
	background: #e2e6e3;
	color: #8a928d;
	border-color: #d5dbd7;
	box-shadow: none;
}

.action-row :deep(.action-btn--primary.action-btn--tone-danger) {
	background: #a45b5e;
	color: #fff;
	border-color: #a45b5e;
}

.function-menu-wrap {
	position: relative;
}

.function-menu-wrap--open :deep(.action-btn--delete) {
	background: #0d0e11;
	color: #fff;
	border-color: #0d0e11;
	box-shadow: 0 8rpx 18rpx rgba(20, 22, 28, 0.22);
}

.action-row__spacer {
	flex: 1;
	min-width: 24rpx;
}

.action-row__right {
	flex-shrink: 0;
}

// 材料面板总体布局
.material-panel {
	display: flex;
	flex-direction: column;
	height: 420rpx;
	border-top: 1rpx solid rgba(82, 121, 133, 0.14);
}

.refill-suggestion {
	display: flex;
	align-items: center;
	gap: 14rpx;
	min-height: 74rpx;
	padding: 10rpx 18rpx 10rpx 20rpx;
	background: linear-gradient(90deg, rgba(244, 235, 232, 0.96), rgba(237, 244, 242, 0.96));
	border-bottom: 1rpx solid rgba(82, 121, 133, 0.13);
	box-sizing: border-box;
}

.refill-suggestion__dot {
	width: 16rpx;
	height: 16rpx;
	border-radius: 50%;
	background: #d0a09d;
	box-shadow: 0 0 0 8rpx rgba(208, 160, 157, 0.12);
	flex-shrink: 0;
}

.refill-suggestion__copy {
	display: flex;
	flex-direction: column;
	min-width: 0;
	flex: 1;
}

.refill-suggestion__title {
	color: #202633;
	font-size: 23rpx;
	font-weight: 900;
	line-height: 1.18;
}

.refill-suggestion__text {
	margin-top: 4rpx;
	color: #7a8192;
	font-size: 21rpx;
	font-weight: 700;
	line-height: 1.18;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.refill-suggestion__action {
	flex-shrink: 0;
	height: 40rpx;
	padding: 0 14rpx;
	border-radius: 999rpx;
	background: #527985;
	color: #fff;
	font-size: 20rpx;
	font-weight: 900;
	line-height: 40rpx;
}

.function-panel {
	display: flex;
	flex: 1;
	min-height: 0;
	background: #fff;
}

.function-panel__side {
	width: 126rpx;
	flex-shrink: 0;
	padding-top: 18rpx;
	background: #f4f1ed;
	border-right: 1rpx solid rgba(232, 232, 232, 0.9);
	box-sizing: border-box;
}

.function-panel__tab {
	position: relative;
	height: 60rpx;
	padding: 0 8rpx 0 24rpx;
	display: flex;
	align-items: center;
	color: #737780;
	font-size: 24rpx;
	font-weight: 700;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.function-panel__tab--active {
	color: #365760;
	background: #fffdf9;
	font-weight: 900;
}

.function-panel__tab--active::before {
	content: '';
	position: absolute;
	left: 0;
	top: 13rpx;
	width: 5rpx;
	height: 34rpx;
	border-radius: 0 999rpx 999rpx 0;
	background: #527985;
}

.function-panel__cards {
	flex: 1;
	min-width: 0;
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	align-content: start;
	gap: 18rpx;
	padding: 26rpx 16rpx 0;
	box-sizing: border-box;
	background: linear-gradient(180deg, #fffdf9 0%, #f8f6f2 100%);
}

.function-card {
	height: 140rpx;
	border-radius: 18rpx;
	background: #fffdf9;
	border: 1rpx solid rgba(82, 121, 133, 0.16);
	box-shadow: 0 9rpx 22rpx rgba(53, 58, 72, 0.08);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 18rpx;
	animation: material-card-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;
	transition:
		transform u.$duration-press u.$ease-out,
		box-shadow u.$duration-state u.$ease-brand,
		border-color u.$duration-state u.$ease-brand;
}

.function-card:active {
	transform: scale(0.97);
}

.function-card--active {
	border-color: rgba(82, 121, 133, 0.35);
	box-shadow:
		0 9rpx 22rpx rgba(53, 58, 72, 0.08),
		0 18rpx 26rpx rgba(208, 160, 157, 0.16);
}

.function-card--muted {
	background: #eceef2;
	border-color: rgba(215, 218, 226, 0.9);
	box-shadow:
		inset 0 1rpx 0 rgba(255, 255, 255, 0.9),
		0 9rpx 18rpx rgba(55, 61, 72, 0.08);
}

.function-card__icon {
	width: 44rpx;
	height: 44rpx;
}

.function-card__label {
	color: #365760;
	font-size: 26rpx;
	font-weight: 800;
	white-space: nowrap;
}

// 材料主区域（分类+列表）
.material-body {
	display: flex;
	flex: 1;
	min-height: 0;
}

// 材料列表滚动区
.material-grid-wrap {
	flex: 1;
	height: 100%;
	background: linear-gradient(180deg, #fffdf9 0%, #f7f5f1 100%);
	overflow-x: hidden;
	scrollbar-width: none;
	-ms-overflow-style: none;
}

.material-grid-wrap::-webkit-scrollbar,
.material-grid-wrap :deep(.uni-scroll-view::-webkit-scrollbar) {
	width: 0;
	height: 0;
	display: none;
}

// 材料卡片网格：图中为 3 列
.material-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 18rpx;
	padding: 16rpx 14rpx 34rpx;
	width: 100%;
	box-sizing: border-box;
	max-width: none;
}

// 材料卡片动画
.material-grid-item {
	min-width: 0;
	animation: material-card-in 0.36s cubic-bezier(0.22, 1, 0.36, 1) backwards;
	will-change: transform, opacity;
}

// 为前6张卡片分别设置动画延迟
.material-grid-item:nth-child(1) {
	animation-delay: 0.02s;
}
.material-grid-item:nth-child(2) {
	animation-delay: 0.04s;
}
.material-grid-item:nth-child(3) {
	animation-delay: 0.06s;
}
.material-grid-item:nth-child(4) {
	animation-delay: 0.08s;
}
.material-grid-item:nth-child(5) {
	animation-delay: 0.1s;
}
.material-grid-item:nth-child(6) {
	animation-delay: 0.12s;
}

.in-use-tip {
	padding: 2rpx 18rpx 28rpx;
	color: #a4a9b6;
	font-size: 22rpx;
	font-weight: 700;
	line-height: 1.4;
	text-align: center;
}

.material-empty {
	min-height: 420rpx;
	padding: 96rpx 32rpx 40rpx;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	color: #8b92a4;
	text-align: center;
}

.material-empty__icon {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(240, 243, 248, 0.94);
	padding: 18rpx;
	box-sizing: border-box;
	box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.86);
}

.material-empty__title {
	margin-top: 20rpx;
	color: #365760;
	font-size: 28rpx;
	font-weight: 900;
	line-height: 1.2;
}

.material-empty__text {
	margin-top: 10rpx;
	color: #8b92a4;
	font-size: 24rpx;
	font-weight: 700;
	line-height: 1.35;
}

.material-empty__action {
	margin-top: 24rpx;
	height: 48rpx;
	padding: 0 22rpx;
	border-radius: 999rpx;
	background: #fff;
	border: 1rpx solid rgba(218, 224, 236, 0.96);
	box-shadow: 0 7rpx 16rpx rgba(76, 84, 108, 0.08);
	color: #527985;
	font-size: 23rpx;
	font-weight: 900;
	line-height: 48rpx;
}

.material-empty__action:active {
	transform: scale(0.97);
}

@keyframes menu-item-in {
	from {
		opacity: 0;
		transform: translateY(16rpx) scale(0.9);
	}
	to {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

@keyframes material-card-in {
	from {
		opacity: 0;
		transform: translateY(18rpx) scale(0.96);
	}
	to {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

/* #ifdef H5 */
/*
 * H5 宽屏使用真正的配置器工作台布局。rpx 只负责移动端密度，
 * 桌面区域尺寸用 px/% 约束，避免浏览器变宽后控件与素材卡同步膨胀。
 */
@media screen and (min-width: 769px) and (max-width: 899px) {
	.page--ready {
		width: min(520px, 100vw);
		margin: 0 auto;
		box-shadow: 0 0 36px rgba(67, 85, 86, 0.08);
	}
}

@media screen and (min-width: 900px) {
	.page--ready {
		display: grid;
		grid-template-columns: minmax(0, 1fr) clamp(380px, 36vw, 460px);
		grid-template-rows: auto auto minmax(0, 1fr);
		column-gap: 1px;
		padding-bottom: 0;
		background: #f1f3f1;
	}

	.page--ready :deep(.nav-bar) {
		grid-column: 1 / -1;
		grid-row: 1;
	}

	.page--ready .info-section {
		grid-column: 1;
		grid-row: 2;
		padding: 10px 18px;
		border-bottom: 1px solid rgba(82, 121, 133, 0.12);
	}

	.page--ready .info-tags {
		min-height: 44px;
		gap: 10px;
	}

	.page--ready .info-tags__left,
	.page--ready .info-tags__right {
		gap: 8px;
	}

	.page--ready .canvas-section {
		grid-column: 1;
		grid-row: 3;
		min-width: 0;
		min-height: 0;
		border-right: 1px solid rgba(82, 121, 133, 0.12);
	}

	.page--ready .canvas-card {
		min-height: 0;
	}

	.page--ready .bottom-section {
		grid-column: 2;
		grid-row: 2 / 4;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		border-top: 0;
		box-shadow: -12px 0 30px rgba(67, 85, 86, 0.07);
	}

	.page--ready .action-row {
		min-height: 64px;
		padding: 8px 14px;
		border-bottom: 1px solid rgba(82, 121, 133, 0.12);
		box-sizing: border-box;
	}

	.page--ready .action-row__left {
		gap: 8px;
	}

	.page--ready .action-row__spacer {
		min-width: 8px;
	}

	.page--ready .material-panel {
		flex: 1;
		height: auto;
		min-height: 0;
		border-top: 0;
	}

	.page--ready .refill-suggestion {
		min-height: 58px;
		padding: 9px 14px;
		gap: 10px;
	}

	.page--ready .material-body,
	.page--ready .function-panel {
		min-height: 0;
	}

	.page--ready .material-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		padding: 14px 14px 30px;
	}

	.page--ready .function-panel__cards {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		padding: 18px 14px;
	}

	.page--ready .function-card {
		height: 112px;
	}

	.page--ready .view-mode-toggle {
		right: 18px;
		top: 18px;
	}

	.design-confirm-sheet {
		width: min(560px, calc(100vw - 48px));
		margin: 0 auto;
		border-radius: 20px 20px 0 0;
	}
}

@media screen and (min-width: 1400px) {
	.page--ready {
		grid-template-columns: minmax(700px, 1fr) 480px;
	}

	.page--ready .material-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
}
/* #endif */

.bracelet-code-overlay {
	position: fixed;
	inset: 0;
	z-index: 180;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	background: rgba(17, 24, 39, 0.48);
	backdrop-filter: blur(8px);
}

.bracelet-code-sheet {
	width: 100%;
	max-height: 88vh;
	padding: 30rpx 28rpx calc(30rpx + env(safe-area-inset-bottom));
	overflow-y: auto;
	background: #fff;
	border-radius: 32rpx 32rpx 0 0;
}

.bracelet-code-head { display: flex; align-items: center; justify-content: space-between; }
.bracelet-code-head > view:first-child { display: flex; flex-direction: column; gap: 6rpx; }
.bracelet-code-eyebrow { color: #ff5701; font-size: 22rpx; font-weight: 700; letter-spacing: 4rpx; }
.bracelet-code-title { color: #171717; font-size: 38rpx; font-weight: 700; }
.bracelet-code-close { display: grid; width: 64rpx; height: 64rpx; place-items: center; border-radius: 50%; background: #f5f5f2; }
.bracelet-code-input { width: 100%; height: 178rpx; margin-top: 26rpx; padding: 22rpx; color: #27272a; font-family: monospace; font-size: 24rpx; line-height: 1.5; background: #f7f7f4; border: 2rpx solid #e7e5e4; border-radius: 20rpx; box-sizing: border-box; }
.bracelet-code-error { margin-top: 12rpx; color: #dc2626; font-size: 24rpx; }
.bracelet-code-parse, .bracelet-code-confirm { display: grid; height: 84rpx; margin-top: 18rpx; place-items: center; color: #fff; font-size: 28rpx; font-weight: 700; background: #171717; border-radius: 18rpx; }
.bracelet-code-parse--loading, .bracelet-code-confirm--disabled { opacity: .42; }
.bracelet-code-summary { display: grid; grid-template-columns: 280rpx 1fr; gap: 24rpx; align-items: center; margin-top: 26rpx; padding: 22rpx; background: #faf9f7; border-radius: 24rpx; }
.bracelet-code-ring { position: relative; width: 280rpx; height: 280rpx; border-radius: 50%; background: radial-gradient(circle, #fff 0 38%, #f2efeb 39% 100%); }
.bracelet-code-bead { position: absolute; left: 50%; top: 50%; width: 38rpx; height: 38rpx; margin: -19rpx 0 0 -19rpx; border-radius: 50%; }
.bracelet-code-ring__center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #a8a29e; font-size: 22rpx; }
.bracelet-code-ring__center text:first-child { color: #292524; font-size: 30rpx; font-weight: 700; }
.bracelet-code-stats { display: grid; gap: 18rpx; }
.bracelet-code-stats view { display: flex; align-items: baseline; justify-content: space-between; padding-bottom: 12rpx; border-bottom: 1rpx solid #e7e5e4; }
.bracelet-code-stats text { color: #78716c; font-size: 23rpx; }.bracelet-code-stats strong { color: #292524; font-size: 28rpx; }
.bracelet-code-missing { margin-top: 20rpx; padding: 22rpx; background: #fff7ed; border: 1rpx solid #fed7aa; border-radius: 20rpx; }
.bracelet-code-missing__title { color: #c2410c; font-size: 26rpx; font-weight: 700; }
.bracelet-code-missing__row { display: grid; grid-template-columns: minmax(0, 1fr) 48%; gap: 16rpx; align-items: center; margin-top: 18rpx; }
.bracelet-code-missing__row > view { display: flex; min-width: 0; flex-direction: column; gap: 4rpx; }.bracelet-code-missing__row text { color: #7c2d12; font-size: 22rpx; }.bracelet-code-missing__row small { overflow: hidden; color: #9a3412; font-size: 18rpx; text-overflow: ellipsis; white-space: nowrap; }
.bracelet-code-replacement { overflow: hidden; padding: 15rpx 18rpx; color: #7c2d12; font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; background: #fff; border-radius: 14rpx; }

/* #ifdef H5 */
@media screen and (min-width: 768px) {
	.bracelet-code-sheet { width: min(620px, calc(100vw - 48px)); border-radius: 24px 24px 0 0; }
}
/* #endif */

/* 深海蓝工作台主题：参考实体水晶工作室的暗房展示感。 */
.page,
.page--ready,
.page--loading {
	background:
		radial-gradient(circle at 50% 26%, rgba(44, 61, 86, 0.5) 0%, rgba(12, 25, 43, 0.32) 34%, transparent 58%),
		linear-gradient(180deg, #07111f 0%, #0a1625 58%, #07111f 100%);
	color: #f2f5f9;
}

.loading-screen {
	background: #07111f;
}

.loading-title,
.loading-percent {
	color: #f2f5f9;
}

.loading-subtitle {
	color: #9fa9b6;
}

.loading-track {
	background: rgba(220, 230, 242, 0.14);
}

.loading-fill {
	background: linear-gradient(90deg, #c9342f, #ef5147);
}

.info-section {
	background: rgba(8, 17, 29, 0.96);
	border-top: 1rpx solid rgba(225, 234, 244, 0.08);
	border-bottom: 1rpx solid rgba(225, 234, 244, 0.12);
}

.info-section :deep(.info-tag--notice) {
	background: linear-gradient(135deg, #ef5147 0%, #d83932 100%);
	border-color: rgba(255, 255, 255, 0.4);
	box-shadow: 0 8rpx 18rpx rgba(216, 57, 50, 0.28);
}

.info-section :deep(.info-tag--default),
.info-section :deep(.info-tag--warn) {
	background: rgba(48, 58, 72, 0.92);
	color: #d6dce5;
	border-color: rgba(225, 234, 244, 0.18);
}

.mode-switch {
	background: rgba(38, 49, 64, 0.94);
	border-color: rgba(225, 234, 244, 0.18);
}

.mode-switch__item {
	color: #aab4c1;
}

.mode-switch__item--active {
	background: rgba(8, 17, 29, 0.96);
	color: #fff;
	box-shadow: inset 0 0 0 1rpx rgba(238, 244, 250, 0.84), 0 6rpx 16rpx rgba(0, 0, 0, 0.26);
}

.canvas-section,
.canvas-card {
	background: #07111f;
}

.view-mode-toggle {
	background: rgba(10, 21, 35, 0.8);
	border-color: rgba(225, 234, 244, 0.34);
	box-shadow: 0 12rpx 30rpx rgba(0, 0, 0, 0.3);
}

.view-mode-button--active {
	background: rgba(238, 244, 250, 0.16);
	box-shadow: inset 0 0 0 1rpx rgba(238, 244, 250, 0.72);
}

.bottom-section {
	background: #081321;
	border-top-color: rgba(225, 234, 244, 0.24);
	box-shadow: 0 -10rpx 30rpx rgba(0, 0, 0, 0.24);
}

.action-row {
	min-height: 68rpx;
	background: rgba(8, 17, 29, 0.98);
}

.action-row :deep(.action-btn--delete),
.action-row :deep(.action-btn--primary) {
	background: rgba(10, 21, 34, 0.86);
	color: #f2f5f9;
	border-color: rgba(238, 244, 250, 0.86);
	box-shadow: 0 7rpx 18rpx rgba(0, 0, 0, 0.26);
}

.action-row :deep(.action-btn--save) {
	background: linear-gradient(135deg, #ef5147 0%, #d83932 100%);
	color: #fff;
	border-color: #f15a50;
	box-shadow: 0 8rpx 20rpx rgba(216, 57, 50, 0.3);
}

.action-row :deep(.action-btn--primary.action-btn--disabled) {
	background: rgba(42, 52, 65, 0.78);
	color: #838d9a;
	border-color: rgba(168, 178, 190, 0.32);
}

.material-panel {
	border-top-color: rgba(225, 234, 244, 0.18);
	background: #081321;
}

.material-grid-wrap {
	background: linear-gradient(180deg, #0c1725 0%, #081321 100%);
}

.refill-suggestion {
	background: linear-gradient(90deg, rgba(55, 36, 42, 0.96), rgba(24, 40, 53, 0.96));
	border-bottom-color: rgba(225, 234, 244, 0.14);
}

.refill-suggestion__dot {
	background: #ef5147;
	box-shadow: 0 0 0 8rpx rgba(239, 81, 71, 0.14);
}

.refill-suggestion__title,
.refill-suggestion__action {
	color: #fff;
}

.refill-suggestion__text {
	color: #aab4c1;
}

.refill-suggestion__action {
	background: #d83932;
}

.function-panel,
.function-panel__side {
	background: #091321;
	border-right-color: rgba(225, 234, 244, 0.12);
}

.function-panel__tab {
	color: #9fa9b6;
}

.function-panel__tab--active {
	background: rgba(28, 39, 53, 0.96);
	color: #f2f5f9;
}

.function-panel__tab--active::before {
	background: #ef5147;
}

.function-panel__cards {
	background: linear-gradient(180deg, #0c1725 0%, #081321 100%);
}

.function-card {
	background: rgba(16, 27, 41, 0.96);
	border-color: rgba(218, 228, 240, 0.2);
	box-shadow: 0 9rpx 22rpx rgba(0, 0, 0, 0.22);
}

.function-card--active {
	border-color: rgba(239, 81, 71, 0.58);
}

.function-card--muted {
	background: rgba(37, 47, 61, 0.96);
}

.function-card__label,
.material-empty__title {
	color: #eef2f7;
}

.material-empty,
.material-empty__text,
.in-use-tip {
	color: #929dab;
}

.material-empty__icon,
.material-empty__action {
	background: rgba(35, 46, 61, 0.94);
	border-color: rgba(225, 234, 244, 0.16);
	color: #eef2f7;
}
</style>
