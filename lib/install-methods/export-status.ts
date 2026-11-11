type ExportStatusInput = {
  exportedAt: Date | null;
  exportedCount: number | null;
  publishedCount: number;
  /** Published articles whose updatedAt is later than exportedAt. */
  updatedSinceCount: number;
  exportedFingerprint?: string | null;
  currentFingerprint?: string;
};

/** Site settings that change the exported HTML (canonicals, names, theme). */
export function exportFingerprint(site: { domain: string; name: string; widgetTheme: string | null }): string {
  return JSON.stringify([site.domain.trim().toLowerCase(), site.name, site.widgetTheme ?? ""]);
}

/** True when the downloaded ZIP no longer matches what is published or configured. */
export function hasChangesSinceExport({
  exportedAt,
  exportedCount,
  publishedCount,
  updatedSinceCount,
  exportedFingerprint,
  currentFingerprint
}: ExportStatusInput): boolean {
  if (!exportedAt) {
    return publishedCount > 0;
  }

  if (currentFingerprint !== undefined && exportedFingerprint !== currentFingerprint) {
    return true;
  }

  return exportedCount !== publishedCount || updatedSinceCount > 0;
}
