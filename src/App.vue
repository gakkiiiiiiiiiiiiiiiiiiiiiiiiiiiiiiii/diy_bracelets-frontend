<script setup lang="ts">
</script>

<template>
  <view class="app">
  </view>
</template>

<style lang="scss">
@use '@/uni.scss' as u;

page {
  background: #f8f9fd;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', 'PingFang SC', 'Helvetica Neue', sans-serif;
  color: u.$text-primary;
}

.app {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

/* H5 keeps the native tabBar visible to match the mini-program shell. */
/* #ifdef H5 */
html,
body,
page,
uni-page,
uni-page-body {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

html::-webkit-scrollbar,
body::-webkit-scrollbar,
page::-webkit-scrollbar,
uni-page::-webkit-scrollbar,
uni-page-body::-webkit-scrollbar,
*::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.uni-tabbar-bottom {
  display: flex !important;
  position: fixed !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 90 !important;
  min-height: calc(58px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(18, 20, 28, 0.06) !important;
  background: rgba(255, 255, 255, 0.96) !important;
  box-shadow: 0 -10px 22px rgba(18, 20, 28, 0.06);
  backdrop-filter: blur(12px);
}
page {
  padding-bottom: calc(58px + env(safe-area-inset-bottom));
}

uni-app:has(.app-subpage) uni-tabbar,
uni-app:has(.app-subpage) .uni-tabbar-bottom {
  display: none !important;
}

uni-page-body:has(> .app-subpage) {
  padding-bottom: 0 !important;
}

body:has(uni-page-body > .app-subpage) page {
  padding-bottom: 0 !important;
}
/* #endif */
</style>
