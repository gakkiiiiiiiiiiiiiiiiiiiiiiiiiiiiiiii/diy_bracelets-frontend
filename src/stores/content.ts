import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  api,
  isMockApiFallbackError,
  type ContentConfig,
  type HomeFeaturedWork,
  type PublishedContentConfig,
} from '@/api';
import { contentDefaults } from '@/data/contentDefaults';

function text(remote: unknown, fallback: string) {
  return typeof remote === 'string' && remote.trim() ? remote : fallback;
}

function list<T>(remote: unknown, fallback: T[]) {
  return Array.isArray(remote) && remote.length ? (remote as T[]) : fallback;
}

function isLegacyBrand(remote: PublishedContentConfig['brand']) {
  return remote?.name === '养个石头' && remote?.logoText === '养个石头';
}

function isLegacyDiy(remote: PublishedContentConfig['diy']) {
  return remote?.title === '设计你的专属手串' && remote?.startButtonText === '开始设计';
}

function remoteFeaturedItems(remote: PublishedContentConfig['home']): HomeFeaturedWork[] {
  const designs = remote?.designs;
  if (!Array.isArray(designs) || !designs.length || designs.some((item) => !item?.id || !item?.image)) {
    return contentDefaults.home.featured.items;
  }
  return designs.map((item) => ({
    id: item.id,
    title: item.title,
    caption: item.author,
    image: item.image,
    path: `/pages/goods/detail/detail?id=${encodeURIComponent(item.id)}`,
  }));
}

function mergeContent(remote?: PublishedContentConfig | null): ContentConfig {
  const remoteBrand = isLegacyBrand(remote?.brand ?? null) ? null : remote?.brand;
  const remoteHome = remote?.home;
  const remoteDiy = isLegacyDiy(remote?.diy ?? null) ? null : remote?.diy;
  const hero = remoteHome?.hero;
  const materialSection = remoteHome?.materials;
  const featuredSection = remoteHome?.featured;
  const remoteSupport = remote?.support;
  const remotePurchase = remoteSupport?.purchase;
  const remoteTerms = remoteSupport?.terms;

  return {
    brand: {
      name: text(remoteBrand?.name, contentDefaults.brand.name),
      nameEn: text(remoteBrand?.nameEn ?? remoteBrand?.logoText, contentDefaults.brand.nameEn),
      tagline: text(remoteBrand?.tagline ?? remoteBrand?.slogan, contentDefaults.brand.tagline),
      primaryColor: text(remoteBrand?.primaryColor, contentDefaults.brand.primaryColor),
      secondaryColor: text(remoteBrand?.secondaryColor, contentDefaults.brand.secondaryColor),
      supportId: text(remoteBrand?.supportId, contentDefaults.brand.supportId),
      supportHours: text(remoteBrand?.supportHours, contentDefaults.brand.supportHours),
    },
    home: {
      hero: {
        eyebrow: text(hero?.eyebrow, contentDefaults.home.hero.eyebrow),
        title: text(hero?.title ?? remoteDiy?.title, contentDefaults.home.hero.title),
        description: text(hero?.description ?? remoteDiy?.subtitle, contentDefaults.home.hero.description),
        image: text(hero?.image, contentDefaults.home.hero.image),
        primaryAction: {
          label: text(hero?.primaryAction?.label ?? remoteDiy?.startButtonText, contentDefaults.home.hero.primaryAction.label),
          path: text(hero?.primaryAction?.path, contentDefaults.home.hero.primaryAction.path),
        },
      },
      inspirationCarousel: {
        designIds: Array.isArray(remoteHome?.inspirationCarousel?.designIds)
          ? remoteHome.inspirationCarousel.designIds.filter((id): id is string => typeof id === 'string' && !!id)
          : contentDefaults.home.inspirationCarousel.designIds,
      },
      materials: {
        eyebrow: text(materialSection?.eyebrow, contentDefaults.home.materials.eyebrow),
        title: text(materialSection?.title, contentDefaults.home.materials.title),
        description: text(materialSection?.description, contentDefaults.home.materials.description),
        items: list(materialSection?.items, contentDefaults.home.materials.items),
      },
      featured: {
        eyebrow: text(featuredSection?.eyebrow, contentDefaults.home.featured.eyebrow),
        title: text(featuredSection?.title, contentDefaults.home.featured.title),
        actionLabel: text(featuredSection?.actionLabel, contentDefaults.home.featured.actionLabel),
        actionPath: text(featuredSection?.actionPath, contentDefaults.home.featured.actionPath),
        items: list(featuredSection?.items, remoteFeaturedItems(remoteHome ?? null)),
      },
    },
    diy: {
      pageTitle: text(remoteDiy?.pageTitle, contentDefaults.diy.pageTitle),
      canvasTitle: text(remoteDiy?.canvasTitle, contentDefaults.diy.canvasTitle),
      canvasHint: text(remoteDiy?.canvasHint, contentDefaults.diy.canvasHint),
      noticeLabel: text(remoteDiy?.noticeLabel, contentDefaults.diy.noticeLabel),
      saveLabel: text(remoteDiy?.saveLabel, contentDefaults.diy.saveLabel),
      finishLabel: text(remoteDiy?.finishLabel, contentDefaults.diy.finishLabel),
      selectHint: text(remoteDiy?.selectHint, contentDefaults.diy.selectHint),
      stageLabel: text(remoteDiy?.stageLabel ?? remoteDiy?.guideTitle, contentDefaults.diy.stageLabel),
      stageHint: text(remoteDiy?.stageHint ?? remoteDiy?.guideDescription, contentDefaults.diy.stageHint),
      experiencePoints: list(
        remoteDiy?.experiencePoints ?? remoteDiy?.tips?.map((label, index) => ({ id: `tip-${index}`, label })),
        contentDefaults.diy.experiencePoints,
      ),
      materialPreviews: list(remoteDiy?.materialPreviews, contentDefaults.diy.materialPreviews),
    },
    support: {
      helpTopics: list(remoteSupport?.helpTopics, contentDefaults.support.helpTopics),
      purchase: {
        heroKicker: text(remotePurchase?.heroKicker, contentDefaults.support.purchase.heroKicker),
        title: text(remotePurchase?.title, contentDefaults.support.purchase.title),
        subtitle: text(remotePurchase?.subtitle, contentDefaults.support.purchase.subtitle),
        contactText: text(remotePurchase?.contactText, contentDefaults.support.purchase.contactText),
        sections: list(remotePurchase?.sections, contentDefaults.support.purchase.sections),
      },
      terms: {
        intro: text(remoteTerms?.intro, contentDefaults.support.terms.intro),
        sections: list(remoteTerms?.sections, contentDefaults.support.terms.sections),
      },
    },
  };
}

export const useContentStore = defineStore('content', () => {
  const content = ref<ContentConfig>(mergeContent());
  const loading = ref(false);
  const loaded = ref(false);
  const source = ref<'defaults' | 'api'>('defaults');

  const brand = computed(() => content.value.brand);
  const home = computed(() => content.value.home);
  const diy = computed(() => content.value.diy);
  const support = computed(() => content.value.support);

  async function fetchContent(force = false) {
    if (loading.value || (loaded.value && !force)) return;

    loading.value = true;
    try {
      content.value = mergeContent(await api.getContent());
      source.value = 'api';
    } catch (error) {
      content.value = mergeContent();
      source.value = 'defaults';
      if (!isMockApiFallbackError(error)) {
        console.warn('[content] API failed, using defaults:', error);
      }
    } finally {
      loading.value = false;
      loaded.value = true;
    }
  }

  return {
    content,
    brand,
    home,
    diy,
    support,
    loading,
    loaded,
    source,
    fetchContent,
  };
});
