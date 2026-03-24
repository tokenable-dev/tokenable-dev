-- 운영(NODE_ENV=production) 첫 배포 또는 기존 DB 업그레이드 시 실행.
-- 로컬 개발에서 synchronize=true 이면 TypeORM이 자동 반영하므로 생략 가능.
-- PostgreSQL 11+ (ADD COLUMN IF NOT EXISTS)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS platform_email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verification_token_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_email_last_sent_at TIMESTAMPTZ;
