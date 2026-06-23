-- password_reset token type for email-based password reset

ALTER TYPE verification_token_type ADD VALUE IF NOT EXISTS 'password_reset';
