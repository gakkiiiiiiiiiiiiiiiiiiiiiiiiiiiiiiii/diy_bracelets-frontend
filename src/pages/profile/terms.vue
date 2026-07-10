<script setup lang="ts">
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';

const intro =
	'欢迎使用我们的小程序！ 在您使用本小程序之前，请认真阅读以下的用户服务协议（以下简称“本协议”）。';

const sections = [
	{
		title: '1. 服务条款',
		body:
			'本小程序由我们提供，为保证您的权益和安全，请您在使用本小程序前仔细阅读并同意本协议。若您不同意本协议，将无法使用本小程序提供的服务。',
	},
	{
		title: '2. 用户信息的收集和使用',
		body:
			'当您使用本小程序时，我们可能会收集和使用您的个人信息。我们承诺在合法、正当的范围内收集和使用您的个人信息，并采取合理的措施确保您的信息安全。',
	},
	{
		title: '3. 用户行为规范',
		body:
			'您应当遵守中华人民共和国相关法律法规以及本小程序的相关规定，不得利用本小程序从事任何违法或不良行为。',
	},
	{
		title: '4. 免责声明',
		body:
			'鉴于互联网的特殊性，本小程序无法对其他用户的行为进行完全的监控和控制。因此，我们无法对其他用户的行为负责，包括但不限于其他用户发布的任何内容。',
	},
	{
		title: '5. 协议的修改和更新',
		body:
			'我们有权随时修改和更新本协议，并在本小程序上公示。修改和更新后的协议一旦公示即生效。若您对修改和更新后的协议有异议，应当立即停止使用本小程序提供的服务。',
	},
	{
		title: '6. 法律适用和争议解决',
		body:
			'本协议的订立、执行和解释均应受中华人民共和国法律的管辖。如您和我们就本协议内容或其执行发生任何争议，应当通过友好协商解决；协商不成的，应当提交有管辖权的人民法院进行诉讼。',
	},
	{
		title: '7. 其他条款',
		body:
			'本协议构成您与我们之间关于使用本小程序的完整协议，除本协议外，我们未向您做出任何陈述或承诺。如本协议中的任何条款无效或不可执行，不影响其他条款的效力。',
	},
];

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
			<view class="intro">{{ intro }}</view>
			<view v-for="section in sections" :key="section.title" class="section">
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
