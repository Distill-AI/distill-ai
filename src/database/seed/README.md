# Seed corpus

15 JSON fixtures used by two consumers:

1. **Demo mode replay** - `LlmClientService.loadFixtures()` scans this directory when `DEMO_MODE=true` and the circuit breaker is open, returning a matching fixture in place of a live LLM response.
2. **M2 integration test harness** - the test runner submits each `inbound_message` through the pipeline and compares the actual outcome against `expected_outcome`.

Each file is a single JSON object with four top-level keys: `_meta` (fixture contract), `inbound_message`, `extracted_fields`, and `expected_outcome`.

> **Note for M2 harness authors:** fixtures `rfq_01_catalog_clean` and `rfq_05_catalog_large_order` assert `expected_routing: auto_eligible` / `expected_status: priced`. US-E2-3 (PR #36, not yet on dev) intentionally routes all valid extractions to `needs_review` until E5 confidence routing lands. Demo replay is unaffected (fixtures drive LLM output), but end-to-end status/routing assertions against a dev+E2-3 worker will diverge on these two fixtures until E5 merges.

## Loading the seed data

Run `pnpm migration:run` — the catalog and pricing rules are delivered as TypeScript
migrations (`SeedSkuCatalog`, `SeedPricingRules`) and apply automatically after the
schema migrations. They are idempotent: running `migration:run` a second time is a no-op.

## Routing thresholds

Three env vars control match and auto-routing behaviour:

| Variable | Default | Effect |
| --- | --- | --- |
| `MATCH_THRESHOLD` | `0.70` | Minimum fused score for a candidate match to be kept |
| `AUTO_THRESHOLD` | `0.95` | Overall confidence above which the quote auto-routes (skips HITL) |
| `AUTO_SEND_CAP_MINOR` | unset | Max line-item amount eligible for auto-send (unset = no cap) |

These are read at boot via `src/config/env.ts`; no DB table is needed.

## Corpus

| sample_id | request_type | expected_status | behaviour |
| --- | --- | --- | --- |
| rfq_01_catalog_clean | catalog_rfq | priced | Happy path: all fields present, all SKUs matched, auto-eligible routing |
| rfq_02_catalog_needs_review | catalog_rfq | needs_review | Close-tie match on line 1 + margin-floor policy breach, both independently trigger needs_review |
| rfq_03_catalog_malformed | catalog_rfq | needs_review | LLM returns string for line_items; both re-asks fail; fail-closed escalation (US-E2-3) |
| rfq_04_catalog_missing_fields | catalog_rfq | needs_clarification | delivery_date null + quantity null on line 2; classify detects gaps |
| rfq_05_catalog_large_order | catalog_rfq | priced | High-volume restock (5000+ units); auto-eligible path |
| rfq_06_catalog_upload_channel | catalog_rfq | priced | PDF upload channel; no from_name/from_email/subject; two SKUs matched |
| rfq_07_catalog_no_match | catalog_rfq | needs_review | Bespoke stainless items with non-standard thread; no SKU match on any line |
| rfq_08_catalog_multi_line | catalog_rfq | priced | 7 line items across M8 and M10 ranges; all matched; tests extraction faithfulness on long lists |
| rfq_09_catalog_second_missing_fields | catalog_rfq | needs_clarification | Three simultaneous gaps: delivery_date null, sender_company null, line 2 quantity null |
| rfq_10_catalog_partial_extraction | catalog_rfq | needs_review | Lines 1-2 extracted and matched cleanly; line 3 raw_text garbled from corrupt PDF field |
| sq_01_service_clean | service_quote | needs_review | Service quote happy path: all fields present, no catalog SKUs, routed to human review |
| sq_02_service_missing_fields | service_quote | needs_clarification | delivery_date null, all quantities null; classify routes to clarification |
| sq_03_service_multi_scope | service_quote | needs_review | 4 distinct service lines (maintenance, inspection, parts, emergency); all fields present |
| sq_04_service_labour_rates | service_quote | needs_review | Time-and-materials quote; day rates for 2 electricians + 1 PM; quantities in days |
| sq_05_service_upload | service_quote | needs_review | Service brief submitted as PDF upload; two service lines; clean extraction |

## RFQ line-item coverage (AC-03 / EC-01)

Maps every seed-RFQ line item to its expected matching SKU(s).

| Fixture | Line item description | Expected SKU | Notes |
| --- | --- | --- | --- |
| rfq_01 | M8 Hex Bolt, ZP, 8.8 | SKU-101 | clean match |
| rfq_01 | M8 Hex Nut, ZP | SKU-102 | clean match |
| rfq_01 | M10 Hex Bolt, ZP, 8.8 | SKU-111 | clean match |
| rfq_01 | M10 Hex Nut, ZP | SKU-112 | clean match |
| rfq_02 | M12 Stainless Bolt A2-70 | SKU-201 / SKU-202 | intentional close-tie (review trigger) |
| rfq_03 | (malformed scan) | n/a | intentional unreadable - UNKNOWN |
| rfq_04 | M8 Hex Bolt, ZP | SKU-101 | missing qty field |
| rfq_05 | M8 Hex Bolt, ZP, 8.8 | SKU-101 | large order |
| rfq_05 | M8 Hex Nut, ZP | SKU-102 | large order |
| rfq_05 | M8 Flat Washer, ZP | SKU-103 | large order |
| rfq_06 | M8 Hex Bolt, ZP, 8.8 | SKU-101 | upload channel |
| rfq_06 | M10 Hex Bolt, ZP, 8.8 | SKU-111 | upload channel |
| rfq_07 | Self-Healing Bio-Polymer Coupling | none | intentional NO_MATCH |
| rfq_08 | M8 Hex Bolt, ZP, Grade 8.8 | SKU-101 | multi-line |
| rfq_08 | M8 Spring Washer, ZP | SKU-104 | multi-line |
| rfq_08 | M10 Flat Washer, ZP | SKU-113 | multi-line |
| rfq_09 | M10 Hex Bolt, ZP | SKU-111 | missing delivery date |
| rfq_10 | M8 Hex Bolt, ZP, Grade 8.8 | SKU-101 | corrupt PDF |
| rfq_10 | M8 Hex Nut, ZP | SKU-102 | corrupt PDF |
| rfq_10 | ???? | none | intentional EC-01 - unreadable |
| sq_01 | Annual HVAC maintenance | none | service quote - no catalog match by design |
| sq_02 | CCTV installation | none | service quote |
| sq_03 | Electrical rewiring | none | service quote |
| sq_04 | Labour for installation | none | service quote |
| sq_05 | Boiler servicing | none | service quote |

## Notes

- `pnpm seed:embeddings` must NOT run in CI. It requires a live `EMBEDDINGS_API_KEY` and
  time proportional to SKU count. Run it manually once after `pnpm migration:run` when the
  embedding API is available.
- To re-populate all embeddings: `UPDATE skus SET embedding = NULL` then re-run the script.
