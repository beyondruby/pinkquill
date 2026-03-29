export function extractStorageObjectPath(
  input: string | null | undefined,
  bucket: string
): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const bucketPrefix = `${bucket}/`;
  if (trimmed.startsWith(bucketPrefix)) {
    return trimmed.slice(bucketPrefix.length);
  }

  // Some rows persist the raw storage object key without the bucket prefix.
  // Treat non-URL values as already bucket-relative so cleanup still works.
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/render/image/public/${bucket}/`,
  ];

  const pathname = decodeURIComponent(url.pathname);
  for (const marker of markers) {
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex === -1) continue;

    const extracted = pathname.slice(markerIndex + marker.length).trim();
    return extracted || null;
  }

  return null;
}
