ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS line_access_token TEXT;
ALTER TABLE tenant_payment_configs ADD COLUMN IF NOT EXISTS app_id TEXT;
ALTER TABLE tenant_payment_configs ADD COLUMN IF NOT EXISTS app_key TEXT;
