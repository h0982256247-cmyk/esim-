ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_admin_id TEXT REFERENCES platform_admins(id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_admin_id ON products(tenant_admin_id);
