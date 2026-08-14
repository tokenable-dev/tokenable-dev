import {
  formatPartnerVaultLabel,
  PSA_VAULT_LABEL,
  vaultLabelForCustody,
} from './partner-vault-label.util';

describe('formatPartnerVaultLabel', () => {
  it('appends vault when missing', () => {
    expect(formatPartnerVaultLabel('Courtyard')).toBe('Courtyard vault');
  });

  it('does not double vault suffix', () => {
    expect(formatPartnerVaultLabel('Acme Vault')).toBe('Acme Vault');
  });

  it('falls back when empty', () => {
    expect(formatPartnerVaultLabel('')).toBe('Self vault');
    expect(formatPartnerVaultLabel(null)).toBe('Self vault');
  });

  it('exports PSA default label', () => {
    expect(PSA_VAULT_LABEL).toBe('PSA Vault');
  });
});

describe('vaultLabelForCustody', () => {
  it('uses PSA Vault for standard custody even when a partner name exists', () => {
    expect(vaultLabelForCustody('standard', 'Acme')).toBe('PSA Vault');
  });

  it('uses partner vault for self_vault_hold', () => {
    expect(vaultLabelForCustody('self_vault_hold', 'Acme')).toBe('Acme vault');
  });
});
