CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  team_id VARCHAR(255) NOT NULL,
  groups_json JSON NULL,
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent VARCHAR(512) NULL,
  source_ip VARCHAR(64) NULL,
  INDEX idx_auth_sessions_user_id (user_id),
  INDEX idx_auth_sessions_team_id (team_id),
  INDEX idx_auth_sessions_expires_at (expires_at)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  audit_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NULL,
  user_id VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  team_id VARCHAR(255) NULL,
  method VARCHAR(16) NOT NULL,
  path VARCHAR(512) NOT NULL,
  model_alias VARCHAR(255) NULL,
  provider_hint VARCHAR(255) NULL,
  status_code INT NULL,
  request_body_json JSON NULL,
  response_error TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_logs_audit_id (audit_id),
  INDEX idx_audit_logs_user_id (user_id),
  INDEX idx_audit_logs_team_id (team_id),
  INDEX idx_audit_logs_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS model_catalog (
  model_alias VARCHAR(255) PRIMARY KEY,
  provider_name VARCHAR(64) NOT NULL,
  backend_model_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS provider_config (
  provider_name VARCHAR(64) PRIMARY KEY,
  api_base VARCHAR(512) NULL,
  config_json JSON NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO model_catalog (model_alias, provider_name, backend_model_id, display_name, enabled)
VALUES
  ('default-fast', 'openai', 'gpt-4o-mini', 'OpenAI Fast Default', TRUE),
  ('default-smart', 'openai', 'gpt-4.1', 'OpenAI Smart Default', TRUE),
  ('oss-local', 'ollama', 'llama3.1', 'Ollama Local Default', TRUE),
  ('bedrock-sonnet', 'bedrock', 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0', 'Bedrock Sonnet', TRUE)
ON DUPLICATE KEY UPDATE
  provider_name = VALUES(provider_name),
  backend_model_id = VALUES(backend_model_id),
  display_name = VALUES(display_name),
  enabled = VALUES(enabled);
