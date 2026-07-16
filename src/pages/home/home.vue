<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { api, type DesignDetail, type HomeFeaturedWork, type HomeMaterialEntry } from '@/api';
import { RESOLVED_API_BASE } from '@/config';
import { useContentStore } from '@/stores/content';
import { useMaterialsStore } from '@/stores/materials';
import { openDesignStudio } from '@/utils/designNavigation';

const contentStore = useContentStore();
const materialsStore = useMaterialsStore();
const { brand, home, diy } = storeToRefs(contentStore);

const heroTitleLines = computed(() => home.value.hero.title.split('\n').filter(Boolean));

interface HeroBracelet {
	id: string;
	image: string;
	style: string;
	path?: string;
}

const heroBraceletRoot = '/static/brand/hero-bracelets';
const bracelet = (id: string, style: string): HeroBracelet => ({
	id,
	image: `${heroBraceletRoot}/${id}.png`,
	style,
});

const defaultHeroColumns: HeroBracelet[][] = [
	[
		bracelet('7639051728465270783', 'transform:translate3d(-8rpx, 8rpx, 0) rotate(-9deg) scale(.92)'),
		bracelet('7655534189181866922', 'transform:translate3d(9rpx, -5rpx, 0) rotate(7deg) scale(1.04)'),
		bracelet('7649012508712308900', 'transform:translate3d(-4rpx, 2rpx, 0) rotate(4deg) scale(.96)'),
		bracelet('7657186710090451114', 'transform:translate3d(11rpx, 5rpx, 0) rotate(-6deg) scale(1.06)'),
		bracelet('7657826630543722323', 'transform:translate3d(-10rpx, -3rpx, 0) rotate(8deg) scale(.9)'),
		bracelet('7661633324633036230', 'transform:translate3d(6rpx, 7rpx, 0) rotate(-3deg) scale(1)'),
	],
	[
		bracelet('7643345746403059172', 'transform:translate3d(5rpx, -7rpx, 0) rotate(5deg) scale(1.05)'),
		bracelet('7651209573554940074', 'transform:translate3d(-9rpx, 4rpx, 0) rotate(-7deg) scale(.91)'),
		bracelet('7652980327619731689', 'transform:translate3d(7rpx, 8rpx, 0) rotate(9deg) scale(.98)'),
		bracelet('7655178491272693183', 'transform:translate3d(-4rpx, -5rpx, 0) rotate(-4deg) scale(1.07)'),
		bracelet('7661247813501705956', 'transform:translate3d(8rpx, 2rpx, 0) rotate(6deg) scale(.93)'),
		bracelet('7655961039758841590', 'transform:translate3d(-6rpx, 7rpx, 0) rotate(-8deg) scale(1.02)'),
	],
	[
		bracelet('7642322075953251654', 'transform:translate3d(8rpx, 6rpx, 0) rotate(8deg) scale(.94)'),
		bracelet('7642648603174371775', 'transform:translate3d(-7rpx, -4rpx, 0) rotate(-5deg) scale(1.06)'),
		bracelet('7648464685637100799', 'transform:translate3d(10rpx, 1rpx, 0) rotate(4deg) scale(.9)'),
		bracelet('7650151679195842259', 'transform:translate3d(-5rpx, 8rpx, 0) rotate(-9deg) scale(1.03)'),
		bracelet('7653505403360194921', 'transform:translate3d(6rpx, -6rpx, 0) rotate(7deg) scale(.97)'),
		bracelet('7657483456251294454', 'transform:translate3d(-9rpx, 3rpx, 0) rotate(-3deg) scale(1.05)'),
	],
];

const inspirationItems = ref<DesignDetail[]>([]);
const carouselStyles = [
	'transform:translate3d(-8rpx, 8rpx, 0) rotate(-9deg) scale(.92)',
	'transform:translate3d(9rpx, -5rpx, 0) rotate(7deg) scale(1.04)',
	'transform:translate3d(-4rpx, 2rpx, 0) rotate(4deg) scale(.96)',
	'transform:translate3d(11rpx, 5rpx, 0) rotate(-6deg) scale(1.06)',
	'transform:translate3d(-10rpx, -3rpx, 0) rotate(8deg) scale(.9)',
	'transform:translate3d(6rpx, 7rpx, 0) rotate(-3deg) scale(1)',
];

function imageUrl(path: string) {
	if (!path || path.startsWith('http') || path.startsWith('data:')) return path;
	const base = (RESOLVED_API_BASE || '').replace(/\/$/, '');
	return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

const configuredHeroBracelets = computed<HeroBracelet[]>(() => {
	const byId = new Map(inspirationItems.value.map((item) => [item.id, item]));
	return home.value.inspirationCarousel.designIds.flatMap((id, index) => {
		const item = byId.get(id);
		if (!item?.image) return [];
		return [{
			id: item.id,
			image: imageUrl(item.image),
			style: carouselStyles[index % carouselStyles.length],
			path: `/pages/goods/detail/detail?id=${encodeURIComponent(item.id)}&from=inspiration`,
		}];
	});
});

const heroColumns = computed<HeroBracelet[][]>(() => {
	const configured = configuredHeroBracelets.value;
	if (!configured.length) return defaultHeroColumns;
	const columns: HeroBracelet[][] = [[], [], []];
	configured.forEach((item, index) => columns[index % 3].push(item));
	columns.forEach((column, index) => {
		if (!column.length) column.push(configured[index % configured.length]);
	});
	return columns;
});

const loopingHeroColumns = computed(() => heroColumns.value.map((column) => [...column, ...column]));

const pageStyle = computed(() =>
	`--brand-primary:${brand.value.primaryColor};--brand-secondary:${brand.value.secondaryColor};`,
);

onMounted(() => {
	void Promise.all([contentStore.fetchContent(), loadInspirations()]);
});

async function loadInspirations() {
	try {
		inspirationItems.value = await api.getInspirations();
	} catch {
		inspirationItems.value = [];
	}
}

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

function openHeroBracelet(item: HeroBracelet) {
	if (item.path) openPath(item.path);
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

			<view class="material-stage">
				<view class="bracelet-marquee">
					<view
						v-for="(column, columnIndex) in loopingHeroColumns"
						:key="columnIndex"
						class="bracelet-marquee__column"
					>
						<view
							class="bracelet-marquee__track"
							:class="`bracelet-marquee__track--${columnIndex + 1}`"
						>
							<view
								v-for="(item, itemIndex) in column"
								:key="`${columnIndex}-${item.id}-${itemIndex}`"
								class="bracelet-marquee__item"
								:class="{ 'bracelet-marquee__item--interactive': !!item.path }"
								@tap.stop="openHeroBracelet(item)"
							>
								<image
									class="bracelet-marquee__image"
									:src="item.image"
									:style="item.style"
									mode="aspectFit"
								/>
							</view>
						</view>
					</view>
				</view>
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
	background: #018b8d;
}

.bracelet-marquee {
	position: absolute;
	left: 0;
	top: 0;
	display: flex;
	width: 100%;
	height: 100%;
	overflow: hidden;
	background:
		radial-gradient(circle at 18% 22%, rgba(255, 255, 255, 0.1), transparent 34%),
		#018b8d;
}

.bracelet-marquee::before,
.bracelet-marquee::after {
	position: absolute;
	left: 0;
	z-index: 2;
	width: 100%;
	height: 54rpx;
	content: '';
	pointer-events: none;
}

.bracelet-marquee::before {
	top: 0;
	background: linear-gradient(180deg, #018b8d, rgba(1, 139, 141, 0));
}

.bracelet-marquee::after {
	bottom: 0;
	background: linear-gradient(0deg, #018b8d, rgba(1, 139, 141, 0));
}

.bracelet-marquee__column {
	position: relative;
	width: 33.3333%;
	height: 100%;
	overflow: hidden;
}

.bracelet-marquee__track {
	width: 100%;
	will-change: transform;
}

.bracelet-marquee__track--1 {
	animation: bracelet-column-up 26s linear infinite;
	animation-delay: -5s;
}

.bracelet-marquee__track--2 {
	animation: bracelet-column-up 32s linear infinite;
	animation-delay: -21s;
}

.bracelet-marquee__track--3 {
	animation: bracelet-column-down 28s linear infinite;
	animation-delay: -13s;
}

.bracelet-marquee__item {
	display: flex;
	height: 515rpx;
	align-items: center;
	justify-content: center;
}

.bracelet-marquee__item--interactive {
	cursor: pointer;
}

.bracelet-marquee__item--interactive:active {
	opacity: 0.78;
}

.bracelet-marquee__image {
	width: 214rpx;
	height: 214rpx;
	filter: drop-shadow(0 13rpx 16rpx rgba(0, 45, 47, 0.22));
	transform-origin: center;
}

@keyframes bracelet-column-up {
	from {
		transform: translate3d(0, 0, 0);
	}

	to {
		transform: translate3d(0, -50%, 0);
	}
}

@keyframes bracelet-column-down {
	from {
		transform: translate3d(0, -50%, 0);
	}

	to {
		transform: translate3d(0, 0, 0);
	}
}

@media (prefers-reduced-motion: reduce) {
	.bracelet-marquee__track {
		animation-play-state: paused;
	}
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
