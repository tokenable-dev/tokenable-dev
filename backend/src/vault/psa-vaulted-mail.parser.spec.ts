import {
  decidePsaVaultedMailIngest,
  parsePsaVaultedMail,
} from './psa-vaulted-mail.parser';
import { PSA_ITEMS_RECEIVED_SUBJECT } from './psa-mail.shared';

const VAULTED_BODY = `
PSA
Items Vaulted

The following items are now secured in your PSA Vault.

48785771 - 2018 PANINI PRIZM ROOKIE SIGNATURES #RSLW4 LONNIE WALKER IV PSA 10

If you don't see everything from your recent submission above, don't worry. You'll receive another email soon when those items are vaulted.

Collectors
`;

const ARRIVAL_BODY = `
PSA Vault

Items Vaulted

Your items have been received and securely stored in your vault.

148872613 - CARD A PSA 10
`;

describe('parsePsaVaultedMail', () => {
  it('extracts certs from secured vault mail', () => {
    const r = parsePsaVaultedMail({
      subject: PSA_ITEMS_RECEIVED_SUBJECT,
      from: 'PSA Vault <noreply@collectors.com>',
      bodyText: VAULTED_BODY,
    });
    expect(r.matched).toBe(true);
    expect(r.certs).toEqual(['48785771']);
  });

  it('rejects intake/arrival body', () => {
    const r = parsePsaVaultedMail({
      subject: PSA_ITEMS_RECEIVED_SUBJECT,
      from: 'noreply@collectors.com',
      bodyText: ARRIVAL_BODY,
    });
    expect(r.matched).toBe(false);
    expect(r.reason).toBe('arrival_intake_body');
    expect(decidePsaVaultedMailIngest(r)).toBe('skip_label');
  });

  it('enqueues no_certs instead of silent drop', () => {
    const r = parsePsaVaultedMail({
      subject: PSA_ITEMS_RECEIVED_SUBJECT,
      from: 'noreply@collectors.com',
      bodyText:
        'The following items are now secured in your PSA Vault.\n\nNo cert lines.',
    });
    expect(r.matched).toBe(false);
    expect(r.reason).toBe('no_certs');
    expect(decidePsaVaultedMailIngest(r)).toBe('enqueue');
  });

  it('enqueues ambiguous body with both arrival and vaulted markers', () => {
    const r = parsePsaVaultedMail({
      subject: PSA_ITEMS_RECEIVED_SUBJECT,
      from: 'noreply@collectors.com',
      bodyText: `
Your items have been received and securely stored in your vault.
The following items are now secured in your PSA Vault.
48785771 - CARD PSA 10
`,
    });
    expect(r.matched).toBe(false);
    expect(r.reason).toBe('ambiguous_arrival_and_vaulted');
    expect(decidePsaVaultedMailIngest(r)).toBe('enqueue');
  });
});
