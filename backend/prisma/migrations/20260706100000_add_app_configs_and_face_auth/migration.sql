CREATE TABLE "app_configs" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "value_type" TEXT NOT NULL DEFAULT 'json',
  "description" TEXT NOT NULL DEFAULT '',
  "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
  "is_runtime_editable" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "face_credentials" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "credential_id" TEXT NOT NULL,
  "public_key" JSONB NOT NULL,
  "sign_count" INTEGER NOT NULL DEFAULT 0,
  "device_name" TEXT,
  "transports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "face_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_challenges" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "challenge" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "metadata" JSONB,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_configs_key_key" ON "app_configs"("key");
CREATE INDEX "app_configs_category_idx" ON "app_configs"("category");

CREATE UNIQUE INDEX "face_credentials_credential_id_key" ON "face_credentials"("credential_id");
CREATE INDEX "face_credentials_user_id_is_active_idx" ON "face_credentials"("user_id", "is_active");

CREATE UNIQUE INDEX "auth_challenges_challenge_key" ON "auth_challenges"("challenge");
CREATE INDEX "auth_challenges_user_id_type_expires_at_idx" ON "auth_challenges"("user_id", "type", "expires_at");

ALTER TABLE "face_credentials"
  ADD CONSTRAINT "face_credentials_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_challenges"
  ADD CONSTRAINT "auth_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
