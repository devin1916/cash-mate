-- =====================================================================
-- CashMate - Initial database schema (MySQL 8.x / InnoDB / utf8mb4)
-- Migration: 001_initial_schema.sql
--
-- Conventions:
--   * Every user-owned table has user_id with ON DELETE CASCADE so that
--     deleting a user never leaves orphaned financial records.
--   * created_at / updated_at on all mutable tables.
--   * Indexed on (user_id, date/type/status) for filtered pagination.
--   * user_id IS NULL on categories/payment_methods marks SYSTEM-wide
--     defaults shared by every account.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name              VARCHAR(100)    NOT NULL,
  email             VARCHAR(255)    NOT NULL,
  password_hash     VARCHAR(255)    NOT NULL,
  phone             VARCHAR(30)     NULL,
  avatar_url        VARCHAR(500)    NULL,
  role              ENUM('user','admin')  NOT NULL DEFAULT 'user',
  status            ENUM('active','inactive') NOT NULL DEFAULT 'active',
  currency          CHAR(3)         NOT NULL DEFAULT 'LKR',
  email_verified_at DATETIME        NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_status (status),
  KEY idx_users_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Refresh tokens (opaque, stored hashed; rotating)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64)        NOT NULL,
  expires_at DATETIME        NOT NULL,
  revoked_at DATETIME        NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_token_hash (token_hash),
  KEY idx_refresh_user (user_id, expires_at),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Password reset tokens
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64)        NOT NULL,
  expires_at DATETIME        NOT NULL,
  used_at    DATETIME        NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reset_token_hash (token_hash),
  KEY idx_reset_user (user_id, expires_at),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Email verification tokens
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64)        NOT NULL,
  expires_at DATETIME        NOT NULL,
  used_at    DATETIME        NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_verify_token_hash (token_hash),
  KEY idx_verify_user (user_id, expires_at),
  CONSTRAINT fk_verify_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Per-user settings (alert thresholds, notification prefs, ...)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
  user_id      BIGINT UNSIGNED NOT NULL,
  setting_key  VARCHAR(64)     NOT NULL,
  setting_value TEXT           NOT NULL,
  updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, setting_key),
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Categories (user_id NULL = built-in system category)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NULL,
  name       VARCHAR(80)     NOT NULL,
  type       ENUM('income','expense') NOT NULL,
  color      CHAR(7)         NOT NULL DEFAULT '#6366f1',
  icon       VARCHAR(40)     NOT NULL DEFAULT 'tag',
  is_system  TINYINT(1)      NOT NULL DEFAULT 0,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_categories_user_type (user_id, type),
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Payment methods (user_id NULL = built-in default)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_methods (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NULL,
  name       VARCHAR(60)     NOT NULL,
  icon       VARCHAR(40)     NOT NULL DEFAULT 'credit-card',
  color      CHAR(7)         NOT NULL DEFAULT '#3b82f6',
  is_system  TINYINT(1)      NOT NULL DEFAULT 0,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_paymethods_user (user_id),
  CONSTRAINT fk_paymethods_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Recurring transactions (salary, rent, subscriptions, ...)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           BIGINT UNSIGNED NOT NULL,
  type              ENUM('income','expense') NOT NULL,
  amount            DECIMAL(14,2)   NOT NULL,
  category_id       BIGINT UNSIGNED NOT NULL,
  payment_method_id BIGINT UNSIGNED NULL,
  description       VARCHAR(255)    NOT NULL,
  notes             TEXT            NULL,
  frequency         ENUM('daily','weekly','monthly','yearly') NOT NULL DEFAULT 'monthly',
  start_date        DATE            NOT NULL,
  end_date          DATE            NULL,
  next_run_date     DATE            NOT NULL,
  last_run_date     DATE            NULL,
  status            ENUM('active','paused','completed') NOT NULL DEFAULT 'active',
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_recurring_user_status (user_id, status, next_run_date),
  CONSTRAINT fk_recurring_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_recurring_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE RESTRICT,
  CONSTRAINT fk_recurring_paymethod FOREIGN KEY (payment_method_id)
    REFERENCES payment_methods (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Transactions (unified income + expense ledger)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           BIGINT UNSIGNED NOT NULL,
  type              ENUM('income','expense') NOT NULL,
  amount            DECIMAL(14,2)   NOT NULL,
  category_id       BIGINT UNSIGNED NOT NULL,
  payment_method_id BIGINT UNSIGNED NULL,
  recurring_id      BIGINT UNSIGNED NULL,
  description       VARCHAR(255)    NOT NULL,
  notes             TEXT            NULL,
  date              DATE            NOT NULL,
  status            ENUM('completed','pending') NOT NULL DEFAULT 'completed',
  receipt_url       VARCHAR(500)    NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tx_user_date (user_id, date),
  KEY idx_tx_user_type_date (user_id, type, date),
  KEY idx_tx_user_category (user_id, category_id),
  KEY idx_tx_user_method (user_id, payment_method_id),
  KEY idx_tx_user_created (user_id, created_at),
  CONSTRAINT fk_tx_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_tx_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE RESTRICT,
  CONSTRAINT fk_tx_paymethod FOREIGN KEY (payment_method_id)
    REFERENCES payment_methods (id) ON DELETE SET NULL,
  CONSTRAINT fk_tx_recurring FOREIGN KEY (recurring_id)
    REFERENCES recurring_transactions (id) ON DELETE SET NULL,
  CONSTRAINT chk_tx_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Budgets (monthly, optional category scope)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budgets (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NULL,           -- NULL = overall budget
  amount      DECIMAL(14,2)   NOT NULL,
  month       TINYINT UNSIGNED NOT NULL,      -- 1..12
  year        SMALLINT UNSIGNED NOT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_budget_user_period (user_id, year, month),
  CONSTRAINT fk_budget_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_budget_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE RESTRICT,
  CONSTRAINT chk_budget_amount CHECK (amount > 0),
  CONSTRAINT chk_budget_month CHECK (month BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Savings goals + contributions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS savings_goals (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        BIGINT UNSIGNED NOT NULL,
  name           VARCHAR(120)    NOT NULL,
  target_amount  DECIMAL(14,2)   NOT NULL,
  current_amount DECIMAL(14,2)   NOT NULL DEFAULT 0,
  target_date    DATE            NULL,
  description    TEXT            NULL,
  status         ENUM('active','completed','archived') NOT NULL DEFAULT 'active',
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_goals_user_status (user_id, status),
  CONSTRAINT fk_goal_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_goal_target CHECK (target_amount > 0),
  CONSTRAINT chk_goal_current CHECK (current_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS goal_contributions (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  goal_id          BIGINT UNSIGNED NOT NULL,
  user_id          BIGINT UNSIGNED NOT NULL,
  amount           DECIMAL(14,2)   NOT NULL,
  contribution_date DATE           NOT NULL,
  note             VARCHAR(255)    NULL,
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_contrib_goal (goal_id),
  KEY idx_contrib_user_date (user_id, contribution_date),
  CONSTRAINT fk_contrib_goal FOREIGN KEY (goal_id)
    REFERENCES savings_goals (id) ON DELETE CASCADE,
  CONSTRAINT fk_contrib_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_contrib_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Bills & payment reminders
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bills (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id              BIGINT UNSIGNED NOT NULL,
  name                 VARCHAR(120)    NOT NULL,
  amount               DECIMAL(14,2)   NOT NULL,
  due_date             DATE            NOT NULL,
  frequency            ENUM('none','daily','weekly','monthly','yearly') NOT NULL DEFAULT 'monthly',
  category_id          BIGINT UNSIGNED NULL,
  payment_method_id    BIGINT UNSIGNED NULL,
  reminder_days_before TINYINT UNSIGNED NOT NULL DEFAULT 3,
  status               ENUM('upcoming','paid','overdue') NOT NULL DEFAULT 'upcoming',
  paid_at              DATETIME        NULL,
  created_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bills_user_due (user_id, due_date, status),
  CONSTRAINT fk_bills_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_bills_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE SET NULL,
  CONSTRAINT fk_bills_paymethod FOREIGN KEY (payment_method_id)
    REFERENCES payment_methods (id) ON DELETE SET NULL,
  CONSTRAINT chk_bills_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  type       ENUM('budget_warning','budget_exceeded','bill_reminder','goal_progress',
                  'recurring_created','unusual_spending','account','system')
             NOT NULL DEFAULT 'system',
  title      VARCHAR(150)    NOT NULL,
  message    TEXT            NOT NULL,
  data       JSON            NULL,
  is_read    TINYINT(1)      NOT NULL DEFAULT 0,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user_read (user_id, is_read, created_at),
  KEY idx_notif_user_created (user_id, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Audit logs (kept after account deletion: FK SET NULL, no cascade)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NULL,
  action      VARCHAR(60)     NOT NULL,       -- e.g. login, password_change, account_delete
  entity_type VARCHAR(60)     NULL,           -- e.g. transaction, budget
  entity_id   VARCHAR(64)     NULL,
  ip_address  VARCHAR(45)     NULL,
  user_agent  VARCHAR(255)    NULL,
  details     JSON            NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_user (user_id, created_at),
  KEY idx_audit_action (action, created_at),
  KEY idx_audit_entity (entity_type, entity_id),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- System settings (admin-managed key/value)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key   VARCHAR(64)  NOT NULL,
  setting_value TEXT         NOT NULL,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
