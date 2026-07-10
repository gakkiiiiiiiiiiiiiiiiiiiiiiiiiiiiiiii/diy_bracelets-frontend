<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api } from '@/api';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { useDesignStore } from '@/stores/design';
import { MAX_SAVED_DESIGN_SLOTS, useSavedDesignsStore, type SavedDesign } from '@/stores/savedDesigns';
import type { BraceletBead } from '@/types';
import { beadsToComposition, compositionBeadCount } from '@/utils/designComposition';
import { openDesignStudio } from '@/utils/designNavigation';
import { loadProfileDetails } from '@/utils/profileDetails';

const DRAFT_STORAGE_KEY = 'bracelet-draft';
const DRAFT_RESTORE_KEY = 'diy-bracelets-restore-draft-on-next-design-open';
const CURRENT_BRACELET_STORAGE_KEY = 'diy-bracelets-current-bracelet-design';
const savedStore = useSavedDesignsStore();
const designStore = useDesignStore();

const userName = ref('');
const draftBeads = ref<BraceletBead[]>([]);
const previewCache = new Map<string, Array<{ id: string; image: string; style: Record<string, string | number> }>>();

const designList = computed(() => savedStore.list.slice(0, MAX_SAVED_DESIGN_SLOTS));
const usedSlotsText = computed(() => `${Math.min(savedStore.list.length, MAX_SAVED_DESIGN_SLOTS)}/${MAX_SAVED_DESIGN_SLOTS}`);
const hasDraft = computed(() => draftBeads.value.length > 0);
const draftCountText = computed(() => {
	const count = compositionBeadCount(beadsToComposition(draftBeads.value));
	return count > 0 ? `${count}颗珠` : '退出后未保存的设计';
});

onMounted(loadPageData);
onShow(loadPageData);

async function loadPageData() {
	loadDraft();
	try {
		const profile = await api.getProfile();
		if (profile?.name) userName.value = profile.name;
	} catch {
		if (!userName.value) userName.value = loadProfileDetails().name || '朋友';
	}
	await savedStore.fetchList();
}

function parseDraftBeads(raw: unknown): BraceletBead[] {
	try {
		const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((bead) => bead?.materialId && bead?.name && bead?.size && typeof bead.price === 'number')
			.map((bead, index) => ({
				id: bead.id || `bead-draft-${index}`,
				materialId: bead.materialId,
				name: bead.name,
				image: bead.image || '',
				size: Number(bead.size),
				price: Number(bead.price),
				quantity: 1,
				orderIndex: index,
			}));
	} catch {
		return [];
	}
}

function loadDraft() {
	draftBeads.value = parseDraftBeads(uni.getStorageSync(DRAFT_STORAGE_KEY));
}

function formatDate(iso: string) {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function previewLabel(beads: { length: number }): string {
	if (!beads.length) return '';
	return `${beads.length}颗`;
}

function previewBeads(beads: BraceletBead[], cacheKey: string) {
	const cached = previewCache.get(cacheKey);
	if (cached) return cached;
	const visibleBeads = beads.filter((bead) => bead.image);
	if (!visibleBeads.length) {
		previewCache.set(cacheKey, []);
		return [];
	}
	const count = Math.max(12, Math.min(24, visibleBeads.length));
	const result = Array.from({ length: count }, (_, index) => {
		const bead = visibleBeads[Math.floor((index / count) * visibleBeads.length)] ?? visibleBeads[index % visibleBeads.length];
		const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
		const size = 28 + (index % 5 === 0 ? 6 : index % 2 === 0 ? 3 : 0);
		const left = 158 + Math.cos(angle) * 80 - size / 2;
		const top = 146 + Math.sin(angle) * 64 - size / 2;
		return {
			id: `${cacheKey}-${index}`,
			image: bead.image,
			style: {
				left: `${left.toFixed(1)}rpx`,
				top: `${top.toFixed(1)}rpx`,
				width: `${size}rpx`,
				height: `${size}rpx`,
				zIndex: 10 + Math.round((Math.sin(angle) + 1) * 10),
			},
		};
	});
	previewCache.set(cacheKey, result);
	return result;
}

function designPreviewBeads(item: SavedDesign) {
	return previewBeads(item.beads, `${item.id}-${item.updatedAt}-${item.beads.length}`);
}

function goAdd() {
	if (savedStore.isFull) {
		uni.showToast({ title: '设计槽位已满', icon: 'none' });
		return;
	}
	uni.removeStorageSync(DRAFT_RESTORE_KEY);
	uni.removeStorageSync(CURRENT_BRACELET_STORAGE_KEY);
	designStore.clearDesign();
	openDesignStudio('bracelet');
}

function goUnsaved() {
	if (!hasDraft.value) {
		uni.showToast({ title: '暂无未保存设计', icon: 'none' });
		return;
	}
	uni.setStorageSync(DRAFT_RESTORE_KEY, '1');
	openDesignStudio('bracelet');
}

function goContinue(item: SavedDesign) {
	const beads = savedStore.getBeadsForDesign(item.id);
	if (!beads.length) {
		uni.showToast({ title: '设计暂无珠子', icon: 'none' });
		return;
	}
	designStore.applyDesignFromPlaza(
		beads.map((bead) => ({
			materialId: bead.materialId,
			name: bead.name,
			image: bead.image,
			size: bead.size,
			price: bead.price,
			quantity: 1,
		})),
		{ source: 'saved' },
	);
	openDesignStudio('bracelet', { editingSavedDesignId: item.id });
}

function clearUnsaved(e: Event) {
	e.stopPropagation?.();
	if (!hasDraft.value) return;
	uni.showModal({
		title: '删除未保存设计',
		content: '确定清除退出时保留的未保存设计？',
		success: (res) => {
			if (!res.confirm) return;
			uni.removeStorageSync(DRAFT_STORAGE_KEY);
			uni.removeStorageSync(DRAFT_RESTORE_KEY);
			draftBeads.value = [];
		},
	});
}

function onDelete(item: SavedDesign, e: Event) {
	e.stopPropagation?.();
	uni.showModal({
		title: '删除设计',
		content: `确定删除「${item.title}」？`,
		success: (res) => {
			if (res.confirm) savedStore.remove(item.id);
		},
	});
}

function goBack() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
}
</script>

<template>
	<view class="page app-subpage designs-list-page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->

		<view class="nav">
			<view class="nav-left" @tap="goBack">
				<text class="nav-icon">&lt;</text>
			</view>
			<view class="nav-title">我的设计</view>
			<view class="nav-right" />
		</view>

		<view class="header">
			<view class="header-name">{{ userName || '朋友' }}</view>
			<view class="header-sub">已保存的设计记录 · {{ usedSlotsText }}</view>
		</view>

		<view class="grid">
			<view class="add-banner" :class="{ 'add-banner--full': savedStore.isFull }" @tap="goAdd">
				<view class="add-banner__copy">
					<view class="add-banner__title">添加新设计</view>
					<view class="add-banner__sub">
						{{ savedStore.isFull ? '设计栏位已满，删除旧设计后可继续添加' : '从空白手串开始，重新搭配珠子' }}
					</view>
				</view>
				<view class="add-banner__icon">＋</view>
			</view>
			<view v-if="hasDraft" class="draft-strip" @tap="goUnsaved">
				<view class="draft-strip__icon">↺</view>
				<view class="draft-strip__copy">
					<view class="draft-strip__title">未保存的设计</view>
					<view class="draft-strip__sub">{{ draftCountText }}</view>
				</view>
				<view class="draft-strip__delete" @tap.stop="clearUnsaved($event)">×</view>
			</view>
			<view
				v-for="item in designList"
				:key="item.id"
				class="card design-card"
				@tap="goContinue(item)"
			>
				<view class="design-preview">
					<view v-if="previewLabel(item.beads)" class="card-tag">{{ previewLabel(item.beads) }}</view>
					<view class="card-delete" @tap.stop="onDelete(item, $event)">
						<text class="card-delete-x">×</text>
					</view>
					<view v-if="designPreviewBeads(item).length" class="bracelet-preview">
						<view class="bracelet-ring" />
						<view class="bracelet-logo">
							<view class="bracelet-logo-cn">养个石头</view>
							<view class="bracelet-logo-en">MineStone</view>
						</view>
						<view class="bracelet-shadow" />
						<image
							v-for="bead in designPreviewBeads(item)"
							:key="bead.id"
							class="bracelet-bead"
							:src="bead.image"
							mode="aspectFill"
							:style="bead.style"
						/>
					</view>
					<view v-else class="image-placeholder">
						<view class="image-mountain" />
					</view>
				</view>
				<view class="design-info">
					<view class="continue-title">继续设计</view>
					<view class="updated-text">上次更改：{{ formatDate(item.updatedAt) }}</view>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #fff;
	padding-bottom: 88rpx;
	box-sizing: border-box;
}

.nav {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 88rpx;
	padding: 0 24rpx;
	background: #fff;
	box-sizing: border-box;
}

.nav-left,
.nav-right {
	width: 80rpx;
}

.nav-icon {
	font-size: 40rpx;
	color: #222;
	line-height: 1;
}

.nav-title {
	font-size: 31rpx;
	font-weight: 900;
	color: #111;
}

/* #ifdef H5 */
.nav {
	height: calc(118rpx + env(safe-area-inset-top));
	padding-top: calc(34rpx + env(safe-area-inset-top));
}

.nav-left,
.nav-right {
	width: 216rpx;
}

.nav-title {
	position: absolute;
	left: 50%;
	transform: translateX(-50%);
}
/* #endif */

.header {
	padding: 28rpx 40rpx 22rpx;
	background: #fff;
}

.header-name {
	font-size: 34rpx;
	font-weight: 900;
	color: #111;
	line-height: 1.2;
}

.header-sub {
	margin-top: 12rpx;
	font-size: 25rpx;
	color: #9a9ca3;
}

.grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 24rpx;
	padding: 24rpx 40rpx 0;
	box-sizing: border-box;
}

.card {
	position: relative;
	min-width: 0;
	overflow: hidden;
	border-radius: 8rpx;
	background: #fbfbfc;
	box-shadow: 0 8rpx 24rpx rgba(30, 34, 44, 0.08);
}

.card:active {
	opacity: 0.76;
}

.add-banner,
.draft-strip {
	grid-column: 1 / -1;
	display: flex;
	align-items: center;
	box-sizing: border-box;
}

.add-banner {
	min-height: 92rpx;
	padding: 20rpx 22rpx;
	border-radius: 8rpx;
	background: #d92733;
	color: #fff;
	box-shadow: 0 10rpx 22rpx rgba(217, 39, 51, 0.2);
}

.add-banner--full {
	background: #a7a9b0;
	box-shadow: none;
}

.add-banner__copy,
.draft-strip__copy {
	flex: 1;
	min-width: 0;
}

.add-banner__title {
	font-size: 30rpx;
	font-weight: 900;
	line-height: 1.2;
}

.add-banner__sub {
	margin-top: 8rpx;
	font-size: 22rpx;
	font-weight: 900;
	line-height: 1.25;
	opacity: 0.92;
}

.add-banner__icon {
	width: 48rpx;
	height: 48rpx;
	margin-left: 20rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.18);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 36rpx;
	font-weight: 700;
	line-height: 1;
	flex-shrink: 0;
}

.draft-strip {
	min-height: 78rpx;
	margin-top: -6rpx;
	padding: 16rpx 20rpx;
	border-radius: 8rpx;
	background: #f7f7f9;
	color: #202229;
}

.draft-strip__icon {
	width: 44rpx;
	height: 44rpx;
	margin-right: 16rpx;
	border-radius: 50%;
	background: #fff;
	color: #8d9098;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 28rpx;
	font-weight: 900;
	flex-shrink: 0;
}

.draft-strip__title {
	font-size: 26rpx;
	font-weight: 900;
	line-height: 1.2;
}

.draft-strip__sub {
	margin-top: 6rpx;
	color: #9a9da5;
	font-size: 21rpx;
	font-weight: 800;
	line-height: 1.2;
}

.draft-strip__delete {
	width: 38rpx;
	height: 38rpx;
	margin-left: 18rpx;
	border-radius: 50%;
	background: #fff;
	color: #a7a9b0;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 28rpx;
	font-weight: 900;
	line-height: 1;
	flex-shrink: 0;
}

.bracelet-bead {
	position: absolute;
	border-radius: 50%;
	background: #f0f1f4;
	box-shadow:
		0 6rpx 10rpx rgba(49, 55, 68, 0.15),
		inset 4rpx 5rpx 8rpx rgba(255, 255, 255, 0.46);
}

.design-card {
	display: flex;
	flex-direction: column;
	min-height: 520rpx;
}

.design-preview {
	position: relative;
	height: 320rpx;
	background: #fbfbfc;
	overflow: hidden;
}

.bracelet-preview {
	position: absolute;
	inset: 0;
}

.bracelet-ring {
	position: absolute;
	left: 50%;
	top: 64rpx;
	width: 178rpx;
	height: 178rpx;
	border: 5rpx solid rgba(214, 216, 221, 0.78);
	border-radius: 50%;
	transform: translateX(-50%);
	box-sizing: border-box;
}

.bracelet-logo {
	position: absolute;
	left: 50%;
	top: 132rpx;
	z-index: 1;
	width: 112rpx;
	color: rgba(154, 150, 130, 0.48);
	text-align: center;
	transform: translateX(-50%);
	pointer-events: none;
}

.bracelet-logo-cn {
	font-size: 16rpx;
	font-weight: 900;
	line-height: 1.05;
}

.bracelet-logo-en {
	margin-top: 2rpx;
	font-size: 10rpx;
	font-weight: 800;
	line-height: 1;
}

.bracelet-shadow {
	position: absolute;
	left: 50%;
	top: 216rpx;
	width: 168rpx;
	height: 30rpx;
	border-radius: 50%;
	background: radial-gradient(ellipse, rgba(73, 78, 88, 0.12), rgba(73, 78, 88, 0));
	transform: translateX(-50%);
}

.card-tag {
	position: absolute;
	top: 18rpx;
	left: 18rpx;
	z-index: 3;
	padding: 6rpx 12rpx;
	border: 2rpx solid #c8cbd1;
	border-radius: 6rpx;
	background: rgba(255, 255, 255, 0.9);
	color: #8c8f96;
	font-size: 22rpx;
	font-weight: 800;
}

.card-delete {
	position: absolute;
	top: 18rpx;
	right: 18rpx;
	z-index: 4;
	width: 42rpx;
	height: 42rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 4rpx solid #d92733;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.94);
	box-sizing: border-box;
}

.card-delete-x {
	color: #d92733;
	font-size: 30rpx;
	font-weight: 900;
	line-height: 1;
}

.image-placeholder {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 78rpx;
	height: 54rpx;
	transform: translate(-50%, -50%);
}

.image-placeholder::before,
.image-placeholder::after {
	content: '';
	position: absolute;
	border-radius: 50%;
	background: #9da0a7;
}

.image-placeholder::before {
	left: 8rpx;
	top: 6rpx;
	width: 10rpx;
	height: 10rpx;
}

.image-placeholder::after {
	right: 10rpx;
	top: 10rpx;
	width: 12rpx;
	height: 12rpx;
}

.image-mountain {
	position: absolute;
	left: 4rpx;
	bottom: 4rpx;
	width: 66rpx;
	height: 28rpx;
	border-left: 6rpx solid #9da0a7;
	border-bottom: 6rpx solid #9da0a7;
	transform: skewX(-32deg);
}

.design-info {
	min-height: 160rpx;
	display: flex;
	flex-direction: column;
	justify-content: center;
	padding: 18rpx 18rpx 20rpx;
	border-top: 1rpx solid #ececef;
	background: #fff;
	text-align: center;
	box-sizing: border-box;
}

.continue-title {
	color: #181a21;
	font-size: 30rpx;
	font-weight: 900;
}

.updated-text {
	margin-top: 12rpx;
	color: #a7a9b0;
	font-size: 21rpx;
	font-weight: 800;
}

</style>
