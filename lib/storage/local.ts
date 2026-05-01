import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { GeneratedCoverImageAsset } from "@/lib/ai/types";

function resolveLocalUploadDir() {
  const configured = process.env.LOCAL_UPLOAD_DIR?.trim() || "public/uploads";
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

function resolvePublicUploadBaseUrl() {
  const configured = process.env.PUBLIC_UPLOAD_BASE_URL?.trim() || "/uploads";
  return configured.startsWith("/") ? configured.replace(/\/$/, "") : `/${configured.replace(/\/$/, "")}`;
}

export async function saveArticleCoverImageLocally(input: {
  siteId: string;
  articleId: string;
  image: GeneratedCoverImageAsset;
}) {
  const localUploadDir = resolveLocalUploadDir();
  const publicUploadBaseUrl = resolvePublicUploadBaseUrl();
  const timestamp = Date.now();
  const fileName = `cover-${timestamp}.png`;
  const relativeSegments = ["sites", input.siteId, "articles", input.articleId];
  const directoryPath = path.join(localUploadDir, ...relativeSegments);
  const filePath = path.join(directoryPath, fileName);
  const publicUrl = `${publicUploadBaseUrl}/${relativeSegments.join("/")}/${fileName}`;

  try {
    await mkdir(directoryPath, { recursive: true });
    await writeFile(filePath, input.image.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown filesystem error";
    throw new Error(`Local upload dir is not writable: ${message}`);
  }

  return {
    publicUrl
  };
}
