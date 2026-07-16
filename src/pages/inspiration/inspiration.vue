<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { api, type DesignDetail } from '@/api';
import { RESOLVED_API_BASE } from '@/config';

const items = ref<DesignDetail[]>([]);
const loading = ref(false);
const loaded = ref(false);
const previewCache = new Map<string, Array<{ image: string; style: Record<string, string> }>>();

function imageUrl(path: string) {
	if (!path || path.startsWith('http') || path.startsWith('data:')) return path;
	const base = (RESOLVED_API_BASE || '').replace(/\/$/, '');
	return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function load() {
	if (loading.value) return;
	loading.value = true;
	try {
		items.value = await api.getInspirations();
	} catch {
		uni.showToast({ title: '灵感岛暂时无法靠岸', icon: 'none' });
	} finally {
		loading.value = false;
		loaded.value = true;
		uni.stopPullDownRefresh();
	}
}

function openDetail(item: DesignDetail) {
	uni.navigateTo({ url: `/pages/goods/detail/detail?id=${item.id}&from=inspiration` });
}

function authorText(author: string) {
	if (!author) return '@岛民';
	return author.startsWith('@') ? author : `@${author}`;
}

function previewBeads(item: DesignDetail) {
	const cached = previewCache.get(item.id);
	if (cached) return cached;
	const weighted = item.composition.flatMap((row) => Array.from({ length: Math.max(1, row.quantity) }, () => row.image));
	const source = weighted.length ? weighted : item.image ? [item.image] : [];
	const count = Math.max(16, Math.min(22, source.length));
	const beads = Array.from({ length: count }, (_, index) => {
		const image = source[Math.floor((index / count) * source.length)] || source[index % source.length];
		const angle = (index / count) * 360;
		return { image: imageUrl(image), style: { transform: `rotate(${angle}deg) translateY(-82rpx) rotate(${-angle}deg)` } };
	});
	previewCache.set(item.id, beads);
	return beads;
}

function goCreate() {
	uni.switchTab({ url: '/pages/design/design' });
}

onMounted(load);
onShow(() => {
	if (loaded.value) void load();
});
onPullDownRefresh(load);
</script>

<template>
	<view class="page inspiration-page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="nav-title">灵感岛</view>
		<view class="intro">
			<text class="intro-kicker">ZHUDAO COMMUNITY</text>
			<text class="intro-title">找到下一串灵感</text>
			<text class="intro-sub">岛民共同创作的手串，点击即可查看并复现</text>
		</view>

		<view v-if="loading && !items.length" class="grid">
			<view v-for="index in 6" :key="index" class="card card--skeleton">
				<view class="skeleton-art" />
				<view class="skeleton-line skeleton-line--title" />
				<view class="skeleton-line" />
			</view>
		</view>

		<view v-else-if="items.length" class="grid">
			<view v-for="(item, index) in items" :key="item.id" class="card" :style="{ animationDelay: `${index * 45}ms` }" @tap="openDetail(item)">
				<view class="usage">{{ item.usageCount }}人使用</view>
				<view class="art">
					<view class="art-halo" />
					<view v-if="item.composition.length" class="fallback-ring">
						<image
							v-for="(bead, beadIndex) in previewBeads(item)"
							:key="beadIndex"
							class="fallback-bead"
							:src="bead.image"
							mode="aspectFit"
							:style="bead.style"
						/>
					</view>
					<image v-else-if="item.image" class="bracelet" :src="imageUrl(item.image)" mode="aspectFit" />
					<view class="brand-mark">珠岛<text>ZHUDAO</text></view>
				</view>
				<view class="card-foot">
					<text class="card-title">{{ item.title }}</text>
					<text class="card-author">{{ authorText(item.author) }}</text>
				</view>
			</view>
		</view>

		<view v-else class="empty">
			<text class="empty-title">第一座灵感正在生成</text>
			<text class="empty-sub">在 DIY 保存作品后，就可以投稿到这里</text>
			<view class="empty-action" @tap="goCreate">去创作</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page { min-height: 100vh; padding: calc(132rpx + env(safe-area-inset-top)) 24rpx 150rpx; box-sizing: border-box; background: #f7f7f9; color: #202126; }
.nav-title { position: fixed; z-index: 80; top: calc(46rpx + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); font-size: 31rpx; font-weight: 900; }
.intro { display: flex; flex-direction: column; padding: 10rpx 8rpx 36rpx; }
.intro-kicker { color: #d92733; font-size: 20rpx; font-weight: 800; letter-spacing: 3rpx; }
.intro-title { margin-top: 12rpx; font-size: 48rpx; font-weight: 900; letter-spacing: -2rpx; }
.intro-sub { margin-top: 12rpx; color: #8b9297; font-size: 25rpx; line-height: 1.5; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 26rpx 22rpx; }
.card { position: relative; min-width: 0; overflow: hidden; background: #fff; animation: card-in .36s ease both; }
.usage { position: absolute; z-index: 3; top: 18rpx; right: 18rpx; color: #92a0a4; font-size: 23rpx; font-weight: 700; }
.art { position: relative; height: 332rpx; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.art-halo { position: absolute; width: 230rpx; height: 230rpx; border-radius: 50%; background: radial-gradient(circle, rgba(247,243,239,.75), rgba(255,255,255,0) 70%); }
.bracelet { position: relative; z-index: 1; width: 286rpx; height: 286rpx; }
.brand-mark { position: absolute; z-index: 2; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: rgba(217,39,51,.24); font-size: 17rpx; font-weight: 900; pointer-events: none; }
.brand-mark text { margin-top: 2rpx; color: rgba(82,121,133,.34); font-size: 9rpx; letter-spacing: 1rpx; }
.card-foot { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; padding: 19rpx 20rpx 24rpx; }
.card-title { flex: 1; min-width: 0; overflow: hidden; color: #25262a; font-size: 29rpx; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
.card-author { flex-shrink: 0; max-width: 112rpx; overflow: hidden; color: #94a0a4; font-size: 22rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.fallback-ring { position: relative; z-index: 1; width: 220rpx; height: 220rpx; }
.fallback-bead { position: absolute; left: 88rpx; top: 88rpx; width: 44rpx; height: 44rpx; transform-origin: 22rpx 22rpx; }
.empty { display: flex; min-height: 600rpx; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.empty-title { font-size: 34rpx; font-weight: 900; }.empty-sub { margin-top: 14rpx; color: #92999d; font-size: 25rpx; }.empty-action { margin-top: 30rpx; padding: 18rpx 42rpx; border: 2rpx solid #d92733; border-radius: 999rpx; color: #d92733; font-size: 26rpx; font-weight: 800; }
.card--skeleton { padding-bottom: 22rpx; }.skeleton-art { height: 332rpx; background: linear-gradient(100deg,#f1f1f2 20%,#fafafa 45%,#f1f1f2 70%); background-size: 200% 100%; animation: shimmer 1.2s linear infinite; }.skeleton-line { width: 44%; height: 19rpx; margin: 15rpx 18rpx 0; border-radius: 10rpx; background: #eee; }.skeleton-line--title { width: 70%; height: 26rpx; margin-top: 20rpx; }
@keyframes shimmer { to { background-position: -200% 0; } } @keyframes card-in { from { opacity: 0; transform: translateY(12rpx); } to { opacity: 1; transform: translateY(0); } }
</style>
