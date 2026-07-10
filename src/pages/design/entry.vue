<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useDesignStore } from '@/stores/design';
import { useSavedDesignsStore, type SavedDesign } from '@/stores/savedDesigns';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { openDesignStudio } from '@/utils/designNavigation';

const savedStore = useSavedDesignsStore();
const designStore = useDesignStore();

const entryCards = [
	{
		id: 'bracelet',
		title: '手串定制',
		subtitle: '从零开始，发挥您的创意',
		description: '自由选择材料形状和尺寸，打造您最满意的手串',
		tone: 'white',
		gem: '/static/materials/reference-crystals/blue-moonstone/blue-moonstone-preview.png',
	},
] as const;

const secondaryEntries = [
	{
		id: 'single',
		title: '单珠选购',
		description: '挑选散珠补充搭配',
		tone: 'pink',
		gem: '/static/materials/reference-crystals/strawberry-crystal/strawberry-crystal-preview.png',
	},
	{
		id: 'plaza',
		title: '设计广场',
		description: '从大家的搭配里找灵感',
		tone: 'purple',
		gem: '/static/materials/reference-crystals/uruguay-amethyst/uruguay-amethyst-preview.png',
	},
] as const;

const recentDesigns = computed(() => savedStore.list.slice(0, 6));

onMounted(loadSavedDesigns);
onShow(loadSavedDesigns);

async function loadSavedDesigns() {
	if (!savedStore.loaded) {
		await savedStore.fetchList();
	}
}

type EntryId = (typeof entryCards)[number]['id'] | (typeof secondaryEntries)[number]['id'];

function openEntry(id: EntryId) {
	if (id === 'bracelet') {
		openDesignStudio('bracelet');
		return;
	}
	if (id === 'single') {
		designStore.clearDesign();
		openDesignStudio('single');
		return;
	}
	if (id === 'plaza') {
		openPlaza();
	}
}

function openPlaza() {
	uni.navigateTo({ url: '/pages/plaza/plaza' });
}

function openMyDesigns() {
	uni.navigateTo({ url: '/pages/designs/list' });
}

function previewImages(item: SavedDesign) {
	return item.beads
		.map((bead) => bead.image)
		.filter(Boolean)
		.slice(0, 8);
}

function formatUpdatedAt(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value.replace('T', ' ').slice(0, 16);
	}
	const pad = (num: number) => String(num).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function miniBeadStyle(index: number, total: number) {
	const count = Math.max(total, 5);
	const angle = -82 + index * (360 / count);
	return {
		transform: `rotate(${angle}deg) translate(42rpx) rotate(${-angle}deg)`,
	};
}

function continueDesign(item: SavedDesign) {
	const beads = savedStore.getBeadsForDesign(item.id);
	if (!beads.length) {
		openMyDesigns();
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
</script>

<template>
	<view class="page design-entry-page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="hero">
			<view class="hero-title">开始您的手串设计之旅</view>
			<view class="hero-sub">选择您喜欢的设计方式</view>
		</view>

		<view v-if="recentDesigns.length" class="mine">
			<view class="mine-head" @tap="openMyDesigns">
				<view>
					<view class="mine-title">我的设计</view>
					<view class="mine-sub">查看已保存的设计记录</view>
				</view>
				<view class="mine-more">更多 ›</view>
			</view>
			<scroll-view class="mine-scroll" scroll-x :show-scrollbar="false">
				<view class="mine-list">
					<view v-for="item in recentDesigns" :key="item.id" class="mine-card" @tap="continueDesign(item)">
						<view class="mine-preview">
							<view v-if="previewImages(item).length" class="mini-bracelet">
								<image
									v-for="(image, index) in previewImages(item)"
									:key="`${item.id}-${index}`"
									class="mine-bead"
									:src="image"
									mode="aspectFill"
									:style="miniBeadStyle(index, previewImages(item).length)"
								/>
							</view>
							<view v-else class="mine-empty">
								<view class="empty-curve" />
							</view>
						</view>
						<view class="mine-card-title">定制商品</view>
						<view class="mine-time">{{ formatUpdatedAt(item.updatedAt) }}</view>
						<view class="mine-action">继续设计</view>
					</view>
				</view>
			</scroll-view>
		</view>

		<view class="entry-list">
			<view
				v-for="(card, index) in entryCards"
				:key="card.id"
				class="entry-card"
				:style="{ animationDelay: `${index * 70}ms` }"
				@tap="openEntry(card.id)"
			>
				<view class="entry-stone-wrap">
					<view class="entry-stone" :class="`entry-stone--${card.tone}`">
						<image class="entry-gem" :src="card.gem" mode="aspectFill" />
						<view class="entry-stone-eye entry-stone-eye--left" />
						<view class="entry-stone-eye entry-stone-eye--right" />
						<view class="entry-stone-mouth" />
					</view>
					<view class="entry-stone-shadow" />
				</view>
				<view class="entry-body">
					<view class="entry-title">{{ card.title }}</view>
					<view v-if="card.subtitle" class="entry-subtitle">{{ card.subtitle }}</view>
					<view class="entry-desc">{{ card.description }}</view>
				</view>
			</view>
		</view>

		<view class="entry-list entry-list--secondary">
			<view
				v-for="item in secondaryEntries"
				:key="item.id"
				class="entry-card entry-card--secondary"
				@tap="openEntry(item.id)"
			>
				<view class="secondary-gem" :class="`secondary-gem--${item.tone}`">
					<image class="secondary-gem__img" :src="item.gem" mode="aspectFill" />
				</view>
				<view class="entry-body">
					<view class="entry-title">{{ item.title }}</view>
					<view class="entry-desc">{{ item.description }}</view>
				</view>
				<view class="secondary-arrow">→</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #fff;
	padding: calc(92rpx + env(safe-area-inset-top)) 38rpx 130rpx;
	box-sizing: border-box;
}

/* #ifdef H5 */
.page {
	padding-top: calc(118rpx + env(safe-area-inset-top));
}
/* #endif */

.hero {
	margin-bottom: 24rpx;
	animation: fade-up 0.34s ease-out both;
}

.hero-title {
	color: #202329;
	font-size: 38rpx;
	font-weight: 900;
	letter-spacing: 0;
	line-height: 1.22;
}

.hero-sub {
	margin-top: 8rpx;
	color: #8d9098;
	font-size: 26rpx;
	font-weight: 700;
}

.mine {
	margin-top: 28rpx;
	margin-bottom: 24rpx;
	animation: fade-up 0.38s 0.04s ease-out both;
}

.mine-head {
	min-height: 92rpx;
	padding: 0 22rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-radius: 8rpx;
	background: #db2934;
	color: #fff;
	box-sizing: border-box;
	box-shadow: 0 8rpx 16rpx rgba(219, 41, 52, 0.15);
}

.mine-title {
	font-size: 28rpx;
	font-weight: 900;
}

.mine-sub {
	margin-top: 6rpx;
	font-size: 22rpx;
	font-weight: 800;
	color: rgba(255, 255, 255, 0.86);
}

.mine-more {
	font-size: 24rpx;
	font-weight: 900;
	color: rgba(255, 255, 255, 0.9);
}

.mine-scroll {
	width: 100%;
	height: 334rpx;
	margin-top: 14rpx;
	padding: 0 0 10rpx;
	box-sizing: border-box;
}

.mine-list {
	display: inline-flex;
	gap: 18rpx;
	padding: 0 2rpx;
	box-sizing: border-box;
}

.mine-card {
	width: 238rpx;
	height: 312rpx;
	border-radius: 8rpx;
	background: #fff;
	padding: 24rpx 0 0;
	box-sizing: border-box;
	box-shadow: 0 8rpx 18rpx rgba(38, 42, 52, 0.08);
	overflow: hidden;
}

.mine-card:active,
.entry-card:active {
	transform: scale(0.985);
}

.mine-preview {
	height: 118rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.mini-bracelet {
	position: relative;
	width: 104rpx;
	height: 104rpx;
	border-radius: 50%;
	border: 1rpx solid rgba(223, 226, 233, 0.76);
	background: radial-gradient(circle, rgba(251, 251, 252, 0.92) 0 38%, rgba(244, 245, 248, 0.7) 39% 40%, transparent 42%);
}

.mine-bead {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 24rpx;
	height: 24rpx;
	border-radius: 50%;
	background: #f2f3f6;
	margin: -12rpx 0 0 -12rpx;
	box-shadow: 0 2rpx 5rpx rgba(36, 39, 48, 0.13);
}

.mine-empty {
	position: relative;
	width: 124rpx;
	height: 124rpx;
	border-radius: 8rpx;
	background: #f2f3f5;
}

.empty-curve {
	position: absolute;
	left: 32rpx;
	top: 36rpx;
	width: 58rpx;
	height: 44rpx;
	border-radius: 4rpx;
	border: 8rpx solid #9ba1a8;
	box-sizing: border-box;
	transform: none;
}

.empty-curve::before {
	content: '';
	position: absolute;
	right: 7rpx;
	top: 7rpx;
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
	background: #9ba1a8;
}

.empty-curve::after {
	content: '';
	position: absolute;
	left: 7rpx;
	bottom: 6rpx;
	width: 28rpx;
	height: 20rpx;
	background: linear-gradient(135deg, transparent 0 45%, #9ba1a8 46% 100%);
}

.mine-card-title {
	margin-top: 18rpx;
	color: #1f232b;
	font-size: 26rpx;
	font-weight: 900;
	text-align: center;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.mine-time {
	margin-top: 6rpx;
	color: #b5b6bc;
	font-size: 22rpx;
	font-weight: 800;
	text-align: center;
	white-space: nowrap;
}

.mine-action {
	margin-top: 18rpx;
	height: 62rpx;
	border-top: 1rpx solid #f0f1f4;
	color: #b4b6bd;
	font-size: 25rpx;
	font-weight: 800;
	line-height: 62rpx;
	text-align: center;
}

.entry-list {
	display: flex;
	flex-direction: column;
	gap: 18rpx;
	margin-top: 22rpx;
}

.entry-list--secondary {
	margin-top: 18rpx;
	gap: 0;
	border: 1rpx solid rgba(238, 239, 243, 0.95);
	border-radius: 8rpx;
	background: #fff;
	box-shadow: 0 8rpx 18rpx rgba(45, 49, 62, 0.06);
	overflow: hidden;
}

.entry-card {
	position: relative;
	min-height: 332rpx;
	border-radius: 8rpx;
	background: #fbfbfc;
	box-shadow: 0 8rpx 18rpx rgba(45, 49, 62, 0.08);
	border: 1rpx solid rgba(238, 239, 243, 0.95);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 18rpx;
	justify-content: center;
	padding: 50rpx 42rpx 42rpx;
	box-sizing: border-box;
	transition: transform 120ms ease, box-shadow 160ms ease;
	animation: card-in 0.44s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.entry-card--secondary {
	min-height: 116rpx;
	padding: 18rpx 54rpx 18rpx 24rpx;
	border: 0;
	border-bottom: 1rpx solid #f0f1f4;
	border-radius: 0;
	background: #fff;
	box-shadow: none;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: flex-start;
	gap: 20rpx;
	overflow: hidden;
	animation: none;
}

.entry-card--secondary:last-child {
	border-bottom: 0;
}

.secondary-gem {
	position: relative;
	width: 56rpx;
	height: 56rpx;
	border-radius: 50%;
	background: #f5f5f7;
	box-shadow:
		inset 6rpx 8rpx 12rpx rgba(255, 255, 255, 0.55),
		0 4rpx 10rpx rgba(30, 34, 46, 0.1);
	overflow: hidden;
	flex-shrink: 0;
}

.secondary-gem::after {
	content: '';
	position: absolute;
	left: 11rpx;
	top: 8rpx;
	width: 19rpx;
	height: 13rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.5);
	transform: rotate(-24deg);
}

.secondary-gem--pink {
	background: #f6d8de;
}

.secondary-gem--purple {
	background: #59417a;
}

.secondary-gem__img {
	width: 100%;
	height: 100%;
	display: block;
}

.entry-stone-wrap {
	position: relative;
	width: 126rpx;
	height: 112rpx;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.entry-stone-wrap--compact {
	width: 112rpx;
	height: 98rpx;
}

.entry-stone {
	position: relative;
	z-index: 1;
	width: 78rpx;
	height: 66rpx;
	border: 4rpx solid #202329;
	border-radius: 50% 48% 45% 52%;
	background: #fff;
	transform: rotate(-10deg);
	box-sizing: border-box;
	overflow: hidden;
	animation: stone-breathe 3.2s ease-in-out infinite;
}

.entry-stone--pink {
	background: #fff;
}

.entry-stone--purple {
	background: #fff;
}

.entry-stone--pink::after,
.entry-stone--purple::after {
	content: '';
	position: absolute;
	right: 5rpx;
	bottom: 4rpx;
	z-index: 1;
	width: 35rpx;
	height: 32rpx;
	border-radius: 50%;
	background: #ea8796;
}

.entry-stone--purple::after {
	background: #5a4f96;
}

.entry-gem {
	position: absolute;
	right: 7rpx;
	bottom: 5rpx;
	z-index: 1;
	width: 42rpx;
	height: 32rpx;
	border-radius: 8rpx;
	opacity: 0.9;
	transform: rotate(10deg);
	box-shadow: inset 0 0 10rpx rgba(255, 255, 255, 0.5);
}

.entry-stone-shadow {
	position: absolute;
	right: 7rpx;
	bottom: 7rpx;
	width: 66rpx;
	height: 27rpx;
	border-radius: 50%;
	background: #202329;
	transform: rotate(-16deg);
}

.entry-stone-eye {
	position: absolute;
	top: 25rpx;
	width: 6rpx;
	height: 6rpx;
	border-radius: 50%;
	background: #202329;
	z-index: 2;
}

.entry-stone-eye--left {
	left: 23rpx;
}

.entry-stone-eye--right {
	right: 22rpx;
}

.entry-stone-mouth {
	position: absolute;
	left: 31rpx;
	top: 38rpx;
	width: 13rpx;
	height: 7rpx;
	border-bottom: 3rpx solid #202329;
	border-radius: 0 0 999rpx 999rpx;
	z-index: 2;
}

.entry-body {
	width: 100%;
	min-width: 0;
	text-align: center;
}

.entry-card--secondary .entry-body {
	flex: 1;
	text-align: left;
}

.entry-title {
	color: #202329;
	font-size: 34rpx;
	font-weight: 900;
	letter-spacing: 0;
}

.entry-subtitle {
	margin-top: 12rpx;
	color: #9a9da5;
	font-size: 26rpx;
	font-weight: 800;
}

.entry-desc {
	margin-top: 8rpx;
	color: #9a9da5;
	font-size: 25rpx;
	font-weight: 700;
	line-height: 1.48;
	text-align: center;
}

.entry-card--secondary .entry-title {
	font-size: 29rpx;
	line-height: 1.2;
}

.entry-card--secondary .entry-desc {
	margin-top: 6rpx;
	font-size: 22rpx;
	line-height: 1.25;
	text-align: left;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.secondary-arrow {
	position: absolute;
	right: 28rpx;
	top: 50%;
	transform: translateY(-50%);
	color: #202329;
	font-size: 34rpx;
	font-weight: 900;
	line-height: 1;
}

@keyframes fade-up {
	from {
		opacity: 0;
		transform: translateY(16rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes card-in {
	from {
		opacity: 0;
		transform: translateY(28rpx) scale(0.985);
	}
	to {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

@keyframes stone-breathe {
	0%,
	100% {
		transform: rotate(-10deg) translateY(0);
	}
	50% {
		transform: rotate(-7deg) translateY(-3rpx);
	}
}
</style>
