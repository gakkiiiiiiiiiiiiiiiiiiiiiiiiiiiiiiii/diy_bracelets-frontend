<script setup lang="ts">
import { computed, onMounted } from 'vue';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { useContentStore } from '@/stores/content';

const contentStore = useContentStore();
const terms = computed(() => contentStore.support.terms);

onMounted(() => {
	void contentStore.fetchContent();
});

function goBack() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
}
</script>

<template>
	<scroll-view class="page app-subpage terms-page" scroll-y>
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="terms-nav">
			<view class="nav-side">
				<view class="nav-back" @tap="goBack">‹</view>
			</view>
			<view class="nav-title">条款和条件</view>
			<view class="nav-side nav-side--right" />
		</view>
		<view class="terms-content">
			<view class="intro">{{ terms.intro }}</view>
			<view v-for="section in terms.sections" :key="section.title" class="section">
				<view class="section-title">{{ section.title }}</view>
				<view class="section-body">{{ section.body }}</view>
			</view>
		</view>
	</scroll-view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #fff;
	box-sizing: border-box;
}

.terms-nav {
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

.terms-content {
	padding: calc(146rpx + env(safe-area-inset-top)) 22rpx 72rpx;
	box-sizing: border-box;
	color: #050505;
	font-size: 31rpx;
	font-weight: 500;
	line-height: 1.36;
}

.intro,
.section-body,
.section-title {
	white-space: pre-wrap;
	word-break: break-all;
}

.section {
	margin-top: 0;
}

.section-title {
	font-weight: 800;
}

.section-body {
	font-weight: 500;
}

/* #ifdef H5 */
:global(uni-app:has(.terms-page) uni-tabbar),
:global(uni-app:has(.terms-page) .uni-tabbar-bottom) {
	display: none;
}

:global(uni-page-body:has(> .terms-page)) {
	min-height: 100vh;
	background: #fff;
}
/* #endif */
</style>
