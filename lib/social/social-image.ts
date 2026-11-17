import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const MIN_RATIO = 0.8; // Instagram's tallest (4:5)
const MAX_RATIO = 1.91; // Instagram's widest
const MAX_WIDTH = 1440;
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;

function uploadBase(): string {
  const configured = process.env.PUBLIC_UPLOAD_BASE_URL?.trim() || "/uploads";
  return configured.startsWith("/") ? configured.replace(/\/$/, "") : `/${configured.replace(/\/$/, "")}`;
}

function localUploadDir(): string {
  const configured = process.env.LOCAL_UPLOAD_DIR?.trim() || "public/uploads";
  return path.resolve(path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured));
}

/** A cover DIYSEO stored itself (the only kind the social image uses: nothing is fetched from a remote URL). */
export function isLocalCover(coverImageUrl: string | null | undefined): coverImageUrl is string {
  return typeof coverImageUrl === "string" && coverImageUrl.startsWith(`${uploadBase()}/`);
}

/** The cover's bytes from LOCAL_UPLOAD_DIR, or null (not local, outside the dir, missing, too big). */
export async function loadLocalCover(coverImageUrl: string): Promise<Buffer | null> {
  if (!isLocalCover(coverImageUrl)) return null;
  let relative: string;
  try {
    relative = decodeURIComponent(coverImageUrl.slice(uploadBase().length + 1).split(/[?#]/)[0]);
  } catch {
    return null;
  }
  const baseDir = localUploadDir();
  const file = path.resolve(baseDir, relative);
  if (!file.startsWith(`${baseDir}${path.sep}`)) return null;
  try {
    const info = await stat(file);
    if (!info.isFile() || info.size > MAX_BYTES) return null;
    return await readFile(file);
  } catch {
    return null;
  }
}

/** A centred crop that brings the ratio into Instagram's 4:5–1.91:1 range (unchanged when already inside). */
export function cropBox(width: number, height: number): { left: number; top: number; width: number; height: number } {
  const ratio = width / height;
  if (ratio > MAX_RATIO) {
    const w = Math.round(height * MAX_RATIO);
    return { left: Math.floor((width - w) / 2), top: 0, width: w, height };
  }
  if (ratio < MIN_RATIO) {
    const h = Math.round(width / MIN_RATIO);
    return { left: 0, top: Math.floor((height - h) / 2), width, height: h };
  }
  return { left: 0, top: 0, width, height };
}

/** JPEG (Instagram accepts only JPEG), cropped to a ratio Instagram takes, at most 1440 px wide. */
export async function toSocialJpeg(input: Buffer): Promise<Buffer> {
  // Apply the EXIF orientation first, so the crop is computed on the image as it is shown.
  const upright = await sharp(input, { limitInputPixels: MAX_PIXELS }).rotate().toBuffer();
  const meta = await sharp(upright).metadata();
  if (!meta.width || !meta.height) throw new Error("Unreadable image");
  return sharp(upright)
    .extract(cropBox(meta.width, meta.height))
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85 })
    .toBuffer();
}

/**
 * The social JPEG for this cover, rendered once per cover version and kept under LOCAL_UPLOAD_DIR/social-cache,
 * so repeated fetches (Meta, crawlers) never redo the image work. Null when the cover cannot be loaded.
 */
export async function cachedSocialJpeg(
  coverImageUrl: string,
  articleId: string,
  render: (input: Buffer) => Promise<Buffer> = toSocialJpeg
): Promise<Buffer | null> {
  const version = (coverImageUrl.split("/").pop() ?? "cover").replace(/[^A-Za-z0-9._-]/g, "_");
  const dir = path.join(localUploadDir(), "social-cache");
  const file = path.join(dir, `${articleId.replace(/[^A-Za-z0-9_-]/g, "_")}-${version}.jpg`);
  try {
    return await readFile(file);
  } catch {
    // not cached yet
  }
  const source = await loadLocalCover(coverImageUrl);
  if (!source) return null;
  const jpeg = await render(source);
  try {
    await mkdir(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, jpeg);
    await rename(tmp, file);
  } catch {
    // A cache that cannot be written only costs a re-render next time.
  }
  return jpeg;
}
