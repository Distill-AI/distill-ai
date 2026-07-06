# Distill.ai — PRD

## Overview

Distill.ai is an intelligent orchestration agent that solves the "unstructured data bottleneck" at
the top of the B2B sales funnel. Today, estimators and sales engineers spend hours acting as manual
data parsers — translating messy inbound requests (vague emails, poorly formatted spreadsheets,
heavily annotated PDF spec sheets) into structured, margin-safe quotes.

For the V1 MVP (hackathon launch), this is a focused open-source release. Rather than a monolithic
enterprise CRM, it targets the core technical innovation: the AI-driven ingestion engine, the
semantic catalog-mapping logic, and the Human-in-the-Loop (HITL) approval UI. This prioritization
maximises the Technical Depth and AI Creativity judging criteria, delivers a compelling visual demo
of unstructured-to-structured transformation, and remains achievable within a hackathon timeframe.

The MVP converts inbound email and form requests into a structured quote draft with clear human
checkpoints, demonstrating depth in document parsing, extraction, normalisation, confidence scoring,
and rules-based quote generation.

## Problem statement

B2B manufacturers, distributors, agencies, consultancies, and custom-plan SaaS businesses lose
revenue because inbound requests arrive unstructured and must be manually interpreted before pricing
tools can be used. Existing CPQ and quote-management tools optimise structured downstream pricing;
the upstream step of turning an email, spreadsheet, or PDF into a quotable specification remains
largely manual.

The revenue impact is material. Harvard Business Review reported that firms contacting leads within
one hour were nearly seven times more likely to qualify them than those waiting longer, and more
than sixty times more likely than those waiting 24 hours or longer. Quoting benchmarks consistently
position turnaround speed as a strong win-rate lever.

## Product goal

Reduce time-to-first-substantive-response and time-to-quote by transforming inbound requests into a
validated draft quote in minutes, with humans reviewing only low-confidence, high-value, or
policy-risk cases.

## In scope — V1 MVP

- **Ingestion (simulated inbox + document upload):** React-based simulated email client for the
  shared sales inbox; accepts seeded emails, uploaded files, and website lead form submissions;
  drag-and-drop for `.pdf`/`.txt`/`.csv`; produces a normalised `Request` record; basic OCR text
  extraction for PDF parsing ahead of the LLM layer.
- **AI parsing & extraction engine:** parses email body and attachment text into structured fields
  for two request types (`catalog_rfq`, `service_quote`); extracts line items, quantities, units,
  timelines, and notes; produces field-level and request-level confidence scores; shows extraction
  rationale in the review UI; strict JSON / structured-output mode for entity extraction.
- **Semantic catalog mapping:** pgvector store loaded with a mocked catalog of 50–100 industrial
  SKUs and service packages, embeddings held in the `skus.embedding` column; fuzzy and semantic
  matching connecting raw customer text to official catalog SKUs.
- **Qualification rules:** enforce supported geography, minimum deal size, supported category, and
  required fields; mark requests as `priced`, `needs_clarification`, or `declined`; generate a
  suggested clarification email or decline message.
- **Pricing engine:** catalog mode maps extracted line items to SKUs (exact, fuzzy, semantic);
  service mode maps extracted scope to package/rate-card rules; applies discount and margin rails;
  outputs a quote draft with line items, subtotal, discount, total, assumptions, and lead time.
- **HITL dashboard:** side-by-side original request / AI-generated structured quote; visual
  confidence scoring (green ≥95% auto-approve safe, yellow 70–94% flagged for review, red <70% hard
  stop); review queue for low-confidence or policy-risk requests; approve/edit/reject or
  request-clarification workflow with dynamic quote update.
- **Quote output & audit trail:** ready-to-send quote summary in the UI; draft follow-up email text;
  stored decision events (`parsed`, `qualified`, `priced`, `approved`, `sent-ready`).
- **Documentation & demo readiness:** public repository with setup instructions, seeded demo data,
  architecture diagram, and open-source license.

## Out of scope — backlog

**Pushed to V2:**

- Active CRM/ERP integrations (Salesforce, HubSpot, SAP, NetSuite) — local mock databases only for
  V1.
- Complex CPQ dependency rules (e.g. bundled compatibility constraints).
- Multi-channel API ingestion: WhatsApp, Intercom, voice/Twilio transcription.
- Multi-agent orchestration beyond the three AI-touched nodes (`extract`, `classify`, `match`) plus
  the bolt-on advisory copilot: a distributed/durable graph orchestrator running as its own service
  (V1 ships an in-process graph engine with node-level resumability, not this), a separately
  deployed agent-runtime process, and sandboxed Code-Act execution. The production-grade agentic
  architecture for these is fully designed (see [ARCHITECTURE_V2.md](ARCHITECTURE_V2.md)) but is
  intentionally not built for V1 — see that doc's §5 "Agentic Pattern in V1 (and the Production
  Target)" for the boundary.

**Pushed to V3:**

- Enterprise RBAC and full multi-tenant architecture. Production authentication is no longer
  deferred: an `AuthModule` (`AuthGuard`, `AuthService`, JWT strategy) with RLS context middleware
  shipped in V1.

## North Star

Median time from inbound received → human-approved quote ready to send.

One number that captures the whole thesis. The two metrics that matter most are zero-edit approval
rate (quality) and auto-eligible false-negative rate (trust). Those two decide whether auto-send is
ever safe to enable.

## Telemetry to instrument

| Category | Metric | What it proves |
| --- | --- | --- |
| Speed | End-to-end pipeline time + per-stage latency (normalise / match / price / score) | The "minutes not days" claim |
| Speed | Time-to-approve: human minutes in review | The human burden shrank |
| Quality | % quotes approved with zero edits | The agent was right, not just fast |
| Quality | Edits per quote by type: SKU re-map / price / qty | Where the model is weak |
| Quality | Match keep-rate: % auto-matched lines human left unchanged | Matcher precision |
| Quality | Margin-floor breaches caught | Policy guardrail works |
| Routing trust | Auto-eligible false-negative rate: % auto-eligible quotes a human still edited | The dangerous one — auto-send risk |
| Routing trust | Over-flag rate: % needs-review flags the human did not change | Over-flagging annoyance cost |
| Adoption | Quotes / user / week; W1 / W2 / W4 retention curve | They keep coming back |
| Adoption | Funnel: ingested → draft → approved → sent | Where users drop |
| Adoption | Action counts: PDF generate, CSV export, re-map clicks | Which features earn their place |
| Outcome (longer horizon) | Time-to-first-response; full turnaround; win-rate by turnaround bucket | Ties to the money |

## Judge-facing differentiators

| Differentiator | Why it matters |
| --- | --- |
| Working V1 pipeline with crash recovery | A request survives a worker crash mid-run and resumes from its last checkpointed node — not a demo-only happy path |
| Hybrid pgvector + trigram catalog match | Semantic and lexical matching fused (RRF), not a single naive similarity search |
| Real, running tool registry (7 tools) | Every LLM call in the pipeline is validated in, validated out, and logged — auditable by design, not by convention |
| Shipped ReAct-pattern advisory agent (not just a diagram) | A working Think→Act→Observe loop answering free-text questions, scoped to existing tools, gated by a feature flag |
| Named, credible V2 distributed target | The production direction is specified precisely enough to build toward, not a vague "and then it scales" aside |

Full architecture: [ARCHITECTURE_V2.md](ARCHITECTURE_V2.md)
