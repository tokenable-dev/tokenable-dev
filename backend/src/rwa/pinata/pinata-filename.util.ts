/**
 * Pinata treats `/` in filenames as a folder path → directory CID (`bafy…`).
 * Wallets (MetaMask) expect `image` to resolve to a single file (`bafkrei…` / JPEG bytes).
 */
export function safeIpfsUploadFilename(base: string, extension: string): string {
  const ext = extension.replace(/^\./, '').trim() || 'jpg';
  const leaf = base.split(/[/\\]/).pop()?.trim() ?? '';
  const stem =
    leaf.replace(/\.[a-z0-9]+$/i, '').replace(/[^\w.\- ()]/g, '').trim() ||
    'rwa-image';
  return `${stem.slice(0, 80)}.${ext}`;
}
