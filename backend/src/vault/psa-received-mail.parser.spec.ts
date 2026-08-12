import {
  decidePsaMailIngest,
  parsePsaReceivedMail,
  PSA_RECEIVED_SUBJECT,
} from './psa-received-mail.parser';

const ITEMS_RECEIVED_BODY = `
PSA Vault

Items Vaulted

Your items have been received and securely stored in your vault.


Your submission

148872613 - 2026 POKEMON JAPANESE M3-NULLIFYING ZERO | ART RARE #088 PROBOPASS PSA 10

View collection


Collectors

Collectors, 1610 E. St Andrew Place, Santa Ana, CA 92705

Terms and conditions
`;

const SHIPPING_INSTRUCTION_BODY = `
For faster processing, please print this email and include with your submission.
PSA Vault

Vault address

To be accepted, your submission must be clearly labeled with the address:

HONG JONGNAM (106008542)
600 Ships Landing Way
New Castle, DE 19720

Your submission

151164586 - 2023 POKEMON SVP EN-SV BLACK STAR PROMO | POKEMON X VAN GOGH #085 PIKACHU WITH GREY FELT HAT PSA 10
`;

describe('parsePsaReceivedMail', () => {
  it('extracts certs from Items Received mail', () => {
    const r = parsePsaReceivedMail({
      subject: PSA_RECEIVED_SUBJECT,
      from: 'PSA Vault <noreply@collectors.com>',
      bodyText: ITEMS_RECEIVED_BODY,
    });
    expect(r.matched).toBe(true);
    expect(r.certs).toEqual(['148872613']);
  });

  it('ignores shipping-instruction mail by subject', () => {
    const r = parsePsaReceivedMail({
      subject: '106008542 - Your PSA Vault Submission',
      from: 'PSA Vault <noreply@collectors.com>',
      bodyText: SHIPPING_INSTRUCTION_BODY,
    });
    expect(r.matched).toBe(false);
    expect(r.reason).toBe('subject_not_items_received');
    expect(r.certs).toEqual([]);
  });

  it('ignores non-collectors from', () => {
    const r = parsePsaReceivedMail({
      subject: PSA_RECEIVED_SUBJECT,
      from: 'someone@example.com',
      bodyText: ITEMS_RECEIVED_BODY,
    });
    expect(r.matched).toBe(false);
    expect(r.reason).toBe('from_not_collectors');
  });

  it('extracts multiple certs', () => {
    const r = parsePsaReceivedMail({
      subject: 'Re: Items Received at PSA Vault',
      from: 'noreply@collectors.com',
      bodyText: `
148872613 - CARD A PSA 10
999888777 - CARD B PSA 9
`,
    });
    expect(r.matched).toBe(true);
    expect(r.certs).toEqual(['148872613', '999888777']);
  });

  it('decidePsaMailIngest enqueues no_certs instead of silent drop', () => {
    const r = parsePsaReceivedMail({
      subject: PSA_RECEIVED_SUBJECT,
      from: 'noreply@collectors.com',
      bodyText: 'Items vaulted but no cert lines here',
    });
    expect(r.matched).toBe(false);
    expect(r.reason).toBe('no_certs');
    expect(decidePsaMailIngest(r)).toBe('enqueue');
  });

  it('decidePsaMailIngest skips vaulted secured body (mint path)', () => {
    const r = parsePsaReceivedMail({
      subject: PSA_RECEIVED_SUBJECT,
      from: 'noreply@collectors.com',
      bodyText: `
The following items are now secured in your PSA Vault.

48785771 - CARD PSA 10
`,
    });
    expect(r.matched).toBe(false);
    expect(r.reason).toBe('vaulted_secured_body');
    expect(decidePsaMailIngest(r)).toBe('skip_label');
  });

  it('enqueues ambiguous body with both arrival and vaulted markers', () => {
    const r = parsePsaReceivedMail({
      subject: PSA_RECEIVED_SUBJECT,
      from: 'noreply@collectors.com',
      bodyText: `
Your items have been received and securely stored in your vault.
The following items are now secured in your PSA Vault.
148872613 - CARD A PSA 10
`,
    });
    expect(r.matched).toBe(false);
    expect(r.reason).toBe('ambiguous_arrival_and_vaulted');
    expect(decidePsaMailIngest(r)).toBe('enqueue');
  });
});
