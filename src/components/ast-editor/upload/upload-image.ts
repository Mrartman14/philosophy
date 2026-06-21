"use server";
import "server-only";
import { cookies } from "next/headers";

import { API_URL } from "@/api/base-url";
import { getT } from "@/i18n";
import { instrumentedFetch } from "@/services/observability/server-fetch";

export type UploadImageResult =
  | { success: true; data: { storage_key: string; upload_id: string } }
  | {
      success: false;
      error: string;
      code: "forbidden" | "image_too_large" | "image_invalid_mime";
    }
  | { success: false; error: string; code?: undefined };

interface ApiError {
  code?: string;
  error?: string;
}

export async function uploadImage(formData: FormData): Promise<UploadImageResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "file is required" };
  }

  const [cookieStore, t] = await Promise.all([cookies(), getT("editor")]);
  const token = cookieStore.get("token")?.value;

  let res: Response;
  try {
    res = await instrumentedFetch(`${API_URL}/api/uploads/images`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }, { surface: "image.upload" });
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : t("imageUploadNetworkError"),
    };
  }

  if (res.status === 201) {
    const body = (await res.json()) as { storage_key: string; upload_id: string };
    return { success: true, data: body };
  }

  let body: ApiError = {};
  try {
    body = (await res.json()) as ApiError;
  } catch {
    /* empty body / non-JSON — fall through to status-based mapping */
  }

  if (res.status === 401 || res.status === 403) {
    return { success: false, error: body.error ?? t("imageUploadNoAccess"), code: "forbidden" };
  }
  if (res.status === 413 || body.code === "IMAGE_TOO_LARGE") {
    return {
      success: false,
      error: body.error ?? t("imageUploadTooLarge"),
      code: "image_too_large",
    };
  }
  if (res.status === 422 || body.code === "IMAGE_INVALID_MIME") {
    return {
      success: false,
      error: body.error ?? t("imageUploadInvalidMime"),
      code: "image_invalid_mime",
    };
  }
  return { success: false, error: body.error ?? t("imageUploadFailed", { status: res.status }) };
}
