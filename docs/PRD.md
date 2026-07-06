# Distill.ai — PRD stub

This is a minimal stub, not a full product-requirements rewrite — no PRD existed in this repo
before this doc. It exists to satisfy the ask for a differentiators section a reader can find from
both the README and here; the technical detail lives in [ARCHITECTURE_V2.md](ARCHITECTURE_V2.md).

## Judge-Facing Differentiators

| Differentiator | Why it matters |
| --- | --- |
| Working V1 pipeline with crash recovery | A request survives a worker crash mid-run and resumes from its last checkpointed node — not a demo-only happy path |
| Hybrid pgvector + trigram catalog match | Semantic and lexical matching fused (RRF), not a single naive similarity search |
| Real, running tool registry (7 tools) | Every LLM call in the pipeline is validated in, validated out, and logged — auditable by design, not by convention |
| Shipped ReAct-pattern advisory agent (not just a diagram) | A working Think→Act→Observe loop answering free-text questions, scoped to existing tools, gated by a feature flag |
| Named, credible V2 distributed target | The production direction is specified precisely enough to build toward, not a vague "and then it scales" aside |

Full architecture: [ARCHITECTURE_V2.md](ARCHITECTURE_V2.md)
