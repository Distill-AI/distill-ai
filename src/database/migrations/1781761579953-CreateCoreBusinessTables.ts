import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreBusinessTables1781761579953 implements MigrationInterface {
  name = 'CreateCoreBusinessTables1781761579953';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "vector"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" text NOT NULL, CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('estimator', 'approver', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "org_id" uuid NOT NULL, "email" citext NOT NULL, "name" text NOT NULL, "role" "public"."user_role" NOT NULL DEFAULT 'estimator', CONSTRAINT "users_org_email_unique" UNIQUE ("org_id", "email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."request_channel" AS ENUM('email', 'upload', 'form')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."request_type" AS ENUM('catalog_rfq', 'service_quote', 'unknown')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."request_status" AS ENUM('received', 'parsing', 'needs_review', 'priced', 'ready', 'sent', 'declined', 'needs_clarification', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."current_node" AS ENUM('parse', 'extract', 'classify', 'match', 'price', 'policy', 'score', 'done', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."request_routing" AS ENUM('auto_eligible', 'needs_review')`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "org_id" uuid NOT NULL, "channel" "public"."request_channel" NOT NULL, "source_subject" text, "source_body" text, "sender_company" text, "sender_contact" text, "sender_email" citext, "request_type" "public"."request_type" NOT NULL DEFAULT 'unknown', "status" "public"."request_status" NOT NULL DEFAULT 'received', "current_node" "public"."current_node" NOT NULL DEFAULT 'parse', "processing_started_at" TIMESTAMP WITH TIME ZONE, "overall_confidence" numeric(4,3), "routing" "public"."request_routing", "routing_reasons" jsonb NOT NULL DEFAULT '[]', "delivery_date" date, CONSTRAINT "PK_0428f484e96f9e6a55955f29b5f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tool_name" AS ENUM('extract_request', 'search_catalog', 'render_quote_pdf', 'explain_routing')`,
    );
    await queryRunner.query(`CREATE TYPE "public"."tool_call_status" AS ENUM('ok', 'error')`);
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "tool_calls" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "request_id" uuid NOT NULL, "tool_name" "public"."tool_name" NOT NULL, "args" jsonb NOT NULL, "status" "public"."tool_call_status" NOT NULL, "latency_ms" integer, "error_detail" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_08984f8a6bc13859241462df855" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "tool_calls_request_idx" ON "tool_calls" ("request_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "request_id" uuid NOT NULL, "filename" text NOT NULL, "mime_type" text NOT NULL, "size_bytes" integer NOT NULL, "storage_url" text NOT NULL, "parsed_text" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5e1f050bcff31e3084a1d662412" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quote_status" AS ENUM('draft', 'approved', 'ready', 'sent')`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "quotes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "org_id" uuid NOT NULL, "request_id" uuid NOT NULL, "quote_number" text NOT NULL, "status" "public"."quote_status" NOT NULL DEFAULT 'draft', "subtotal_minor" integer NOT NULL, "discount_minor" integer NOT NULL DEFAULT '0', "total_minor" integer NOT NULL, "currency" text NOT NULL DEFAULT 'GBP', "terms" text, "lead_time_days" smallint, "valid_until" date, "created_by" uuid, "approved_by" uuid, CONSTRAINT "quotes_org_quote_number_unique" UNIQUE ("org_id", "quote_number"), CONSTRAINT "PK_99a0e8bcbcd8719d3a41f23c263" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pricing_rule_type" AS ENUM('margin_floor', 'max_discount', 'qty_break', 'lead_time')`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "pricing_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "org_id" uuid NOT NULL, "rule_type" "public"."pricing_rule_type" NOT NULL, "config" jsonb NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_fda27bb8db4630894decda61ff6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" character varying NOT NULL, "payload" jsonb NOT NULL, "priority" integer NOT NULL DEFAULT '2', "status" character varying NOT NULL DEFAULT 'pending', "retry_count" integer NOT NULL DEFAULT '0', "max_retries" integer NOT NULL DEFAULT '3', "error_message" text, "scheduled_at" TIMESTAMP WITH TIME ZONE, "recurring_interval" character varying, "next_run_at" TIMESTAMP WITH TIME ZONE, "started_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "depends_on" text, "priority_score" double precision NOT NULL DEFAULT '0', "lease_expires_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_cf0a6c42b72fcc7f7c237def345" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "extractions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "request_id" uuid NOT NULL, "model" text NOT NULL, "schema_valid" boolean NOT NULL, "raw_json" jsonb NOT NULL, "reextract_count" smallint NOT NULL DEFAULT '0', "loop_steps" jsonb NOT NULL DEFAULT '[]', "latency_ms" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ea1710c1574aafdd8d882754204" UNIQUE ("request_id"), CONSTRAINT "PK_21a6575e18d03d32ca61c4615f3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "skus" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "org_id" uuid NOT NULL, "sku_code" text NOT NULL, "name" text NOT NULL, "description" text, "attributes" jsonb NOT NULL DEFAULT '{}', "base_price_minor" integer NOT NULL, "currency" text NOT NULL DEFAULT 'GBP', "lead_time_days" smallint, "embedding" vector(384), CONSTRAINT "skus_org_sku_code_unique" UNIQUE ("org_id", "sku_code"), CONSTRAINT "PK_334d59b0b01e5f2193966266e27" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "quote_line_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quote_id" uuid NOT NULL, "sku_id" uuid, "description" text NOT NULL, "quantity" numeric(12,2) NOT NULL, "unit_price_minor" integer NOT NULL, "amount_minor" integer NOT NULL, "position" smallint NOT NULL, CONSTRAINT "PK_cf621b9092037d36e5c7e13a668" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "audit_events" ("id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL, "org_id" uuid NOT NULL, "request_id" uuid, "quote_id" uuid, "user_id" uuid, "event_name" text NOT NULL, "attributes" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_910f64d901a5c3e9878f0d4a407" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "dlq_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "original_job_id" uuid NOT NULL, "type" character varying NOT NULL, "payload" jsonb NOT NULL, "priority" integer NOT NULL, "error_message" text NOT NULL, "retry_count" integer NOT NULL DEFAULT '3', "last_attempted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_b66854fe15c059508260c5100ca" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "clarifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "request_id" uuid NOT NULL, "gaps" jsonb NOT NULL, "draft_subject" text, "draft_body" text, "sent_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_13bbcd97792a5c1663fcd28136f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."match_method" AS ENUM('exact', 'fuzzy', 'semantic', 'fused')`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "line_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "request_id" uuid NOT NULL, "position" smallint NOT NULL, "raw_text" text NOT NULL, "quantity" numeric(12,2), "unit" text, "matched_sku_id" uuid, "match_confidence" numeric(4,3), "match_method" "public"."match_method", "unit_price_minor" integer, "lead_time_days" smallint, "flags" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6d227c876e374542dc9bb44dfb4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "candidate_matches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "line_item_id" uuid NOT NULL, "sku_id" uuid NOT NULL, "score" numeric(4,3) NOT NULL, "rank" smallint NOT NULL, CONSTRAINT "candidate_matches_line_item_sku_unique" UNIQUE ("line_item_id", "sku_id"), CONSTRAINT "PK_55b0b0cee1b1585611d2d5d1f54" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_0a13270cd3101fd16b8000e00d4" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" ADD CONSTRAINT "FK_f8e1fa4148511ae5a89a0a0f33d" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tool_calls" ADD CONSTRAINT "FK_1dbd228ff9c2eaa913f7188e2ff" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ADD CONSTRAINT "FK_dcbe694cf3a439b06e0c7b6a73c" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD CONSTRAINT "FK_2b3fffeb95e875497fa4dcb0480" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD CONSTRAINT "FK_0c53b33e44ecbc5e82486c076a8" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD CONSTRAINT "FK_7597d56df256df54e6fda6cd646" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD CONSTRAINT "FK_c49dab53d01434d323ee9a207bd" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rules" ADD CONSTRAINT "FK_08e0cec076a50f05b8ce8852d27" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "extractions" ADD CONSTRAINT "FK_ea1710c1574aafdd8d882754204" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "skus" ADD CONSTRAINT "FK_d6ed239848968fae7200966f4da" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quote_line_items" ADD CONSTRAINT "FK_5d17fe21be606eb310e3a5668d4" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quote_line_items" ADD CONSTRAINT "FK_afbaddbd135b078076f870c5dc6" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "FK_3c324fd6ad96b32d2be8bc4a3bc" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "FK_e63c8a1835d26f871f4195c3243" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "FK_6b55fa9432fdde66709f8cf3c43" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "FK_e1c246079d669576b847df55d90" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "clarifications" ADD CONSTRAINT "FK_e08679b8c48fca9d31704cda39e" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "line_items" ADD CONSTRAINT "FK_60f558e7225858bfc15826e4ac1" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "line_items" ADD CONSTRAINT "FK_0fb83ca77d09c917d4390b0fe7f" FOREIGN KEY ("matched_sku_id") REFERENCES "skus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_matches" ADD CONSTRAINT "FK_8f6accbbd7d70a8c96310552fc8" FOREIGN KEY ("line_item_id") REFERENCES "line_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_matches" ADD CONSTRAINT "FK_23ca932dfcaf49fd290ac902dbc" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "candidate_matches" DROP CONSTRAINT "FK_23ca932dfcaf49fd290ac902dbc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_matches" DROP CONSTRAINT "FK_8f6accbbd7d70a8c96310552fc8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "line_items" DROP CONSTRAINT "FK_0fb83ca77d09c917d4390b0fe7f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "line_items" DROP CONSTRAINT "FK_60f558e7225858bfc15826e4ac1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clarifications" DROP CONSTRAINT "FK_e08679b8c48fca9d31704cda39e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "FK_e1c246079d669576b847df55d90"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "FK_6b55fa9432fdde66709f8cf3c43"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "FK_e63c8a1835d26f871f4195c3243"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "FK_3c324fd6ad96b32d2be8bc4a3bc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quote_line_items" DROP CONSTRAINT "FK_afbaddbd135b078076f870c5dc6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quote_line_items" DROP CONSTRAINT "FK_5d17fe21be606eb310e3a5668d4"`,
    );
    await queryRunner.query(`ALTER TABLE "skus" DROP CONSTRAINT "FK_d6ed239848968fae7200966f4da"`);
    await queryRunner.query(
      `ALTER TABLE "extractions" DROP CONSTRAINT "FK_ea1710c1574aafdd8d882754204"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rules" DROP CONSTRAINT "FK_08e0cec076a50f05b8ce8852d27"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP CONSTRAINT "FK_c49dab53d01434d323ee9a207bd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP CONSTRAINT "FK_7597d56df256df54e6fda6cd646"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP CONSTRAINT "FK_0c53b33e44ecbc5e82486c076a8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP CONSTRAINT "FK_2b3fffeb95e875497fa4dcb0480"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" DROP CONSTRAINT "FK_dcbe694cf3a439b06e0c7b6a73c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tool_calls" DROP CONSTRAINT "FK_1dbd228ff9c2eaa913f7188e2ff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requests" DROP CONSTRAINT "FK_f8e1fa4148511ae5a89a0a0f33d"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_0a13270cd3101fd16b8000e00d4"`);
    await queryRunner.query(`DROP TABLE "candidate_matches"`);
    await queryRunner.query(`DROP TABLE "line_items"`);
    await queryRunner.query(`DROP TYPE "public"."match_method"`);
    await queryRunner.query(`DROP TABLE "clarifications"`);
    await queryRunner.query(`DROP TABLE "dlq_jobs"`);
    await queryRunner.query(`DROP TABLE "audit_events"`);
    await queryRunner.query(`DROP TABLE "quote_line_items"`);
    await queryRunner.query(`DROP TABLE "skus"`);
    await queryRunner.query(`DROP TABLE "extractions"`);
    await queryRunner.query(`DROP TABLE "jobs"`);
    await queryRunner.query(`DROP TABLE "pricing_rules"`);
    await queryRunner.query(`DROP TYPE "public"."pricing_rule_type"`);
    await queryRunner.query(`DROP TABLE "quotes"`);
    await queryRunner.query(`DROP TYPE "public"."quote_status"`);
    await queryRunner.query(`DROP TABLE "attachments"`);
    await queryRunner.query(`DROP INDEX "public"."tool_calls_request_idx"`);
    await queryRunner.query(`DROP TABLE "tool_calls"`);
    await queryRunner.query(`DROP TYPE "public"."tool_call_status"`);
    await queryRunner.query(`DROP TYPE "public"."tool_name"`);
    await queryRunner.query(`DROP TABLE "requests"`);
    await queryRunner.query(`DROP TYPE "public"."request_routing"`);
    await queryRunner.query(`DROP TYPE "public"."current_node"`);
    await queryRunner.query(`DROP TYPE "public"."request_status"`);
    await queryRunner.query(`DROP TYPE "public"."request_type"`);
    await queryRunner.query(`DROP TYPE "public"."request_channel"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
  }
}
