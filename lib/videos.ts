import {
  API_URL,
  UNREACHABLE,
  mediaSrc,
  readDrfError,
  redirectOn401,
  videosCreate,
  videosReprocessCreate,
  type VideoJob,
  type VideoList,
  type VideoStatus,
} from "@/lib/api";

export { mediaSrc };

export type CreateResult =
  | { ok: true; video: VideoJob }
  | { ok: false; message: string };

/**
 * Which pipeline stages to run. The keys are the wire format for both
 * `POST /videos` (where they all default true) and `POST /videos/{uuid}/reprocess`
 * (where they all default false and at least one must be set).
 */
export type Stages = {
  detect_scenes: boolean;
  transcribe: boolean;
  analyze: boolean;
};

export const ALL_STAGES: Stages = {
  detect_scenes: true,
  transcribe: true,
  analyze: true,
};

/**
 * Uploads one file, reporting byte progress.
 *
 * XMLHttpRequest rather than the generated SDK for two reasons: fetch cannot
 * report upload progress at all, and `videosCreate` is generated as JSON-only
 * (the schema advertises multipart, but hey-api picked the first content type),
 * so a File cannot go through it. `withCredentials` is the XHR spelling of the
 * `credentials: "include"` in lib/api.ts — without it the session cookie, which
 * belongs to the API's origin, is never sent.
 */
export function uploadVideoFile(
  file: File,
  stages: Stages,
  onProgress: (fraction: number) => void,
): { promise: Promise<CreateResult>; abort: () => void } {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<CreateResult>((resolve) => {
    xhr.open("POST", `${API_URL}/videos`);
    xhr.withCredentials = true;
    // Deliberately no Content-Type: the browser has to set the multipart
    // boundary itself, and setting the header by hand strips it.

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };

    xhr.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true, video: body as VideoJob });
      } else if (xhr.status === 401 || xhr.status === 403) {
        // XHR, so no SDK interceptor to lean on.
        redirectOn401(xhr.status);
        resolve({ ok: false, message: "Your session expired. Sign in again." });
      } else {
        resolve({ ok: false, message: readDrfError(body, xhr.status) });
      }
    };

    xhr.onerror = () => resolve({ ok: false, message: UNREACHABLE });
    xhr.onabort = () => resolve({ ok: false, message: "Upload cancelled." });

    const form = new FormData();
    form.append("file", file);
    // DRF's BooleanField reads "true"/"false" out of multipart fields.
    for (const [stage, on] of Object.entries(stages)) {
      form.append(stage, String(on));
    }
    xhr.send(form);
  });

  return { promise, abort: () => xhr.abort() };
}

/** The URL path is a plain JSON body, so the generated function works as-is. */
export async function createVideoFromUrl(
  source_url: string,
  stages: Stages,
): Promise<CreateResult> {
  return settleJson(videosCreate({ body: { source_url, ...stages } }));
}

/**
 * Re-run stages on a video that is already stored, reusing its source file and —
 * unless detect_scenes is set — its existing scene boundaries.
 */
export async function reprocessVideo(
  uuid: string,
  stages: Stages,
): Promise<CreateResult> {
  return settleJson(
    videosReprocessCreate({ path: { uuid }, body: stages }),
    // 409 is the one status whose body says nothing useful.
    { 409: "This video is already processing." },
  );
}

/** Shared tail of the two JSON creates: unwrap, or turn the failure into a message. */
async function settleJson(
  request: ReturnType<typeof videosCreate | typeof videosReprocessCreate>,
  overrides: Record<number, string> = {},
): Promise<CreateResult> {
  const { data, response } = await request;
  if (data && response?.ok) return { ok: true, video: data };
  if (!response) return { ok: false, message: UNREACHABLE };
  if (overrides[response.status])
    return { ok: false, message: overrides[response.status] };
  if (response.status === 401 || response.status === 403)
    return { ok: false, message: "Your session expired. Sign in again." };

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    body = null;
  }
  return { ok: false, message: readDrfError(body, response.status) };
}

/* ---------------------------------------------------------------------------
 * Row labels.
 *
 * VideoStatus carries no filename or source_url — only uuid, dimensions and
 * timestamps — so a queue row cannot say which video it is. Remember the name
 * locally at create time. Rows created elsewhere fall back to a short uuid.
 * The real fix is adding file_key/source_url to VideoStatusSerializer.
 * ------------------------------------------------------------------------- */

const LABELS_KEY = "context.videoLabels";

type LabelMap = Record<string, string>;

function readLabels(): LabelMap {
  try {
    return JSON.parse(localStorage.getItem(LABELS_KEY) ?? "{}") as LabelMap;
  } catch {
    return {};
  }
}

export function rememberLabel(uuid: string, label: string) {
  try {
    localStorage.setItem(
      LABELS_KEY,
      JSON.stringify({ ...readLabels(), [uuid]: label }),
    );
  } catch {
    // Private mode or storage disabled — labels degrade to short uuids.
  }
}

export function labelFor(uuid: string): string {
  return readLabels()[uuid] ?? `Video ${uuid.slice(0, 8)}`;
}

/* ------------------------------------------------------------------------- */

export function thumbnailSrc(video: VideoStatus): string | null {
  return mediaSrc(video.thumbnail_url);
}

/**
 * Only the list endpoint serializes `file_url` (VideoListSerializer adds it;
 * /status does not), so this takes VideoList rather than VideoStatus. Null until
 * the worker has stored the file, which for a source_url fetch is well after create.
 */
export function videoSrc(video: VideoList): string | null {
  return mediaSrc(video.file_url);
}

export function isActive(video: VideoStatus): boolean {
  return video.status === "pending" || video.status === "processing";
}

/**
 * What the pipeline is doing right now. `percent` is null while a stage
 * reports no sub-progress — which is most of them.
 */
export function describeStatus(video: VideoStatus): {
  label: string;
  percent: number | null;
} {
  if (video.status === "failed")
    return { label: video.error || "Processing failed.", percent: null };

  if (video.status === "done") {
    const n = video.scenes_total ?? 0;
    return {
      label: n > 0 ? `Ready · ${n} scene${n === 1 ? "" : "s"}` : "Ready",
      percent: 100,
    };
  }

  if (video.status === "pending") return { label: "Queued", percent: null };

  // processing, in the order the worker actually goes through it
  if (video.duration == null)
    return { label: "Fetching and probing", percent: null };

  const total = video.scenes_total ?? 0;
  if (total === 0) {
    // scenes_total stays 0 through detect+transcribe, so this is the only label
    // covering that whole stretch. Name the stages actually enabled — saying
    // "transcribing" for a detect-only run would be a lie.
    const detect = video.detect_scenes_enabled;
    const transcribe = video.transcribe_enabled;
    const label =
      detect && transcribe
        ? "Detecting scenes, transcribing"
        : detect
          ? "Detecting scenes"
          : transcribe
            ? "Transcribing"
            : "Preparing scenes";
    return { label, percent: null };
  }

  const done = video.scenes_done ?? 0;
  return {
    label: `${done}/${total} scenes analyzed`,
    percent: Math.round((done / total) * 100),
  };
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
