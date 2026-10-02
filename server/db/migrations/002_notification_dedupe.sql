-- =====================================================================
-- Migration 002: notification deduplication
-- Allows alerts (budget warnings, bill reminders, ...) to be created
-- idempotently: same (user, dedupe_key) never produces two rows.
-- NULL dedupe_key rows (normal user messages) are never deduplicated.
-- =====================================================================

ALTER TABLE notifications
  ADD COLUMN dedupe_key VARCHAR(191) NULL,
  ADD UNIQUE KEY uq_notifications_dedupe (user_id, dedupe_key);
