<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import type { HomeFeaturedWork, HomeMaterialEntry } from '@/api';
import { useContentStore } from '@/stores/content';
import { useMaterialsStore } from '@/stores/materials';
import { openDesignStudio } from '@/utils/designNavigation';

const contentStore = useContentStore();
const materialsStore = useMaterialsStore();
const { brand, home, diy } = storeToRefs(contentStore);

const heroTitleLines = computed(() => home.value.hero.title.split('\n').filter(Boolean));

const pageStyle = computed(() =>
	`--brand-primary:${brand.value.primaryColor};--brand-secondary:${brand.value.secondaryColor};`,
);

onMounted(() => {
	void contentStore.fetchContent();
});

function openPrimaryAction() {
	openPath(home.value.hero.primaryAction.path);
}

function openMaterial(item: HomeMaterialEntry) {
	materialsStore.setCategory(item.categoryId);
	openDesignStudio('bracelet');
}

function openPath(path: string) {
	if (!path) return;
	if (path === '/pages/design/design' || path === '/pages/design/entry') {
		openDesignStudio('bracelet');
		return;
	}
	if (path === '/pages/inspiration/inspiration') {
		uni.switchTab({ url: path });
		return;
	}
	uni.navigateTo({ url: path });
}

function openWork(work: HomeFeaturedWork) {
	openPath(work.path);
}
</script>

<template>
	<view class="page" :style="pageStyle">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->

		<view class="topbar">
			<view class="wordmark">
				<text class="wordmark__cn">{{ brand.name }}</text>
				<text class="wordmark__en">{{ brand.nameEn }}</text>
			</view>
			<text class="topbar__tagline">{{ brand.tagline }}</text>
		</view>

		<view class="hero">
			<text class="eyebrow hero__eyebrow">{{ home.hero.eyebrow }}</text>
			<view class="hero__title">
				<text v-for="line in heroTitleLines" :key="line" class="hero__title-line">{{ line }}</text>
			</view>
			<text class="hero__description">{{ home.hero.description }}</text>

			<view class="material-stage" aria-hidden="true">
				<image class="material-stage__image" :src="home.hero.image" mode="aspectFill" />
				<view class="material-stage__meta">
					<text class="material-stage__label">{{ diy.stageLabel }}</text>
					<text class="material-stage__hint">{{ diy.stageHint }}</text>
				</view>
			</view>

			<view class="experience-points">
				<view v-for="point in diy.experiencePoints" :key="point.id" class="experience-point">
					<view class="experience-point__mark" />
					<text>{{ point.label }}</text>
				</view>
			</view>

			<view class="primary-action" hover-class="primary-action--pressed" @tap="openPrimaryAction">
				<text>{{ home.hero.primaryAction.label }}</text>
				<view class="arrow arrow--light" />
			</view>
		</view>

		<view class="section materials-section">
			<view class="section-heading">
				<text class="eyebrow">{{ home.materials.eyebrow }}</text>
				<text class="section-heading__title">{{ home.materials.title }}</text>
				<text class="section-heading__description">{{ home.materials.description }}</text>
			</view>

			<view class="material-grid">
				<view
					v-for="item in home.materials.items"
					:key="item.id"
					class="material-entry"
					hover-class="material-entry--pressed"
					@tap="openMaterial(item)"
				>
					<view class="material-entry__visual">
						<image class="material-entry__image" :src="item.image" mode="aspectFit" />
					</view>
					<text class="material-entry__name">{{ item.name }}</text>
					<text class="material-entry__caption">{{ item.caption }}</text>
				</view>
			</view>
		</view>

		<view class="section featured-section">
			<view class="featured-heading">
				<view class="section-heading section-heading--compact">
					<text class="eyebrow eyebrow--pink">{{ home.featured.eyebrow }}</text>
					<text class="section-heading__title">{{ home.featured.title }}</text>
				</view>
				<view class="text-action" hover-class="text-action--pressed" @tap="openPath(home.featured.actionPath)">
					<text>{{ home.featured.actionLabel }}</text>
					<view class="arrow" />
				</view>
			</view>

			<scroll-view class="work-rail" scroll-x :show-scrollbar="false">
				<view class="work-track">
					<view
						v-for="work in home.featured.items"
						:key="work.id"
						class="work-card"
						hover-class="work-card--pressed"
						@tap="openWork(work)"
					>
						<image class="work-card__image" :src="work.image" mode="aspectFill" />
						<view class="work-card__body">
							<text class="work-card__title">{{ work.title }}</text>
							<text class="work-card__caption">{{ work.caption }}</text>
						</view>
					</view>
				</view>
			</scroll-view>
		</view>

		<view class="brand-footer">
			<text class="brand-footer__name">{{ brand.name }} {{ brand.nameEn }}</text>
			<view class="brand-footer__line" />
			<text class="brand-footer__tagline">{{ brand.tagline }}</text>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	--brand-primary: #527985;
	--brand-secondary: #d0a09d;
	min-height: 100vh;
	box-sizing: border-box;
	padding-bottom: calc(148rpx + env(safe-area-inset-bottom));
	background: #f4f6f4;
	color: #1d292b;
	letter-spacing: 0;
}

.topbar {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: 24rpx;
	padding: calc(40rpx + env(safe-area-inset-top)) 32rpx 24rpx;
}

.wordmark {
	display: flex;
	align-items: baseline;
	gap: 12rpx;
	min-width: 0;
}

.wordmark__cn {
	font-size: 40rpx;
	font-weight: 700;
	line-height: 1;
}

.wordmark__en {
	color: var(--brand-primary);
	font-size: 20rpx;
	font-weight: 700;
	line-height: 1;
}

.topbar__tagline {
	max-width: 250rpx;
	color: #687476;
	font-size: 21rpx;
	line-height: 1.35;
	text-align: right;
}

.hero {
	padding: 54rpx 32rpx 0;
}

.eyebrow {
	display: block;
	color: var(--brand-primary);
	font-size: 19rpx;
	font-weight: 700;
	line-height: 1.35;
}

.eyebrow--pink {
	color: #a46f6c;
}

.hero__title {
	display: flex;
	flex-direction: column;
	margin-top: 18rpx;
}

.hero__title-line {
	font-size: 66rpx;
	font-weight: 600;
	line-height: 1.14;
}

.hero__description {
	display: block;
	max-width: 610rpx;
	margin-top: 24rpx;
	color: #5f6b6d;
	font-size: 27rpx;
	line-height: 1.7;
}

.material-stage {
	position: relative;
	width: 686rpx;
	height: 515rpx;
	overflow: hidden;
	margin: 40rpx auto 0;
	border-radius: 14rpx;
	background: #ebe9e5;
}

.material-stage__image {
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
}

.material-stage__meta {
	position: absolute;
	left: 24rpx;
	top: 24rpx;
	z-index: 2;
	display: flex;
	width: 228rpx;
	box-sizing: border-box;
	flex-direction: column;
	padding: 20rpx;
	border: 1rpx solid rgba(255, 255, 255, 0.78);
	border-radius: 10rpx;
	background: rgba(248, 249, 247, 0.88);
}

.material-stage__label {
	color: var(--brand-primary);
	font-size: 17rpx;
	font-weight: 700;
	line-height: 1.3;
}

.material-stage__hint {
	margin-top: 10rpx;
	color: #596668;
	font-size: 18rpx;
	line-height: 1.5;
}

.experience-points {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12rpx;
	margin-top: 8rpx;
	padding: 24rpx 0;
	border-top: 1rpx solid rgba(29, 41, 43, 0.1);
}

.experience-point {
	display: flex;
	align-items: center;
	gap: 9rpx;
	min-width: 0;
	color: #4c5b5d;
	font-size: 20rpx;
	line-height: 1.3;
	white-space: nowrap;
}

.experience-point__mark {
	width: 8rpx;
	height: 8rpx;
	flex-shrink: 0;
	border-radius: 50%;
	background: var(--brand-secondary);
}

.primary-action {
	display: flex;
	height: 104rpx;
	align-items: center;
	justify-content: space-between;
	box-sizing: border-box;
	margin-top: 10rpx;
	padding: 0 32rpx;
	border-radius: 14rpx;
	background: var(--brand-primary);
	color: #fff;
	font-size: 29rpx;
	font-weight: 600;
	transition: opacity 120ms ease, transform 120ms ease;
}

.primary-action--pressed,
.material-entry--pressed,
.work-card--pressed,
.text-action--pressed {
	opacity: 0.72;
}

.primary-action--pressed {
	transform: scale(0.99);
}

.arrow {
	width: 17rpx;
	height: 17rpx;
	box-sizing: border-box;
	border-top: 2rpx solid #1d292b;
	border-right: 2rpx solid #1d292b;
	transform: rotate(45deg);
}

.arrow--light {
	border-color: #fff;
}

.section {
	padding: 112rpx 32rpx 0;
}

.section-heading {
	display: flex;
	flex-direction: column;
}

.section-heading__title {
	margin-top: 12rpx;
	font-size: 46rpx;
	font-weight: 600;
	line-height: 1.22;
}

.section-heading__description {
	margin-top: 14rpx;
	color: #697577;
	font-size: 24rpx;
	line-height: 1.55;
}

.material-grid {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
	row-gap: 18rpx;
	margin-top: 38rpx;
}

.material-entry {
	width: 333rpx;
	box-sizing: border-box;
	padding: 24rpx;
	border: 1rpx solid rgba(29, 41, 43, 0.08);
	border-radius: 12rpx;
	background: #fff;
	transition: opacity 120ms ease;
}

.material-entry__visual {
	display: flex;
	height: 180rpx;
	align-items: center;
	justify-content: center;
	background: #eef1ee;
}

.material-entry:nth-child(2n) .material-entry__visual {
	background: #f2eae9;
}

.material-entry__image {
	width: 156rpx;
	height: 156rpx;
	filter: drop-shadow(0 12rpx 16rpx rgba(28, 47, 51, 0.16));
}

.material-entry__name,
.material-entry__caption,
.work-card__title,
.work-card__caption {
	display: block;
}

.material-entry__name {
	margin-top: 20rpx;
	font-size: 27rpx;
	font-weight: 600;
	line-height: 1.3;
}

.material-entry__caption {
	margin-top: 8rpx;
	color: #7b8587;
	font-size: 20rpx;
	line-height: 1.4;
}

.featured-section {
	padding-right: 0;
	background: #e8efed;
	margin-top: 116rpx;
	padding-top: 92rpx;
	padding-bottom: 96rpx;
}

.featured-heading {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: 24rpx;
	padding-right: 32rpx;
}

.section-heading--compact {
	min-width: 0;
}

.text-action {
	display: flex;
	height: 54rpx;
	align-items: center;
	gap: 14rpx;
	flex-shrink: 0;
	color: #1d292b;
	font-size: 22rpx;
	line-height: 1;
}

.work-rail {
	width: 100%;
	margin-top: 40rpx;
	white-space: nowrap;
}

.work-track {
	display: inline-flex;
	gap: 20rpx;
	padding-right: 32rpx;
}

.work-card {
	display: inline-flex;
	width: 470rpx;
	flex-direction: column;
	overflow: hidden;
	border-radius: 12rpx;
	background: #fff;
	vertical-align: top;
	white-space: normal;
	transition: opacity 120ms ease;
}

.work-card__image {
	width: 470rpx;
	height: 500rpx;
	background: #e6e8e5;
}

.work-card__body {
	padding: 24rpx 24rpx 28rpx;
}

.work-card__title {
	font-size: 28rpx;
	font-weight: 600;
	line-height: 1.35;
}

.work-card__caption {
	margin-top: 10rpx;
	color: #778184;
	font-size: 20rpx;
	line-height: 1.45;
}

.brand-footer {
	display: flex;
	align-items: center;
	gap: 18rpx;
	padding: 58rpx 32rpx 0;
	color: #738082;
}

.brand-footer__name {
	font-size: 20rpx;
	font-weight: 700;
	line-height: 1.3;
}

.brand-footer__line {
	width: 48rpx;
	height: 1rpx;
	background: rgba(29, 41, 43, 0.24);
}

.brand-footer__tagline {
	font-size: 19rpx;
	line-height: 1.3;
}

@media (min-width: 768px) {
	.page {
		width: 750rpx;
		margin: 0 auto;
	}
}
</style>
