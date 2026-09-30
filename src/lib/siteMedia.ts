import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import hero2 from "@/assets/hero-students-2.jpg";
import hero4 from "@/assets/hero-students-4.jpg";
import hero5 from "@/assets/hero-students-5.jpg";
import academicsHero from "@/assets/academics-computers.jpg";
import achievements from "@/assets/achievements.jpg";
import currCs from "@/assets/curriculum-cs.jpg";
import currMath from "@/assets/curriculum-math.jpg";
import currLit from "@/assets/curriculum-literature.jpg";
import currSci from "@/assets/curriculum-science.jpg";
import currArts from "@/assets/curriculum-arts.jpg";
import currPerf from "@/assets/curriculum-performing.jpg";
import actSports from "@/assets/activity-sports.jpg";
import actMusic from "@/assets/activity-music.jpg";
import actArts from "@/assets/activity-arts.jpg";
import actClubs from "@/assets/activity-clubs.jpg";
import principal from "@/assets/principal-moyo.jpg";

/**
 * Every picture on the public website that the admin can replace from the portal.
 * An uploaded replacement is kept in `site_settings` under the slot's key; until
 * one is uploaded the built-in picture is shown.
 */
export interface MediaSlot {
  key: string;
  page: string;
  label: string;
  fallback: string;
  /** Page banners can also be a short looping video. */
  allowVideo?: boolean;
  /** Shape the picture is shown in, as a hint for the admin. */
  shape: "banner" | "landscape" | "portrait" | "square";
}

export const MEDIA_SLOTS: MediaSlot[] = [
  { key: "principal_photo", page: "Home", label: "Principal's photo", fallback: principal, shape: "portrait" },
  { key: "media:home.curriculum.cs", page: "Home", label: "Curriculum: Computer Science", fallback: currCs, shape: "landscape" },
  { key: "media:home.curriculum.math", page: "Home", label: "Curriculum: Mathematics", fallback: currMath, shape: "landscape" },
  { key: "media:home.curriculum.lit", page: "Home", label: "Curriculum: Literature & Languages", fallback: currLit, shape: "landscape" },
  { key: "media:home.curriculum.sci", page: "Home", label: "Curriculum: Sciences", fallback: currSci, shape: "landscape" },
  { key: "media:home.curriculum.arts", page: "Home", label: "Curriculum: Visual Arts", fallback: currArts, shape: "landscape" },
  { key: "media:home.curriculum.perf", page: "Home", label: "Curriculum: Performing Arts", fallback: currPerf, shape: "landscape" },
  { key: "media:home.activities.sports", page: "Home", label: "Activities: Sports", fallback: actSports, shape: "portrait" },
  { key: "media:home.activities.music", page: "Home", label: "Activities: Music", fallback: actMusic, shape: "portrait" },
  { key: "media:home.activities.arts", page: "Home", label: "Activities: Arts", fallback: actArts, shape: "portrait" },
  { key: "media:home.activities.clubs", page: "Home", label: "Activities: Clubs", fallback: actClubs, shape: "portrait" },
  { key: "media:about.hero", page: "About", label: "Page banner", fallback: hero2, allowVideo: true, shape: "banner" },
  { key: "media:academics.hero", page: "Academics", label: "Page banner", fallback: academicsHero, allowVideo: true, shape: "banner" },
  { key: "achievements_image", page: "Academics", label: "Achievements picture", fallback: achievements, shape: "landscape" },
  { key: "media:admissions.hero", page: "Admissions", label: "Page banner", fallback: hero4, allowVideo: true, shape: "banner" },
  { key: "media:contact.hero", page: "Contact", label: "Page banner", fallback: hero5, allowVideo: true, shape: "banner" },
  { key: "media:gallery.hero", page: "Gallery", label: "Page banner", fallback: actMusic, allowVideo: true, shape: "banner" },
];

const SLOT_KEYS = MEDIA_SLOTS.map((s) => s.key);
const CACHE_KEY = "concepts.siteMedia";

function cached(): Record<string, string> | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

export async function fetchSiteMedia(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("site_settings").select("setting_key, setting_value").in("setting_key", SLOT_KEYS);
  if (error) throw error;
  const map = Object.fromEntries((data ?? []).filter((r) => r.setting_value).map((r) => [r.setting_key, r.setting_value]));
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    // Only a speed-up for the next visit.
  }
  return map;
}

export const SITE_MEDIA_QUERY = ["site-media"] as const;

/**
 * Returns a lookup for the website's replaceable pictures. It gives `undefined`
 * only on a first visit while the choices are still loading, so a page never
 * flashes the built-in picture before the uploaded one.
 */
export function useSiteMedia(): (key: string) => string | undefined {
  const { data, isError } = useQuery({
    queryKey: SITE_MEDIA_QUERY,
    queryFn: fetchSiteMedia,
    initialData: cached,
    // The saved copy only fills the gap; the latest choices are always fetched.
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });
  return (key: string) => {
    const uploaded = data?.[key];
    if (uploaded) return uploaded;
    if (!data && !isError) return undefined;
    return MEDIA_SLOTS.find((s) => s.key === key)?.fallback;
  };
}

/** Saves (or with `null`, clears) the uploaded picture for a slot. */
export async function saveSiteMedia(key: string, url: string | null): Promise<void> {
  if (url === null) {
    const { error } = await supabase.from("site_settings").delete().eq("setting_key", key);
    if (error) throw error;
    return;
  }
  const { data: existing, error: readError } = await supabase.from("site_settings").select("id").eq("setting_key", key);
  if (readError) throw readError;
  const { error } = existing?.length
    ? await supabase.from("site_settings").update({ setting_value: url, updated_at: new Date().toISOString() }).eq("setting_key", key)
    : await supabase.from("site_settings").insert({ setting_key: key, setting_value: url });
  if (error) throw error;
}

export interface CarouselSlide {
  id: string;
  image_url: string;
  caption: string | null;
}

const CAROUSEL_CACHE = "concepts.carousel";
export const CAROUSEL_QUERY = ["carousel-slides"] as const;

async function fetchCarousel(): Promise<CarouselSlide[]> {
  const { data, error } = await supabase
    .from("carousel_images")
    .select("id, image_url, caption")
    .eq("is_active", true)
    .order("display_order");
  if (error) throw error;
  try {
    localStorage.setItem(CAROUSEL_CACHE, JSON.stringify(data ?? []));
  } catch {
    // Only a speed-up for the next visit.
  }
  return data ?? [];
}

/**
 * The home page slides uploaded in the admin portal, or the built-in slides when
 * none have been uploaded. `undefined` only while a first visit is loading.
 */
export function useCarouselSlides(fallback: string[]): CarouselSlide[] | undefined {
  const { data, isError } = useQuery({
    queryKey: CAROUSEL_QUERY,
    queryFn: fetchCarousel,
    initialData: () => {
      try {
        const raw = localStorage.getItem(CAROUSEL_CACHE);
        return raw ? (JSON.parse(raw) as CarouselSlide[]) : undefined;
      } catch {
        return undefined;
      }
    },
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });
  if (data?.length) return data;
  if (!data && !isError) return undefined;
  return fallback.map((image_url, i) => ({ id: `built-in-${i}`, image_url, caption: null }));
}
