<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { useContentStore } from '@/stores/content';
import type { SupportHelpTopic } from '@/api';

type HelpSearchRow = {
	topicId: string;
	topicTitle: string;
	text: string;
};

const activeTopic = ref('custom');
const supportOpen = ref(false);
const searchKeyword = ref('');
const supportOrderNo = ref('');
const contentStore = useContentStore();
const supportId = computed(() => contentStore.brand.supportId);
const supportHours = computed(() => contentStore.brand.supportHours);
const topics = computed<SupportHelpTopic[]>(() => contentStore.support.helpTopics);

const currentTopic = computed<SupportHelpTopic>(() =>
	topics.value.find((topic) => topic.id === activeTopic.value) ?? topics.value[0]!,
);
const hasSearchKeyword = computed(() => searchKeyword.value.trim().length > 0);
const searchRows = computed<HelpSearchRow[]>(() => {
	const keyword = searchKeyword.value.trim().toLowerCase();
	if (!keyword) return [];
	return topics.value.flatMap((topic) =>
		topic.items
			.filter((item) => `${topic.title} ${topic.desc} ${item}`.toLowerCase().includes(keyword))
			.map((item) => ({
				topicId: topic.id,
				topicTitle: topic.title,
				text: item,
			})),
	);
});
const supportHint = computed(() =>
	supportOrderNo.value
		? `已定位订单 ${supportOrderNo.value}，发送给客服可查询实物图、发货进度和售后处理。`
		: `${supportHours.value}，发图可查库存、色差、手围和发货进度。`,
);

onLoad((query: Record<string, string | undefined>) => {
	const topic = query.topic || '';
	syncActiveTopic(topic);
	void contentStore.fetchContent().finally(() => syncActiveTopic(topic));
	supportOrderNo.value = decodeURIComponent(query.order || query.orderNo || '');
	if (query.support === '1') {
		supportOpen.value = true;
	}
});

function syncActiveTopic(requestedTopic: string) {
	if (requestedTopic && topics.value.some((item) => item.id === requestedTopic)) {
		activeTopic.value = requestedTopic;
		return;
	}
	if (!topics.value.some((item) => item.id === activeTopic.value)) {
		activeTopic.value = topics.value[0]?.id || '';
	}
}

function selectTopic(id: string) {
	activeTopic.value = id;
}

function onSearchInput(e: { detail?: { value?: string } }) {
	searchKeyword.value = e.detail?.value || '';
}

function clearSearch() {
	searchKeyword.value = '';
}

function useSearchRow(row: HelpSearchRow) {
	activeTopic.value = row.topicId;
	searchKeyword.value = '';
}

function openSupport() {
	supportOpen.value = true;
}

function closeSupport() {
	supportOpen.value = false;
}

function goTerms() {
	uni.navigateTo({ url: '/pages/profile/terms' });
}

function goBack() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
}

function copyServiceId() {
	uni.setClipboardData({
		data: supportId.value,
		success: () => {
			uni.showToast({ title: '已复制客服号', icon: 'none' });
		},
	});
}
</script>

<template>
	<view class="page app-subpage help-page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="help-nav">
			<view class="nav-side">
				<view class="nav-back" @tap="goBack">‹</view>
			</view>
			<view class="nav-title">帮助中心</view>
			<view class="nav-side nav-side--right" />
		</view>

		<view class="hero">
			<view>
				<view class="hero-title">帮助中心</view>
				<view class="hero-sub">定制、下单、售后问题都可以在这里处理</view>
			</view>
			<view class="hero-mark">石</view>
		</view>

		<view class="help-search">
			<view class="help-search-icon" />
			<input
				class="help-search-input"
				:value="searchKeyword"
				placeholder="搜索定制、订单、售后问题"
				confirm-type="search"
				@input="onSearchInput"
			/>
			<view v-if="hasSearchKeyword" class="help-search-clear" @tap="clearSearch">×</view>
		</view>

		<view class="quick-panel">
			<view class="quick-item" @tap="openSupport">
				<view class="quick-icon quick-icon--service">S</view>
				<view class="quick-copy">
					<view class="quick-title">联系客服</view>
					<view class="quick-sub">{{ supportHours }}</view>
				</view>
				<view class="quick-arrow">›</view>
			</view>
			<view class="quick-item" @tap="goTerms">
				<view class="quick-icon quick-icon--terms">T</view>
				<view class="quick-copy">
					<view class="quick-title">条款和条件</view>
					<view class="quick-sub">服务、隐私与购买须知</view>
				</view>
				<view class="quick-arrow">›</view>
			</view>
		</view>

		<template v-if="hasSearchKeyword">
			<view class="section-title">搜索结果</view>
			<view v-if="searchRows.length" class="search-result-panel">
				<view v-for="row in searchRows" :key="`${row.topicId}-${row.text}`" class="search-result-row" @tap="useSearchRow(row)">
					<view class="search-result-topic">{{ row.topicTitle }}</view>
					<view class="search-result-text">{{ row.text }}</view>
				</view>
			</view>
			<view v-else class="search-empty">
				<view class="search-empty-title">没有找到相关问题</view>
				<view class="search-empty-sub">可以换个关键词，或直接联系客服处理。</view>
				<button class="search-empty-btn" @tap="openSupport">联系客服</button>
			</view>
		</template>

		<template v-else>
			<view class="section-title">常见问题</view>
			<view class="topic-tabs">
				<view
					v-for="topic in topics"
					:key="topic.id"
					class="topic-tab"
					:class="{ active: activeTopic === topic.id }"
					@tap="selectTopic(topic.id)"
				>
					{{ topic.title }}
				</view>
			</view>

			<view class="faq-panel">
				<view class="faq-head">
					<view>
						<view class="faq-title">{{ currentTopic.title }}</view>
						<view class="faq-desc">{{ currentTopic.desc }}</view>
					</view>
				</view>
				<view
					v-for="(item, index) in currentTopic.items"
					:key="item"
					class="faq-row"
				>
					<view class="faq-index">{{ index + 1 }}</view>
					<view class="faq-text">{{ item }}</view>
				</view>
			</view>
		</template>

		<view class="notice">
			<view class="notice-title">购买提醒</view>
			<view class="notice-text">天然水晶每颗纹理不同，棉絮、色带、冰裂和发丝均为正常天然表现；页面效果以接近实物质感为目标，最终以实际收到商品为准。</view>
		</view>

		<view v-if="supportOpen" class="support-mask" @tap="closeSupport">
			<view class="support-sheet" @tap.stop>
				<view class="support-handle" />
				<view class="support-head">
					<view>
						<view class="support-title">联系客服</view>
						<view class="support-sub">发送设计截图、订单号或材质名称，客服会协助核对实物图和售后。</view>
					</view>
					<view class="support-close" @tap="closeSupport">×</view>
				</view>
				<view class="support-body">
					<view class="qr-box">
						<view class="qr-corner qr-corner--tl" />
						<view class="qr-corner qr-corner--tr" />
						<view class="qr-corner qr-corner--bl" />
						<view class="qr-dot qr-dot--a" />
						<view class="qr-dot qr-dot--b" />
						<view class="qr-logo">石</view>
					</view>
					<view class="support-info">
						<view class="support-label">客服号</view>
						<view class="support-id">{{ supportId }}</view>
						<view class="support-hint">{{ supportHint }}</view>
						<button class="support-copy" @tap="copyServiceId">复制客服号</button>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #fff;
	padding: calc(142rpx + env(safe-area-inset-top)) 22rpx 112rpx;
	box-sizing: border-box;
}

.help-nav {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	z-index: 100;
	height: calc(118rpx + env(safe-area-inset-top));
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: calc(34rpx + env(safe-area-inset-top)) 26rpx 0;
	background: #fff;
	box-sizing: border-box;
}

.nav-side {
	width: 216rpx;
	height: 72rpx;
	display: flex;
	align-items: center;
}

.nav-side--right {
	justify-content: flex-end;
}

.nav-back {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #15171c;
	font-size: 58rpx;
	font-weight: 400;
	line-height: 1;
}

.nav-back:active {
	opacity: 0.58;
}

.nav-title {
	position: absolute;
	left: 50%;
	top: calc(66rpx + env(safe-area-inset-top));
	max-width: 320rpx;
	transform: translate(-50%, -50%);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: #111216;
	font-size: 32rpx;
	font-weight: 900;
	line-height: 1;
}

.hero {
	min-height: 176rpx;
	border-radius: 12rpx;
	background: #d92733;
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 30rpx 28rpx;
	box-sizing: border-box;
	box-shadow: 0 8rpx 18rpx rgba(217, 39, 51, 0.16);
}

.hero-title {
	font-size: 38rpx;
	font-weight: 900;
	line-height: 1.2;
}

.hero-sub {
	margin-top: 16rpx;
	max-width: 440rpx;
	color: rgba(255, 255, 255, 0.9);
	font-size: 25rpx;
	font-weight: 800;
	line-height: 1.45;
}

.hero-mark {
	width: 96rpx;
	height: 96rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.18);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 44rpx;
	font-weight: 900;
}

.help-search {
	margin-top: 22rpx;
	height: 82rpx;
	border-radius: 12rpx;
	background: #f5f5f7;
	display: flex;
	align-items: center;
	gap: 16rpx;
	padding: 0 22rpx;
	box-sizing: border-box;
}

.help-search-icon {
	position: relative;
	width: 30rpx;
	height: 30rpx;
	border: 4rpx solid #9b9da4;
	border-radius: 50%;
	box-sizing: border-box;
	flex-shrink: 0;
}

.help-search-icon::after {
	content: '';
	position: absolute;
	right: -10rpx;
	bottom: -8rpx;
	width: 14rpx;
	height: 4rpx;
	border-radius: 4rpx;
	background: #9b9da4;
	transform: rotate(45deg);
}

.help-search-input {
	flex: 1;
	min-width: 0;
	height: 82rpx;
	color: #22252c;
	font-size: 28rpx;
	font-weight: 800;
}

.help-search-clear {
	width: 44rpx;
	height: 44rpx;
	border-radius: 50%;
	background: #e1e1e5;
	color: #757981;
	font-size: 34rpx;
	line-height: 39rpx;
	text-align: center;
	font-weight: 800;
	flex-shrink: 0;
}

.quick-panel,
.faq-panel {
	margin-top: 24rpx;
	background: #fafafa;
}

.quick-item {
	min-height: 118rpx;
	display: flex;
	align-items: center;
	gap: 22rpx;
	padding: 20rpx 24rpx;
	border-bottom: 1rpx solid #ececef;
	box-sizing: border-box;
}

.quick-item:last-child {
	border-bottom: 0;
}

.quick-item:active,
.topic-tab:active {
	opacity: 0.72;
}

.quick-icon {
	width: 46rpx;
	height: 46rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #fff;
	font-size: 24rpx;
	font-weight: 900;
	flex-shrink: 0;
}

.quick-icon--service {
	background: #ff9276;
}

.quick-icon--terms {
	border-radius: 8rpx;
	background: #ff805f;
}

.quick-copy {
	flex: 1;
	min-width: 0;
}

.quick-title {
	color: #202329;
	font-size: 31rpx;
	font-weight: 900;
}

.quick-sub {
	margin-top: 12rpx;
	color: #a1a1a8;
	font-size: 25rpx;
	font-weight: 700;
}

.quick-arrow {
	color: #babac0;
	font-size: 42rpx;
	line-height: 1;
}

.section-title {
	margin: 34rpx 0 18rpx;
	color: #111318;
	font-size: 32rpx;
	font-weight: 900;
}

.topic-tabs {
	display: flex;
	gap: 14rpx;
	overflow-x: auto;
	padding-bottom: 4rpx;
}

.topic-tabs::-webkit-scrollbar {
	display: none;
}

.topic-tab {
	flex-shrink: 0;
	height: 62rpx;
	line-height: 62rpx;
	border-radius: 8rpx;
	padding: 0 22rpx;
	background: #f0f0f2;
	color: #6e7179;
	font-size: 25rpx;
	font-weight: 900;
}

.topic-tab.active {
	background: #111318;
	color: #fff;
}

.search-result-panel {
	background: #fafafa;
}

.search-result-row {
	padding: 24rpx;
	border-bottom: 1rpx solid #ececef;
	box-sizing: border-box;
}

.search-result-row:last-child {
	border-bottom: 0;
}

.search-result-row:active,
.help-search-clear:active,
.search-empty-btn:active,
.support-copy:active {
	opacity: 0.76;
}

.search-result-topic {
	display: inline-flex;
	align-items: center;
	height: 38rpx;
	border-radius: 6rpx;
	background: #fff0f1;
	color: #d92733;
	padding: 0 12rpx;
	font-size: 22rpx;
	font-weight: 900;
}

.search-result-text {
	margin-top: 14rpx;
	color: #24262d;
	font-size: 27rpx;
	font-weight: 750;
	line-height: 1.55;
}

.search-empty {
	background: #fafafa;
	padding: 44rpx 28rpx;
	text-align: center;
	box-sizing: border-box;
}

.search-empty-title {
	color: #202329;
	font-size: 30rpx;
	font-weight: 900;
}

.search-empty-sub {
	margin-top: 12rpx;
	color: #8f9299;
	font-size: 25rpx;
	font-weight: 700;
	line-height: 1.5;
}

.search-empty-btn {
	margin-top: 24rpx;
	width: 220rpx;
	height: 64rpx;
	line-height: 64rpx;
	border-radius: 8rpx;
	background: #d92733;
	color: #fff;
	font-size: 26rpx;
	font-weight: 900;
}

.search-empty-btn::after,
.support-copy::after {
	border: 0;
}

.faq-panel {
	padding: 24rpx;
	box-sizing: border-box;
}

.faq-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-bottom: 20rpx;
	border-bottom: 1rpx solid #ececef;
}

.faq-title {
	color: #17191f;
	font-size: 31rpx;
	font-weight: 900;
}

.faq-desc {
	margin-top: 12rpx;
	color: #8f9299;
	font-size: 24rpx;
	font-weight: 700;
}

.faq-row {
	display: flex;
	gap: 18rpx;
	padding: 22rpx 0;
	border-bottom: 1rpx solid #ececef;
}

.faq-row:last-child {
	border-bottom: 0;
	padding-bottom: 0;
}

.faq-index {
	width: 36rpx;
	height: 36rpx;
	border-radius: 50%;
	background: #fff;
	border: 2rpx solid #d8d8de;
	color: #6b6e76;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 20rpx;
	font-weight: 900;
	flex-shrink: 0;
}

.faq-text {
	flex: 1;
	min-width: 0;
	color: #25272e;
	font-size: 27rpx;
	font-weight: 700;
	line-height: 1.55;
}

.notice {
	margin-top: 24rpx;
	padding: 24rpx;
	background: #fff7e6;
	border-radius: 8rpx;
	box-sizing: border-box;
}

.notice-title {
	color: #5b3b1d;
	font-size: 28rpx;
	font-weight: 900;
}

.notice-text {
	margin-top: 12rpx;
	color: #7b5b37;
	font-size: 25rpx;
	font-weight: 700;
	line-height: 1.55;
}

.support-mask {
	position: fixed;
	inset: 0;
	z-index: 50;
	display: flex;
	align-items: flex-end;
	background: rgba(0, 0, 0, 0.38);
	box-sizing: border-box;
}

.support-sheet {
	width: 100%;
	padding: 14rpx 24rpx calc(34rpx + env(safe-area-inset-bottom));
	border-radius: 22rpx 22rpx 0 0;
	background: #fff;
	box-shadow: 0 -16rpx 44rpx rgba(31, 35, 48, 0.18);
	box-sizing: border-box;
}

.support-handle {
	width: 72rpx;
	height: 8rpx;
	margin: 0 auto 22rpx;
	border-radius: 999rpx;
	background: #dfe1e6;
}

.support-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24rpx;
}

.support-title {
	color: #15171d;
	font-size: 32rpx;
	font-weight: 900;
	line-height: 1.2;
}

.support-sub {
	margin-top: 10rpx;
	color: #7f838d;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.42;
}

.support-close {
	width: 54rpx;
	height: 54rpx;
	border-radius: 50%;
	background: #f1f2f5;
	color: #777c86;
	font-size: 40rpx;
	font-weight: 900;
	line-height: 48rpx;
	text-align: center;
	flex-shrink: 0;
}

.support-body {
	display: flex;
	align-items: center;
	gap: 24rpx;
	margin-top: 28rpx;
}

.qr-box {
	position: relative;
	width: 176rpx;
	height: 176rpx;
	border-radius: 12rpx;
	background:
		linear-gradient(90deg, transparent 9rpx, #111 9rpx 18rpx, transparent 18rpx 27rpx),
		linear-gradient(0deg, transparent 9rpx, #111 9rpx 18rpx, transparent 18rpx 27rpx),
		#fff;
	background-size: 27rpx 27rpx;
	box-shadow: inset 0 0 0 1rpx #eceef2;
	overflow: hidden;
	flex-shrink: 0;
}

.qr-box::before {
	content: '';
	position: absolute;
	inset: 24rpx 28rpx 32rpx 22rpx;
	background:
		linear-gradient(45deg, transparent 0 38%, #111 38% 50%, transparent 50% 100%),
		linear-gradient(-45deg, transparent 0 42%, #111 42% 54%, transparent 54% 100%);
	opacity: 0.9;
}

.qr-corner {
	position: absolute;
	width: 48rpx;
	height: 48rpx;
	border: 10rpx solid #111;
	background: #fff;
	box-shadow: inset 0 0 0 9rpx #fff, inset 0 0 0 18rpx #111;
	box-sizing: border-box;
}

.qr-corner--tl {
	left: 14rpx;
	top: 14rpx;
}

.qr-corner--tr {
	right: 14rpx;
	top: 14rpx;
}

.qr-corner--bl {
	left: 14rpx;
	bottom: 14rpx;
}

.qr-dot {
	position: absolute;
	width: 18rpx;
	height: 18rpx;
	background: #111;
}

.qr-dot--a {
	right: 48rpx;
	bottom: 46rpx;
	box-shadow: 24rpx 0 #111, 0 26rpx #111;
}

.qr-dot--b {
	left: 78rpx;
	top: 78rpx;
	box-shadow: 28rpx -18rpx #111, 44rpx 30rpx #111, -28rpx 34rpx #111;
}

.qr-logo {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 54rpx;
	height: 54rpx;
	transform: translate(-50%, -50%);
	border-radius: 50%;
	background: #d92733;
	color: #fff;
	font-size: 27rpx;
	font-weight: 900;
	line-height: 54rpx;
	text-align: center;
}

.support-info {
	flex: 1;
	min-width: 0;
}

.support-label {
	color: #9ca0a8;
	font-size: 22rpx;
	font-weight: 900;
}

.support-id {
	margin-top: 8rpx;
	color: #15171d;
	font-size: 32rpx;
	font-weight: 900;
	line-height: 1.2;
}

.support-hint {
	margin-top: 12rpx;
	color: #6e727c;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.45;
}

.support-copy {
	height: 64rpx;
	line-height: 64rpx;
	margin: 18rpx 0 0;
	padding: 0 28rpx;
	border: 0;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 24rpx;
	font-weight: 900;
}

.support-copy::after {
	border: 0;
}

.support-close:active {
	opacity: 0.76;
}

/* #ifdef H5 */
:global(uni-app:has(.help-page) uni-tabbar),
:global(uni-app:has(.help-page) .uni-tabbar-bottom) {
	display: none;
}

:global(uni-page-body:has(> .help-page)) {
	min-height: 100vh;
	background: #fff;
}
/* #endif */
</style>
