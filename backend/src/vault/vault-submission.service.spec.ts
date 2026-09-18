import { VaultSubmissionService } from './vault-submission.service';

describe('VaultSubmissionService.isBlockedForSelfVault', () => {
  it('blocks after ship tracking (in transit / at PSA)', () => {
    expect(
      VaultSubmissionService.isBlockedForSelfVault({
        submissionStatus: 'in_transit',
        itemStatus: 'in_transit',
      }),
    ).toBe(true);
    expect(
      VaultSubmissionService.isBlockedForSelfVault({
        submissionStatus: 'psa_reviewing',
        itemStatus: 'reviewing',
      }),
    ).toBe(true);
    expect(
      VaultSubmissionService.isBlockedForSelfVault({
        submissionStatus: 'in_transit',
        itemStatus: 'confirmed',
      }),
    ).toBe(true);
  });

  it('allows draft / awaiting shipment / rejected returns', () => {
    expect(
      VaultSubmissionService.isBlockedForSelfVault({
        submissionStatus: 'draft',
        itemStatus: 'confirmed',
      }),
    ).toBe(false);
    expect(
      VaultSubmissionService.isBlockedForSelfVault({
        submissionStatus: 'awaiting_shipment',
        itemStatus: 'confirmed',
      }),
    ).toBe(false);
    expect(
      VaultSubmissionService.isBlockedForSelfVault({
        submissionStatus: 'psa_reviewing',
        itemStatus: 'rejected',
      }),
    ).toBe(false);
  });
});

describe('VaultSubmissionService.resolveScenario', () => {
  it('maps draft / awaiting / transit', () => {
    expect(VaultSubmissionService.resolveScenario('draft', [])).toBe('A');
    expect(VaultSubmissionService.resolveScenario('awaiting_shipment', [])).toBe('B');
    expect(VaultSubmissionService.resolveScenario('in_transit', [])).toBe('C');
  });

  it('maps PSA reviewing and outcomes', () => {
    expect(
      VaultSubmissionService.resolveScenario('psa_reviewing', [
        { status: 'reviewing' },
        { status: 'reviewing' },
      ]),
    ).toBe('D');
    expect(
      VaultSubmissionService.resolveScenario('psa_reviewing', [
        { status: 'approved' },
        { status: 'approved' },
      ]),
    ).toBe('E');
    expect(
      VaultSubmissionService.resolveScenario('psa_reviewing', [
        { status: 'rejected' },
        { status: 'rejected' },
      ]),
    ).toBe('F');
    expect(
      VaultSubmissionService.resolveScenario('completed', [
        { status: 'completed' },
        { status: 'completed' },
      ]),
    ).toBe('G');
    expect(
      VaultSubmissionService.resolveScenario('psa_reviewing', [
        { status: 'completed' },
        { status: 'failed' },
      ]),
    ).toBe('H');
  });
});
