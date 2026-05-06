-- AI usage logs: rate limiting + observability for beta
CREATE TABLE ai_usage_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT        NOT NULL, -- 'recipe_generation' | 'photo_import' | 'pdf_import' | 'text_import'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast per-user/action/date lookups (rate limit check)
CREATE INDEX ai_usage_logs_user_action_ts
  ON ai_usage_logs (user_id, action_type, created_at DESC);

-- RLS
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_insert_own_logs" ON ai_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_read_own_logs" ON ai_usage_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
