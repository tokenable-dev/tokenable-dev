/** Pin tag(s) to the top of Swagger UI; remaining tags sorted A→Z. */
export function sortSwaggerTagsPinFirst(
  tags: Array<{ name: string; description?: string }> | undefined,
  pinnedName: string | string[],
): Array<{ name: string; description?: string }> | undefined {
  if (!tags?.length) return tags;
  const pinnedNames = (Array.isArray(pinnedName) ? pinnedName : [pinnedName]).map(
    (n) => n.trim().toLowerCase(),
  );
  const pinned: Array<{ name: string; description?: string }> = [];
  for (const key of pinnedNames) {
    const tag = tags.find((t) => t.name.trim().toLowerCase() === key);
    if (tag) pinned.push(tag);
  }
  const pinnedSet = new Set(pinned.map((t) => t.name.trim().toLowerCase()));
  const rest = tags
    .filter((t) => !pinnedSet.has(t.name.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...pinned, ...rest];
}
