<script setup lang="ts">
</script>

<template>
  <view class="app">
    <!-- Apple-style 极光背景光球，固定于底层 -->
    <view class="orb orb-1" />
    <view class="orb orb-2" />
    <view class="orb orb-3" />
  </view>
</template>

<style lang="scss">
@use '@/uni.scss' as u;

page {
  background: u.$page-bg;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', 'PingFang SC', 'Helvetica Neue', sans-serif;
  color: u.$text-primary;
}

.app {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}


/* 极光光球 - 固定定位、大模糊、缓慢浮动 */
.orb {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
  width: 55vw;
  height: 55vw;
  filter: blur(80px);
  animation: orb-float 15s ease-in-out infinite;
}

.orb-1 {
  background: radial-gradient(circle, rgba(162, 210, 255, 0.4), transparent 70%);
  top: -20%;
  left: -10%;
  animation-delay: 0s;
}

.orb-2 {
  background: radial-gradient(circle, rgba(200, 180, 255, 0.3), transparent 70%);
  top: 30%;
  right: -15%;
  animation-delay: -5s;
}

.orb-3 {
  background: radial-gradient(circle, rgba(180, 220, 255, 0.25), transparent 70%);
  bottom: -10%;
  left: 20%;
  animation-delay: -10s;
}

@keyframes orb-float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(3%, 3%) scale(1.05);
  }
  66% {
    transform: translate(-2%, -2%) scale(0.98);
  }
}

/* H5 隐藏原生 tabBar 时为内容留出底部空间 */
/* #ifdef H5 */
.uni-tabbar-bottom {
  display: none !important;
}
page {
  padding-bottom: 60px;
}
/* #endif */
</style>
