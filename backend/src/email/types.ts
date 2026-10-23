/** Inline MIME part referenced from HTML as `cid:…`. */
export type EmailInlineImage = {
  cid: string;
  filename: string;
  mimeType: string;
  data: Buffer;
};

export type TransactionalEmailPayload = {
  to: string;
  subject: string;
  plain: string;
  html: string;
  inlineImages?: EmailInlineImage[];
  /** Overrides default From (Gmail user or env). */
  from?: string;
};
