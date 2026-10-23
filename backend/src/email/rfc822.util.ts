import type { EmailInlineImage } from './types';

function chunkBase64Lines(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/(.{76})/g, '$1\r\n')
    .trim();
}

export function buildMultipartRfc822(input: {
  to: string;
  from: string;
  subject: string;
  plain: string;
  html: string;
  inlineImages?: EmailInlineImage[];
  boundaryPrefix?: string;
}): string {
  const images = input.inlineImages ?? [];
  const prefix = input.boundaryPrefix ?? 'tk_mail';
  const altBoundary = `${prefix}_alt_${Date.now().toString(36)}`;
  const relatedBoundary = `${prefix}_rel_${Date.now().toString(36)}`;

  const headers = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'MIME-Version: 1.0',
  ];

  const altParts = [
    `--${altBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    input.plain,
    '',
    `--${altBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    input.html,
    '',
    `--${altBoundary}--`,
    '',
  ];

  if (images.length === 0) {
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      ...altParts,
    ].join('\r\n');
  }

  const imageParts = images.flatMap((img) => [
    `--${relatedBoundary}`,
    `Content-Type: ${img.mimeType}; name="${img.filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-ID: <${img.cid}>`,
    `Content-Disposition: inline; filename="${img.filename}"`,
    `X-Attachment-Id: ${img.cid}`,
    '',
    chunkBase64Lines(img.data),
    '',
  ]);

  // multipart/alternative first, then inline image parts (Gmail/Outlook cid pattern).
  return [
    ...headers,
    `Content-Type: multipart/related; boundary="${relatedBoundary}"`,
    '',
    `--${relatedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    ...altParts,
    ...imageParts,
    `--${relatedBoundary}--`,
    '',
  ].join('\r\n');
}
