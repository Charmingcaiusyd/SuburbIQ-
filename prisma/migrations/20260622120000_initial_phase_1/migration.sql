CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('customer', 'admin', 'super_admin');
CREATE TYPE report_job_status AS ENUM ('queued', 'processing', 'llm_generation_started', 'llm_retry_1', 'llm_retry_2', 'llm_retry_3', 'fallback_template_used', 'rendering_html', 'rendering_pdf', 'completed', 'failed', 'refund_started', 'credit_released', 'quota_restored');
CREATE TYPE credit_status AS ENUM ('available', 'held', 'captured', 'released', 'expired', 'admin_adjusted');
CREATE TYPE order_status AS ENUM ('pending_payment', 'paid', 'report_generating', 'completed', 'failed', 'refunded', 'partially_refunded', 'manual_review_required');
CREATE TYPE payment_status AS ENUM ('payment_pending', 'webhook_retrying', 'payment_confirmed', 'payment_failed', 'manual_review_required', 'refunded', 'partially_refunded');
CREATE TYPE subscription_status AS ENUM ('active', 'renewal_disabled', 'expired', 'payment_failed', 'admin_extended');
CREATE TYPE data_release_status AS ENUM ('draft', 'uploaded', 'validated', 'change_report_generated', 'awaiting_confirmation', 'published', 'rollback_in_progress', 'rolled_back', 'failed');
CREATE TYPE support_ticket_status AS ENUM ('open', 'waiting_admin', 'waiting_user', 'escalated', 'resolved', 'closed');
CREATE TYPE inbox_message_type AS ENUM ('report_completed', 'report_failed', 'refund_processed', 'credit_returned', 'admin_reply', 'subscription_update', 'monthly_market_update', 'system_announcement');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'customer',
  status TEXT NOT NULL DEFAULT 'active',
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  budget_range TEXT NOT NULL,
  buying_purpose TEXT NOT NULL,
  property_type_preference TEXT NOT NULL,
  risk_preference TEXT NOT NULL,
  growth_preference TEXT,
  liquidity_preference TEXT,
  commute_requirements_json JSONB,
  lifestyle_priorities_json JSONB,
  preferred_geographies_json JSONB,
  school_family_needs_json JSONB,
  rental_yield_importance TEXT,
  future_development_tolerance TEXT,
  free_text_notes TEXT,
  language_2 TEXT,
  language_3 TEXT,
  completeness_score INTEGER NOT NULL DEFAULT 0,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX one_active_profile_per_user ON user_profiles(user_id) WHERE active_flag = true AND deleted_at IS NULL;
CREATE INDEX user_profiles_user_id_active_flag_idx ON user_profiles(user_id, active_flag);

CREATE TABLE profile_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  source_profile_id UUID NOT NULL REFERENCES user_profiles(id),
  snapshot_json JSONB NOT NULL,
  completeness_score INTEGER NOT NULL,
  confidence_band TEXT NOT NULL,
  questionnaire_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX profile_snapshots_user_id_created_at_idx ON profile_snapshots(user_id, created_at);

CREATE TABLE profile_question_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  schema_json JSONB NOT NULL,
  scoring_weights_json JSONB NOT NULL,
  active_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_active_profile_question_version ON profile_question_versions(active_flag) WHERE active_flag = true;

CREATE TABLE suburbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sal_code TEXT NOT NULL,
  sal_name TEXT NOT NULL,
  sa2_code TEXT,
  lga_code TEXT,
  gccsa_code TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sal_code, city, state)
);

CREATE INDEX suburbs_sal_name_idx ON suburbs(sal_name);

CREATE TABLE postcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postcode TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX postcodes_postcode_city_state_idx ON postcodes(postcode, city, state);

CREATE TABLE suburb_postcode_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suburb_id UUID NOT NULL REFERENCES suburbs(id),
  postcode_id UUID NOT NULL REFERENCES postcodes(id),
  relationship_confidence TEXT NOT NULL,
  selectable_flag BOOLEAN NOT NULL DEFAULT false,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (suburb_id, postcode_id)
);

CREATE INDEX suburb_postcode_relationships_selectable_flag_idx ON suburb_postcode_relationships(selectable_flag);

CREATE TABLE map_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_key TEXT NOT NULL UNIQUE,
  layer_type TEXT NOT NULL,
  access_tier TEXT NOT NULL,
  release_version TEXT,
  style_json JSONB,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX map_layers_access_tier_active_flag_idx ON map_layers(access_tier, active_flag);

CREATE TABLE higher_geographies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_type TEXT NOT NULL,
  geography_code TEXT NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (geography_type, geography_code, city, state)
);

CREATE TABLE data_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_key TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  status data_release_status NOT NULL DEFAULT 'draft',
  source_summary_json JSONB,
  published_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX data_releases_city_status_idx ON data_releases(city, status);

CREATE TABLE scoring_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_key TEXT NOT NULL UNIQUE,
  data_release_id UUID NOT NULL REFERENCES data_releases(id),
  model_registry_version TEXT NOT NULL,
  scoring_table_version TEXT NOT NULL,
  status data_release_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX scoring_releases_status_published_at_idx ON scoring_releases(status, published_at);

CREATE TABLE suburb_scoring_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scoring_release_id UUID NOT NULL REFERENCES scoring_releases(id),
  suburb_id UUID NOT NULL REFERENCES suburbs(id),
  sal_code TEXT NOT NULL,
  latest_year INTEGER NOT NULL,
  score_json JSONB NOT NULL,
  prediction_json JSONB NOT NULL,
  confidence_json JSONB NOT NULL,
  report_generation_allowed_flag BOOLEAN NOT NULL DEFAULT true,
  report_block_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scoring_release_id, suburb_id)
);

CREATE INDEX suburb_scoring_records_sal_code_idx ON suburb_scoring_records(sal_code);

CREATE TABLE data_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  status data_release_status NOT NULL DEFAULT 'uploaded',
  validation_report_json JSONB,
  change_report_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX data_uploads_uploaded_by_status_idx ON data_uploads(uploaded_by, status);

CREATE TABLE model_registry_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_key TEXT NOT NULL UNIQUE,
  source_path TEXT NOT NULL,
  model_count INTEGER NOT NULL,
  active_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  gst_inclusive_flag BOOLEAN NOT NULL DEFAULT true,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX products_product_type_active_flag_idx ON products(product_type, active_flag);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  product_id UUID NOT NULL REFERENCES products(id),
  status order_status NOT NULL DEFAULT 'pending_payment',
  selected_suburb_id UUID REFERENCES suburbs(id),
  selected_postcode_id UUID REFERENCES postcodes(id),
  amount_cents INTEGER NOT NULL,
  gst_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AUD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX orders_user_id_status_idx ON orders(user_id, status);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  user_id UUID NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  provider_payment_id TEXT,
  status payment_status NOT NULL DEFAULT 'payment_pending',
  raw_event_json JSONB,
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payments_order_id_status_idx ON payments(order_id, status);
CREATE INDEX payments_provider_provider_payment_id_idx ON payments(provider, provider_payment_id);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  invoice_number TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  abn TEXT,
  amount_cents INTEGER NOT NULL,
  gst_cents INTEGER NOT NULL,
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  product_id UUID NOT NULL REFERENCES products(id),
  status subscription_status NOT NULL DEFAULT 'active',
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  reports_used INTEGER NOT NULL DEFAULT 0,
  reports_limit INTEGER NOT NULL DEFAULT 30,
  next_reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX subscriptions_user_id_status_idx ON subscriptions(user_id, status);

CREATE TABLE report_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  order_id UUID REFERENCES orders(id),
  suburb_id UUID NOT NULL REFERENCES suburbs(id),
  postcode_id UUID REFERENCES postcodes(id),
  status report_job_status NOT NULL DEFAULT 'queued',
  entitlement_type TEXT NOT NULL,
  profile_snapshot_id UUID NOT NULL REFERENCES profile_snapshots(id),
  scoring_release_id UUID NOT NULL REFERENCES scoring_releases(id),
  data_release_id UUID NOT NULL REFERENCES data_releases(id),
  report_template_version TEXT NOT NULL,
  llm_template_version TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  fallback_used_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX report_jobs_user_id_status_idx ON report_jobs(user_id, status);
CREATE INDEX report_jobs_status_created_at_idx ON report_jobs(status, created_at);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_job_id UUID NOT NULL REFERENCES report_jobs(id),
  user_id UUID NOT NULL REFERENCES users(id),
  suburb_id UUID NOT NULL REFERENCES suburbs(id),
  status TEXT NOT NULL DEFAULT 'completed',
  title TEXT NOT NULL,
  generated_at TIMESTAMPTZ,
  data_version_refs_json JSONB NOT NULL,
  prediction_snapshot_json JSONB NOT NULL,
  profile_snapshot_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reports_user_id_status_idx ON reports(user_id, status);

CREATE TABLE report_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  source_order_id UUID REFERENCES orders(id),
  status credit_status NOT NULL DEFAULT 'available',
  held_by_report_job_id UUID REFERENCES report_jobs(id),
  captured_by_report_id UUID REFERENCES reports(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX report_credits_user_id_status_idx ON report_credits(user_id, status);

CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL,
  value INTEGER NOT NULL,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  usage_limit INTEGER,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE report_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id),
  file_type TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  watermark_applied_flag BOOLEAN NOT NULL DEFAULT false,
  checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX report_files_report_id_file_type_idx ON report_files(report_id, file_type);

CREATE TABLE report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  version TEXT NOT NULL,
  template_json JSONB NOT NULL,
  active_flag BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_key, version)
);

CREATE TABLE llm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  version TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  context_schema_json JSONB NOT NULL,
  validation_schema_json JSONB NOT NULL,
  active_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_key, version)
);

CREATE TABLE llm_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_job_id UUID NOT NULL REFERENCES report_jobs(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  validation_status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX llm_generation_logs_report_job_id_attempt_number_idx ON llm_generation_logs(report_job_id, attempt_number);

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  admin_role user_role NOT NULL,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_admin_role_check CHECK (admin_role IN ('admin', 'super_admin'))
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  actor_role user_role NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  before_json JSONB,
  after_json JSONB,
  reason TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_actor_user_id_created_at_idx ON audit_logs(actor_user_id, created_at);
CREATE INDEX audit_logs_target_type_target_id_idx ON audit_logs(target_type, target_id);

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  related_report_id UUID REFERENCES reports(id),
  category TEXT NOT NULL,
  status support_ticket_status NOT NULL DEFAULT 'open',
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  assigned_admin_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX support_tickets_status_category_idx ON support_tickets(status, category);

CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id),
  sender_user_id UUID NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX support_messages_ticket_id_created_at_idx ON support_messages(ticket_id, created_at);

CREATE TABLE inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  message_type inbox_message_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  related_object_type TEXT,
  related_object_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX inbox_messages_user_id_read_at_idx ON inbox_messages(user_id, read_at);

CREATE TABLE monthly_market_update_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  enabled_flag BOOLEAN NOT NULL DEFAULT false,
  selected_suburbs_json JSONB,
  delivery_channel TEXT NOT NULL DEFAULT 'inbox',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
