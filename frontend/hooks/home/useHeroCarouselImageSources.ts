"use client";

import { HERO_LANDING_IMAGE_URLS } from "@/lib/home/heroCarouselAssets";

/**
 * Static curated card images for the home hero ring (`public/assets/home/newcards/c01…c06.jpg`).
 */
export function useHeroCarouselImageSources() {
  return {
    data: HERO_LANDING_IMAGE_URLS,
    isPending: false,
  };
}
