export enum BidStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  FILLED = 'filled',
}

export enum AskStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
  CANCELLED = 'cancelled',
  SOLD = 'sold',
}

export enum MatchState {
  UNMATCHED = 'unmatched',
  CANDIDATE_MATCHED = 'candidate_matched',
  MATCHED = 'matched',
  INVALID = 'invalid',
}

export enum ExecutionState {
  PENDING = 'pending',
  LOCKED = 'locked',
  EXECUTED = 'executed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
