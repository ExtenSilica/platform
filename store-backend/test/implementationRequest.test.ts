import { describe, it, expect } from 'vitest';
import {
  rejectStructuredMoney,
  validateTitle,
  validateDescription,
  validateVisibility,
  validateRequestStatusTransition,
  requestStatusSideEffects,
  validateFundingContactEmail,
  validateOptionalShortText,
  parseCreatedByOrgId,
  isImplementationRequestStatus,
  isTerminalRequestStatus,
  isVerificationRunOutcome,
  TITLE_MIN,
  DESCRIPTION_MIN,
  ACCEPTANCE_CRITERIA_MAX,
} from '../src/lib/implementationRequest';

describe('rejectStructuredMoney', () => {
  it('allows clean implementation request bodies', () => {
    expect(
      rejectStructuredMoney({
        title: 'Spike port for Zbkb',
        description: 'a'.repeat(DESCRIPTION_MIN),
        fundingContactEmail: 'maintainer@example.com',
        fundingNote: 'Sponsor via university grant off-platform.',
      }),
    ).toBeNull();
  });

  it('rejects forbidden top-level keys', () => {
    expect(rejectStructuredMoney({ amount: 100 })).toMatch(/amount/);
    expect(rejectStructuredMoney({ wallet: '0xabc' })).toMatch(/wallet/);
    expect(rejectStructuredMoney({ USDC: true } as Record<string, unknown>)).toMatch(
      /USDC/i,
    );
  });

  it('rejects forbidden keys nested in objects', () => {
    expect(
      rejectStructuredMoney({
        title: 'Test',
        meta: { payout: { currency: 'USD' } },
      }),
    ).toMatch(/payout|currency/);
  });

  it('rejects paid and funded flags', () => {
    expect(rejectStructuredMoney({ funded: true })).toMatch(/funded/);
    expect(rejectStructuredMoney({ paid: 'yes' })).toMatch(/paid/);
  });
});

describe('validateTitle', () => {
  it('accepts titles within bounds', () => {
    expect(validateTitle('a'.repeat(TITLE_MIN))).toBeNull();
  });

  it('rejects short or non-string titles', () => {
    expect(validateTitle('hi')).toMatch(/at least/);
    expect(validateTitle(undefined)).toMatch(/required/);
  });
});

describe('validateDescription', () => {
  it('accepts descriptions within bounds', () => {
    expect(validateDescription('a'.repeat(DESCRIPTION_MIN))).toBeNull();
  });

  it('rejects short descriptions', () => {
    expect(validateDescription('too short')).toMatch(/at least/);
  });
});

describe('validateVisibility', () => {
  it('accepts known visibility values', () => {
    expect(validateVisibility('public')).toBeNull();
    expect(validateVisibility('org_only')).toBeNull();
  });

  it('rejects unknown values', () => {
    expect(validateVisibility('secret')).toMatch(/visibility must be/);
  });
});

describe('validateRequestStatusTransition', () => {
  it('allows the happy-path chain', () => {
    expect(validateRequestStatusTransition('draft', 'open')).toBeNull();
    expect(validateRequestStatusTransition('open', 'in_progress')).toBeNull();
    expect(validateRequestStatusTransition('in_progress', 'submitted')).toBeNull();
    expect(validateRequestStatusTransition('submitted', 'verified')).toBeNull();
    expect(validateRequestStatusTransition('verified', 'completed')).toBeNull();
  });

  it('allows cancellation from non-terminal states', () => {
    expect(validateRequestStatusTransition('open', 'cancelled')).toBeNull();
    expect(validateRequestStatusTransition('submitted', 'cancelled')).toBeNull();
  });

  it('rejects skipping states', () => {
    expect(validateRequestStatusTransition('draft', 'verified')).toMatch(/Cannot transition/);
    expect(validateRequestStatusTransition('open', 'completed')).toMatch(/Cannot transition/);
  });

  it('rejects transitions out of terminal states', () => {
    expect(validateRequestStatusTransition('completed', 'open')).toMatch(/Cannot transition/);
    expect(validateRequestStatusTransition('cancelled', 'open')).toMatch(/Cannot transition/);
  });
});

describe('isTerminalRequestStatus', () => {
  it('marks completed and cancelled as terminal', () => {
    expect(isTerminalRequestStatus('completed')).toBe(true);
    expect(isTerminalRequestStatus('cancelled')).toBe(true);
    expect(isTerminalRequestStatus('open')).toBe(false);
  });
});

describe('validateFundingContactEmail', () => {
  it('treats empty as optional', () => {
    expect(validateFundingContactEmail(null)).toBeNull();
    expect(validateFundingContactEmail('')).toBeNull();
  });

  it('requires @ in email', () => {
    expect(validateFundingContactEmail('not-an-email')).toMatch(/email/);
  });
});

describe('validateOptionalShortText', () => {
  it('enforces max length on acceptance criteria', () => {
    expect(
      validateOptionalShortText('x'.repeat(ACCEPTANCE_CRITERIA_MAX + 1), 'acceptanceCriteriaSummary', ACCEPTANCE_CRITERIA_MAX),
    ).toMatch(/at most/);
  });
});

describe('parseCreatedByOrgId', () => {
  it('parses positive integers', () => {
    expect(parseCreatedByOrgId(3)).toEqual({ value: 3, error: null });
  });

  it('rejects invalid values', () => {
    expect(parseCreatedByOrgId(-1).error).toMatch(/positive/);
  });
});

describe('requestStatusSideEffects', () => {
  it('sets openedAt on first transition to open', () => {
    const patch = requestStatusSideEffects('open', {
      openedAt: null,
      completedAt: null,
      cancelledAt: null,
    });
    expect(patch.openedAt).toBeInstanceOf(Date);
    expect(patch.completedAt).toBeUndefined();
  });

  it('does not overwrite an existing openedAt', () => {
    const existing = new Date('2020-01-01');
    const patch = requestStatusSideEffects('open', {
      openedAt: existing,
      completedAt: null,
      cancelledAt: null,
    });
    expect(patch.openedAt).toBeUndefined();
  });

  it('sets completedAt and cancelledAt on terminal transitions', () => {
    expect(
      requestStatusSideEffects('completed', {
        openedAt: new Date(),
        completedAt: null,
        cancelledAt: null,
      }).completedAt,
    ).toBeInstanceOf(Date);
    expect(
      requestStatusSideEffects('cancelled', {
        openedAt: null,
        completedAt: null,
        cancelledAt: null,
      }).cancelledAt,
    ).toBeInstanceOf(Date);
  });
});

describe('status type guards', () => {
  it('recognizes request statuses', () => {
    expect(isImplementationRequestStatus('submitted')).toBe(true);
    expect(isImplementationRequestStatus('paid')).toBe(false);
  });

  it('recognizes verification outcomes', () => {
    expect(isVerificationRunOutcome('pass')).toBe(true);
    expect(isVerificationRunOutcome('pending')).toBe(false);
  });
});
