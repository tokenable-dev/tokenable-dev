/** Pin a tag to the top of Swagger UI; remaining tags sorted A→Z. */
export function sortSwaggerTagsPinFirst(
  tags: Array<{ name: string; description?: string }> | undefined,
  pinnedName: string,
): Array<{ name: string; description?: string }> | undefined {
  if (!tags?.length) return tags;
  const key = pinnedName.trim().toLowerCase();
  const pinned = tags.find((t) => t.name.trim().toLowerCase() === key);
  const rest = tags
    .filter((t) => t.name.trim().toLowerCase() !== key)
    .sort((a, b) => a.name.localeCompare(b.name));
  return pinned ? [pinned, ...rest] : rest;
}
