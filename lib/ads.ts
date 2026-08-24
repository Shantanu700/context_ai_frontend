import {
  API_URL,
  UNREACHABLE,
  mediaSrc,
  readDrfError,
  redirectOn401,
  type Ad,
  type AdTypeEnum,
} from "@/lib/api";

/**
 * Mirrors IAB_CATEGORIES in ../backend/core/gemini.py, which constrains what
 * Gemini may tag a scene with. `core/matching.py` boosts a match by intersecting
 * the scene's categories with the ad's, so a value that isn't on this list can
 * never boost anything — hence a fixed vocabulary here rather than free text.
 */
export const IAB_CATEGORIES = [
  "Automotive",
  "Business",
  "Careers",
  "Education",
  "Family & Parenting",
  "Food & Drink",
  "Health & Fitness",
  "Hobbies & Interests",
  "Home & Garden",
  "Personal Finance",
  "Pets",
  "Real Estate",
  "Science",
  "Shopping",
  "Society",
  "Sports",
  "Style & Fashion",
  "Technology & Computing",
  "Travel",
] as const;

export type AdResult = { ok: true; ad: Ad } | { ok: false; message: string };

export type NewAd = {
  brand: string;
  title: string;
  description: string;
  ad_type: AdTypeEnum;
  iab_categories: string[];
  target_tone: string;
};

/**
 * Both ad writes carry a file, and both are generated JSON-only — hey-api picked
 * the first content type off a schema that advertises multipart (see the same
 * note on `uploadVideoFile`). So they bypass the SDK. `credentials: "include"`
 * mirrors lib/api.ts: the session cookie belongs to the API's origin.
 *
 * Deliberately no Content-Type header — the browser has to set the multipart
 * boundary itself, and setting the header by hand strips it.
 */
async function sendForm(
  path: string,
  method: string,
  form: FormData,
): Promise<AdResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      body: form,
      credentials: "include",
    });
  } catch {
    return { ok: false, message: UNREACHABLE };
  }

  const body = await response.json().catch(() => null);
  if (response.ok) return { ok: true, ad: body as Ad };
  if (response.status === 401 || response.status === 403) {
    // Bare `fetch`, so no SDK interceptor to lean on.
    redirectOn401(response.status);
    return { ok: false, message: "Your session expired. Sign in again." };
  }
  return { ok: false, message: readDrfError(body, response.status) };
}

/** The asset is optional — an ad can be catalogued and embedded before its creative exists. */
export function createAd(fields: NewAd, asset: File | null): Promise<AdResult> {
  const form = new FormData();
  form.append("brand", fields.brand);
  form.append("title", fields.title);
  form.append("description", fields.description);
  form.append("ad_type", fields.ad_type);
  // One field holding JSON, not one field per category: DRF's JSONField marks a
  // multipart value as a JSON string and json.loads it, so repeated appends
  // would store the bare string of the last one instead of a list.
  form.append("iab_categories", JSON.stringify(fields.iab_categories));
  // ToneRelatedField get_or_creates by name; omitting it leaves target_tone null.
  if (fields.target_tone) form.append("target_tone", fields.target_tone);
  if (asset) form.append("asset", asset);
  return sendForm("/ads", "POST", form);
}

export function replaceAdAsset(id: number, asset: File): Promise<AdResult> {
  const form = new FormData();
  form.append("asset", asset);
  return sendForm(`/ads/${id}/asset`, "PUT", form);
}

export function assetSrc(ad: Ad): string | null {
  return mediaSrc(ad.asset_url);
}

/**
 * `iab_categories` is a Django JSONField, which drf-spectacular can only type as
 * `unknown` — narrow it rather than casting, since nothing guarantees the shape.
 */
export function categoriesOf(ad: Ad): string[] {
  return Array.isArray(ad.iab_categories)
    ? ad.iab_categories.filter((c): c is string => typeof c === "string")
    : [];
}

/** Videos get `ad_type: "video"`, anything else (a PNG overlay) gets "overlay". */
export function adTypeFor(file: File): AdTypeEnum {
  return file.type.startsWith("video/") ? "video" : "overlay";
}
