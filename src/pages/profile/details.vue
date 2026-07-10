<script setup lang="ts">
import { ref, computed } from 'vue';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { defaultProfileDetails, loadProfileDetails, saveProfileDetails } from '@/utils/profileDetails';

const genderOptions = ['男', '女'];
const saved = loadProfileDetails();
const wechatName = saved.name || defaultProfileDetails.name;
const name = ref(saved.name);
const phone = ref(saved.phone);
const gender = ref(genderOptions.includes(saved.gender) ? saved.gender : genderOptions[0]);
const agreed = ref(false);
const genderMenuOpen = ref(false);
const nicknameSheetOpen = ref(false);
const phoneSheetOpen = ref(false);
const nicknameDraft = ref(name.value);
const phoneDraft = ref(phone.value);

const canSave = computed(() => agreed.value && name.value.trim().length > 0);
const phoneDisplayText = computed(() => phone.value.trim() || '未填写');
const canConfirmPhone = computed(() => /^1\d{10}$/.test(phoneDraft.value.trim()));
const canConfirmNickname = computed(() => nicknameDraft.value.trim().length > 0);

function toggleGenderMenu() {
	nicknameSheetOpen.value = false;
	phoneSheetOpen.value = false;
	genderMenuOpen.value = !genderMenuOpen.value;
}

function selectGender(value: string) {
	gender.value = value;
	genderMenuOpen.value = false;
}

function openNicknameSheet() {
	genderMenuOpen.value = false;
	phoneSheetOpen.value = false;
	nicknameDraft.value = name.value;
	nicknameSheetOpen.value = true;
}

function closeNicknameSheet() {
	const nextName = nicknameDraft.value.trim();
	if (nextName) {
		name.value = nextName;
	}
	nicknameSheetOpen.value = false;
}

function openPhoneSheet() {
	genderMenuOpen.value = false;
	nicknameSheetOpen.value = false;
	phoneDraft.value = phone.value;
	phoneSheetOpen.value = true;
}

function closePhoneSheet() {
	phoneSheetOpen.value = false;
}

function onPhoneInput(e: { detail: { value: string } }) {
	phoneDraft.value = (e.detail.value || '').replace(/[^\d]/g, '').slice(0, 11);
}

function onNicknameInput(e: { detail: { value: string } }) {
	nicknameDraft.value = (e.detail.value || '').slice(0, 20);
	name.value = nicknameDraft.value;
}

function confirmNickname() {
	const nextName = nicknameDraft.value.trim();
	if (!nextName) {
		uni.showToast({ title: '请输入昵称', icon: 'none' });
		return;
	}
	name.value = nextName;
	closeNicknameSheet();
}

function confirmPhone() {
	if (!canConfirmPhone.value) {
		uni.showToast({ title: '请输入11位手机号', icon: 'none' });
		return;
	}
	phone.value = phoneDraft.value.trim();
	closePhoneSheet();
}

function useWechatName() {
	nicknameDraft.value = wechatName;
	name.value = wechatName;
}

function toggleAgreement() {
	genderMenuOpen.value = false;
	nicknameSheetOpen.value = false;
	phoneSheetOpen.value = false;
	agreed.value = !agreed.value;
}

function onAvatarTap() {
	genderMenuOpen.value = false;
	nicknameSheetOpen.value = false;
	phoneSheetOpen.value = false;
	uni.showToast({ title: '请在微信端授权更换头像', icon: 'none' });
}

function goBack() {
	genderMenuOpen.value = false;
	nicknameSheetOpen.value = false;
	phoneSheetOpen.value = false;
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
}

function openPrivacy() {
	genderMenuOpen.value = false;
	nicknameSheetOpen.value = false;
	phoneSheetOpen.value = false;
	uni.navigateTo({ url: '/pages/profile/terms' });
}

function onSave() {
	genderMenuOpen.value = false;
	nicknameSheetOpen.value = false;
	phoneSheetOpen.value = false;
	if (!canSave.value) {
		uni.showToast({ title: agreed.value ? '请输入昵称' : '请阅读并同意协议', icon: 'none' });
		return;
	}
	saveProfileDetails({
		name: name.value.trim(),
		phone: phone.value.trim() || saved.phone,
		gender: gender.value,
	});
	uni.showToast({ title: '已保存', icon: 'success' });
	setTimeout(() => {
		uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
	}, 420);
}
</script>

<template>
	<view class="page app-subpage profile-details-page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="details-nav">
			<view class="nav-side">
				<view class="nav-back" @tap="goBack">‹</view>
			</view>
			<view class="nav-title">个人资料</view>
			<view class="nav-side nav-side--right" />
		</view>

		<view class="card">
			<view class="section-title">
				<view class="section-mark" />
				<text>基本资料</text>
			</view>
			<view class="row" @tap="onAvatarTap">
				<text class="row-label">头像</text>
				<view class="row-value row-value--avatar">
					<view class="avatar-icon">
						<view class="avatar-camera" />
						<view class="avatar-dot" />
					</view>
					<text class="row-arrow">‹</text>
				</view>
			</view>
			<view class="row" @tap="openNicknameSheet">
				<text class="row-label">昵称</text>
				<view class="row-value">
					<text class="row-text row-text--name">{{ name }}</text>
					<text class="row-arrow">‹</text>
				</view>
			</view>
			<view class="hint">建议使用微信昵称以便寻找您的订单</view>
		</view>

		<view class="card card--account">
			<view class="section-title">
				<view class="section-mark" />
				<text>账户设置</text>
			</view>
			<view class="row" @tap="openPhoneSheet">
				<text class="row-label">手机号</text>
				<view class="row-value">
					<text class="row-text" :class="{ 'row-text--placeholder': !phone.trim() }">{{ phoneDisplayText }}</text>
					<text class="row-arrow">‹</text>
				</view>
			</view>
			<view class="row row--gender" @tap="toggleGenderMenu">
				<text class="row-label">性别</text>
				<view class="row-value">
					<text class="row-text">{{ gender }}</text>
					<text class="row-arrow">‹</text>
				</view>
				<view v-if="genderMenuOpen" class="gender-menu" @tap.stop>
					<view
						v-for="option in genderOptions"
						:key="option"
						class="gender-option"
						:class="{ 'gender-option--active': option === gender }"
						@tap="selectGender(option)"
					>
						{{ option }}
					</view>
				</view>
			</view>
		</view>

		<view class="bottom-bar">
			<view class="agreement" @tap="toggleAgreement">
				<view class="check" :class="{ 'check--active': agreed }" />
				<text>请阅读并同意</text>
				<text class="privacy" @tap.stop="openPrivacy">《用户隐私协议》</text>
			</view>
			<view class="save-btn" :class="{ 'save-btn--disabled': !canSave }" @tap="onSave">保存</view>
		</view>

		<view v-if="nicknameSheetOpen" class="nickname-quick-sheet" @tap.stop>
			<view class="nickname-option-title" @tap="useWechatName">用微信昵称</view>
			<input
				class="nickname-quick-input"
				:value="nicknameDraft"
				maxlength="20"
				placeholder="请输入昵称"
				confirm-type="done"
				:focus="nicknameSheetOpen"
				@input="onNicknameInput"
				@confirm="confirmNickname"
			/>
		</view>

		<view v-if="phoneSheetOpen" class="phone-sheet-mask" @tap="closePhoneSheet">
			<view class="phone-sheet" @tap.stop>
				<view class="phone-sheet-grip" />
				<view class="phone-sheet-title">修改手机号</view>
				<view class="phone-field">
					<text class="phone-prefix">+86</text>
					<input
						class="phone-input"
						:value="phoneDraft"
						type="number"
						maxlength="11"
						placeholder="请输入手机号"
						confirm-type="done"
						@input="onPhoneInput"
						@confirm="confirmPhone"
					/>
				</view>
				<view class="phone-hint">手机号仅用于订单沟通、收货核对与售后联系。</view>
				<view class="phone-actions">
					<button class="phone-action ghost" @tap="closePhoneSheet">取消</button>
					<button class="phone-action" :disabled="!canConfirmPhone" @tap="confirmPhone">确认</button>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #f7f7fb;
	padding: calc(140rpx + env(safe-area-inset-top)) 30rpx 190rpx;
	box-sizing: border-box;
}

.details-nav {
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

.card {
	border-radius: 12rpx;
	background: #fff;
	padding: 30rpx 28rpx 24rpx;
	box-sizing: border-box;
}

.card--account {
	margin-top: 22rpx;
	padding-bottom: 18rpx;
}

.section-title {
	display: flex;
	align-items: center;
	gap: 12rpx;
	color: #22242b;
	font-size: 33rpx;
	font-weight: 900;
}

.section-mark {
	width: 6rpx;
	height: 38rpx;
	border-radius: 999rpx;
	background: #de2c37;
}

.row {
	position: relative;
	min-height: 104rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 28rpx;
}

.row--gender {
	overflow: visible;
}

.row:first-of-type {
	margin-top: 30rpx;
}

.row-label {
	color: #343740;
	font-size: 29rpx;
	font-weight: 800;
	white-space: nowrap;
}

.row-value {
	flex: 1;
	min-width: 0;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 10rpx;
	color: #202329;
}

.row-value--avatar {
	flex: none;
}

.row-text {
	min-width: 0;
	max-width: 350rpx;
	color: #202329;
	font-size: 28rpx;
	font-weight: 800;
	text-align: right;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.row-text--placeholder {
	color: #b6b7bf;
}

.row-arrow {
	color: #d4d5dc;
	font-size: 40rpx;
	font-weight: 300;
	transform: rotate(180deg);
	line-height: 1;
}

.gender-menu {
	position: absolute;
	right: 160rpx;
	top: -134rpx;
	z-index: 8;
	width: 310rpx;
	border-radius: 8rpx;
	background: #fff;
	box-shadow: 0 8rpx 28rpx rgba(42, 44, 52, 0.12);
	overflow: hidden;
	animation: gender-menu-in 0.16s ease-out both;
}

.gender-option {
	height: 78rpx;
	color: #202329;
	font-size: 30rpx;
	font-weight: 800;
	line-height: 78rpx;
	text-align: center;
}

.gender-option:active {
	background: #f7f7fb;
}

.gender-option--active {
	color: #202329;
}

.avatar-icon {
	position: relative;
	width: 58rpx;
	height: 48rpx;
	color: #c8c9d0;
}

.avatar-camera {
	position: absolute;
	left: 0;
	top: 9rpx;
	width: 44rpx;
	height: 33rpx;
	border-radius: 8rpx;
	background: currentColor;
}

.avatar-camera::before {
	content: '';
	position: absolute;
	left: 12rpx;
	top: 8rpx;
	width: 18rpx;
	height: 18rpx;
	border-radius: 50%;
	background: #fff;
	box-shadow: inset 0 0 0 5rpx currentColor;
}

.avatar-camera::after {
	content: '';
	position: absolute;
	left: 9rpx;
	top: -6rpx;
	width: 17rpx;
	height: 9rpx;
	border-radius: 6rpx 6rpx 0 0;
	background: currentColor;
}

.avatar-dot {
	position: absolute;
	right: 0;
	bottom: 2rpx;
	width: 18rpx;
	height: 18rpx;
	border-radius: 50%;
	border: 4rpx solid #fff;
	background: #c8c9d0;
}

.hint {
	margin-top: -6rpx;
	color: #a9aab1;
	font-size: 24rpx;
	font-weight: 700;
	line-height: 1.5;
}

.bottom-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 10;
	padding: 20rpx 30rpx calc(18rpx + env(safe-area-inset-bottom));
	background: rgba(255, 255, 255, 0.96);
	box-sizing: border-box;
}

.agreement {
	min-height: 48rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	color: #8f9198;
	font-size: 25rpx;
	font-weight: 700;
}

.check {
	position: relative;
	width: 30rpx;
	height: 30rpx;
	border-radius: 50%;
	border: 3rpx solid #d7d8df;
	box-sizing: border-box;
	background: #fff;
}

.check--active {
	border-color: #de2c37;
	background: #de2c37;
}

.check--active::after {
	content: '';
	position: absolute;
	left: 7rpx;
	top: 4rpx;
	width: 10rpx;
	height: 16rpx;
	border: solid #fff;
	border-width: 0 4rpx 4rpx 0;
	transform: rotate(45deg);
}

.privacy {
	color: #de2c37;
}

.save-btn {
	margin-top: 12rpx;
	height: 86rpx;
	border-radius: 999rpx;
	background: #dd2b36;
	color: #fff;
	font-size: 31rpx;
	font-weight: 900;
	text-align: center;
	line-height: 86rpx;
	box-shadow: 0 8rpx 18rpx rgba(221, 43, 54, 0.16);
}

.save-btn--disabled {
	opacity: 1;
}

.nickname-quick-sheet {
	position: fixed;
	left: 15rpx;
	right: 15rpx;
	bottom: calc(8rpx + env(safe-area-inset-bottom));
	z-index: 30;
	min-height: 104rpx;
	padding: 18rpx 24rpx 20rpx;
	border-radius: 14rpx;
	background: #f6f6f6;
	box-sizing: border-box;
	box-shadow: 0 -8rpx 28rpx rgba(22, 24, 31, 0.08);
	animation: nickname-sheet-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.nickname-option-title {
	color: #8f9198;
	font-size: 25rpx;
	font-weight: 800;
	line-height: 1.1;
	text-align: center;
}

.nickname-quick-input {
	width: 100%;
	height: 46rpx;
	margin-top: 10rpx;
	color: #0d0e12;
	font-size: 30rpx;
	font-weight: 900;
	line-height: 46rpx;
	text-align: center;
}

.phone-sheet-mask {
	position: fixed;
	inset: 0;
	z-index: 30;
	display: flex;
	align-items: flex-end;
	background: rgba(16, 18, 25, 0.38);
	box-sizing: border-box;
}

.phone-sheet {
	width: 100%;
	padding: 18rpx 30rpx calc(28rpx + env(safe-area-inset-bottom));
	border-radius: 24rpx 24rpx 0 0;
	background: #fff;
	box-sizing: border-box;
	box-shadow: 0 -18rpx 48rpx rgba(25, 29, 42, 0.14);
	animation: phone-sheet-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.phone-sheet-grip {
	width: 74rpx;
	height: 8rpx;
	margin: 0 auto 26rpx;
	border-radius: 999rpx;
	background: #e2e3e8;
}

.phone-sheet-title {
	color: #14161d;
	font-size: 34rpx;
	font-weight: 900;
	text-align: center;
	line-height: 1.2;
}

.phone-field {
	display: flex;
	align-items: center;
	gap: 20rpx;
	height: 96rpx;
	margin-top: 32rpx;
	padding: 0 24rpx;
	border-radius: 12rpx;
	background: #f7f7fb;
	border: 1rpx solid #ececf2;
	box-sizing: border-box;
}

.phone-prefix {
	color: #242730;
	font-size: 29rpx;
	font-weight: 900;
	line-height: 1;
}

.phone-input {
	flex: 1;
	min-width: 0;
	height: 96rpx;
	color: #202329;
	font-size: 31rpx;
	font-weight: 800;
}

.phone-hint {
	margin-top: 18rpx;
	color: #969aa5;
	font-size: 24rpx;
	font-weight: 700;
	line-height: 1.45;
}

.phone-actions {
	display: grid;
	grid-template-columns: 0.9fr 1.1fr;
	gap: 18rpx;
	margin-top: 28rpx;
}

.phone-action {
	height: 82rpx;
	line-height: 82rpx;
	margin: 0;
	padding: 0;
	border-radius: 999rpx;
	background: #dd2b36;
	color: #fff;
	font-size: 29rpx;
	font-weight: 900;
}

.phone-action.ghost {
	background: #f4f5f8;
	color: #30333c;
}

.phone-action[disabled] {
	background: #eceef3;
	color: #a6a9b2;
}

.phone-action::after {
	border: 0;
}

@keyframes nickname-sheet-in {
	from {
		opacity: 0;
		transform: translateY(42rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes gender-menu-in {
	from {
		opacity: 0;
		transform: translateY(8rpx) scale(0.98);
	}
	to {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

@keyframes phone-sheet-in {
	from {
		opacity: 0;
		transform: translateY(42rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
</style>
