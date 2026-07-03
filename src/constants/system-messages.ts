// Generic HTTP
export const HTTP_INTERNAL_SERVER_ERROR = 'An unexpected error occurred. Please try again later.';

// Health
export const HEALTH_OK = 'All systems operational';
export const HEALTH_DEGRADED = 'One or more infrastructure checks failed';

// Benchmark
export const BENCHMARK_COMPLETE = 'Benchmark complete';
export const THROUGHPUT_BENCHMARK_COMPLETE = 'Throughput benchmark complete';
export const HTTP_INTERNAL_SERVER_ERROR_NAME = 'Internal Server Error';
export const VALIDATION_FAILED = 'Validation failed';

// Redis
export const REDIS_CONNECTION_ESTABLISHED = 'Redis connection established';
export const REDIS_CLIENT_READY = 'Redis client ready';
export const REDIS_CONNECTION_CLOSED = 'Redis connection closed';
export const REDIS_CLIENT_ERROR = 'Redis client error';
export const REDIS_CRITICAL_OOM = 'Redis OOM, server is out of memory';
export const REDIS_INITIAL_CONNECTION_FAILED = 'Redis initial connection failed';
export const REDIS_RETRY_LIMIT_REACHED = 'Redis retry limit reached, giving up';
export const REDIS_RECONNECT_ATTEMPT = (times: number, delay: number) =>
  `Redis reconnect attempt ${times}, next retry in ${delay}ms`;
export const REDIS_PATTERN_DELETE_SUCCESS = (count: number, pattern: string) =>
  `Deleted ${count} Redis keys matching pattern "${pattern}"`;

// Jobs
export const JOB_NOT_FOUND = (id: string) => `Job ${id} not found`;
export const JOB_CREATED = 'Job created successfully';
export const JOB_ALREADY_PROCESSING = 'Job is already being processed and cannot be modified';
export const JOB_CANNOT_BE_CANCELLED = (status: string) =>
  `Job with status "${status}" cannot be cancelled`;
export const JOB_DEPENDENCY_NOT_MET = (depId: string) =>
  `Dependency job ${depId} has not completed successfully`;

// DLQ
export const DLQ_JOB_NOT_FOUND = (id: string) => `DLQ job ${id} not found`;
export const DLQ_RETRY_QUEUED = 'Job re-queued from DLQ for retry';
export const DLQ_THRESHOLD_EXCEEDED = (count: number, threshold: number) =>
  `DLQ alert: ${count} jobs have failed (threshold: ${threshold})`;

// Object storage
export const OBJECT_STORE_URL_REQUIRED = 'OBJECT_STORE_URL must resolve to a non-empty path';
export const OBJECT_STORE_UNSUPPORTED_SCHEME = (scheme: string) =>
  `Unsupported OBJECT_STORE_URL scheme "${scheme}"; only file:// is supported`;
export const OBJECT_STORE_KEY_BLANK = 'Object key must not be blank';
export const OBJECT_STORE_KEY_TRAVERSAL = 'Object key escapes store root';

// Pipeline
export const REQUEST_NOT_FOUND = (id: string) => `Request ${id} not found`;
export const ATTACHMENT_NOT_FOUND = (id: string) => `Attachment ${id} not found`;
export const REQUESTS_RETRIEVED = 'Requests retrieved successfully';
export const REQUEST_RETRIEVED = 'Request retrieved successfully';
export const PIPELINE_ENQUEUED = 'Request enqueued for pipeline processing';
export const PIPELINE_RESUMED = 'Request resumed for pipeline processing';

// Parse node
export const PARSE_UNSUPPORTED_TYPE = (ext: string) =>
  `Cannot extract text from unsupported file type "${ext}"`;

// Paste fallback
export const ATTACHMENT_PASTE_ACCEPTED = 'Content accepted; extraction re-queued';
export const ATTACHMENT_PASTE_CONFLICT = 'Request is already being parsed';
export const ATTACHMENT_PASTE_EMPTY = 'Paste content must not be empty';

// Ingestion
export const REQUEST_CREATED = 'Request created and queued for processing';
export const REQUEST_INPUT_REQUIRED =
  'Provide at least one file or pasted text to create a request.';
export const UNSUPPORTED_FILE_TYPE =
  'Unsupported file type. Only PDF, CSV, or TXT files are accepted.';
export const FILE_TOO_LARGE = (maxMb: number) => `File too large. Maximum size is ${maxMb} MB.`;
export const RLS_CONTEXT_MISSING = 'Request tenant context is missing; cannot create the request.';

// Stream / SSE
export const STREAM_SUBSCRIBED = 'SSE stream subscribed';
export const STREAM_UNSUBSCRIBED = 'SSE stream unsubscribed';
export const STREAM_COMPLETE = 'SSE stream complete';
export const STREAM_TIMEOUT = 'SSE stream timed out';
export const SANITIZED_SUMMARY_PLACEHOLDER = 'Processing step completed';
export const REDACTED_FIELD_PLACEHOLDER = '[redacted]';

// Classify

export const CLASSIFY_DEFAULTED_LOW_CONFIDENCE = (confidence: number, threshold: number) =>
  `Classification confidence ${confidence} below threshold ${threshold}; defaulting to service_quote`;
export const CLASSIFY_RETRY_FAILED = 'Classification retry failed; defaulting to service_quote';
export const CLASSIFY_MALFORMED_INPUT =
  'Parsed request missing required fields; defaulting to service_quote';
export const LLM_INVOCATION_FAILED = (status: number, body: string) =>
  `LLM invocation failed (${status}): ${body}`;

// Extraction
export const EXTRACTION_COMPLETE = 'Extraction completed successfully';
export const EXTRACTION_ESCALATED = 'Extraction failed validation after retry; escalated to review';
export const EXTRACTION_SOURCE_TEXT_EMPTY = 'No source text available for extraction';
export const EXTRACTION_TOOL_FAILED = 'extract_request tool invocation failed';
export const EXTRACTION_DEMO_FIXTURE_UNAVAILABLE =
  'DEMO_MODE extraction fixture unavailable (seed corpus not found)';
export const EXTRACTION_RECONCILE_FAILED = (reason: string) =>
  `Extraction reconciliation failed: ${reason}`;
export const EXTRACTION_UPSERT_FAILED = (requestId: string) =>
  `Failed to persist extraction for request ${requestId}`;
export const EXTRACTION_JSON_PARSE_FAILED = (detail: string) =>
  `Failed to parse extraction JSON: ${detail}`;

// Scoring
export const SCORE_ROUTING_APPLIED = (routing: string) => `Routing set to ${routing}`;
export const SCORE_NO_LINE_ITEMS = 'No line items available for scoring; routing to review';
export const SCORE_BELOW_AUTO_THRESHOLD = (lineConfidence: number, threshold: number) =>
  `Line confidence ${lineConfidence} below auto threshold ${threshold}`;
export const SCORE_AUTO_ELIGIBLE = (confidence: number) =>
  `Overall confidence ${confidence} meets auto-eligible threshold`;
export const SCORE_POLICY_FLAGS_DETECTED = 'Policy flags present on one or more line items';
export const SCORE_DEAL_VALUE_EXCEEDS_CAP = (total: number, cap: number) =>
  `Deal value ${total} exceeds auto-send cap ${cap}`;
export const SCORE_DEAL_VALUE_INCOMPLETE =
  'One or more line items have incomplete pricing; routed to review';
export const SCORE_INVALID_AUTO_THRESHOLD = (value: unknown, retained: number) =>
  `Invalid SCORE_AUTO_THRESHOLD ${JSON.stringify(value)}; retaining last valid value ${retained}`;
export const SCORE_INVALID_AUTO_SEND_CAP = (value: unknown, retained: number | undefined) =>
  `Invalid SCORE_AUTO_SEND_CAP_MINOR ${JSON.stringify(value)}; retaining last valid value ${String(
    retained,
  )}`;

// Auth
export const AUTH_PROFILE_FETCHED = 'Profile fetched successfully';
export const AUTH_LOGIN_SUCCESS = 'Login successful';
export const AUTH_UNAUTHORIZED = 'Unauthorized. Valid token required.';
export const AUTH_FORBIDDEN = 'Forbidden. Insufficient permissions.';
export const AUTH_INVALID_TOKEN = 'Invalid or expired token.';
export const AUTH_INVALID_CREDENTIALS = 'Invalid credentials';
export const AUTH_TOKEN_MISSING_OR_INVALID = 'Missing or invalid token';

// Tool Registry
export const TOOL_NOT_FOUND = (name: string) =>
  `Tool "${name}" is not registered or does not exist`;
export const TOOL_INPUT_VALIDATION_FAILED = 'Input validation failed';
export const TOOL_OUTPUT_VALIDATION_FAILED = 'Output validation failed';
export const TOOL_EXECUTION_TIMEOUT = 'Execution timed out';
export const TOOL_INVOKE_SUCCESS = 'Tool invoked successfully';
export const TOOL_LIST_SUCCESS = 'Tools retrieved successfully';
export const TOOL_ALREADY_REGISTERED = (name: string) => `Tool "${name}" is already registered`;
export const TOOL_NAME_RESERVED = (name: string) =>
  `Tool name "${name}" is reserved and cannot be used`;

// Resume / Crash Recovery
export const RESUME_SUCCESS = 'Request resumed successfully';
export const RESUME_FROM_NODE = (node: string) => `Resuming pipeline from node "${node}"`;

// Pricing
export const PRICING_RULES_RETRIEVED = 'Pricing rules retrieved successfully';
export const PRICING_RULES_RELOADED = 'Pricing rules reloaded successfully';
export const PRICING_EVALUATED = 'Pricing evaluated successfully';
export const PRICING_RULES_INVALID = (detail: string) =>
  `Pricing rules configuration is invalid: ${detail}`;
export const PRICING_RULES_FILE_NOT_FOUND = (path: string) =>
  `Pricing rules file not found at ${path}`;
export const PRICING_CONFIG_VALIDATION_FAILED = 'Pricing rules config validation failed';
export const PRICING_CONFIG_PATH_INVALID = 'Pricing config path is invalid';

// Policy
export const POLICY_RULES_RETRIEVED = 'Policy rules retrieved successfully';
export const POLICY_RULES_RELOADED = 'Policy rules reloaded successfully';
export const POLICY_EVALUATED = 'Policy evaluated successfully';
export const POLICY_RULES_INVALID = (detail: string) =>
  `Policy rules configuration is invalid: ${detail}`;
export const POLICY_RULES_FILE_NOT_FOUND = (path: string) =>
  `Policy rules file not found at ${path}`;
export const POLICY_CONFIG_PATH_INVALID =
  'Policy rules config path is outside the allowed directory';
export const POLICY_CONFIG_VALIDATION_FAILED = 'Config validation failed';
export const POLICY_LINE_ITEMS_EXCEEDS_MAX = (current: number, limit: number) =>
  `Line items ${current} exceed max of ${limit}`;
export const POLICY_CATEGORY_RESTRICTED = (category: string) =>
  `Category "${category}" is restricted`;

// Pricing node
export const PRICE_QUOTE_PRICED = (totalMinor: number) =>
  `Quote priced; total ${totalMinor} (minor units)`;
export const PRICE_NO_MATCHED_LINES = 'No matched line items to price';
export const PRICE_RULES_MISSING =
  'No pricing rules configured for this organization; quote blocked for review';

// Quotes
export const QUOTE_NOT_FOUND = (id: string) => `Quote ${id} not found`;
export const QUOTE_EMAIL_DRAFT_PARSE_FAILED = 'Failed to parse quote email draft from LLM response';
export const QUOTE_REQUEST_NOT_APPROVABLE = (status: string) =>
  `Request with status "${status}" is not approvable for a quote`;
export const QUOTE_NOT_PRICED = (requestId: string) =>
  `Request ${requestId} has no priced quote to approve`;
export const QUOTE_INVALID_TRANSITION = (status: string) =>
  `Quote with status "${status}" cannot be approved`;
export const QUOTE_PDF_GENERATION_FAILED = 'Failed to generate the quote PDF';
export const QUOTE_APPROVED_SUCCESS = 'Quote approved successfully';
export const QUOTE_PDF_NOT_READY = (requestId: string) =>
  `Quote for request ${requestId} has no generated PDF yet`;
export const QUOTE_PDF_RETRIEVAL_FAILED = (requestId: string) =>
  `Failed to retrieve the generated PDF for request ${requestId}`;

// Policy node
export const POLICY_OK = 'No policy breaches';
export const POLICY_BREACH_FLAGGED = (count: number) =>
  `${count} policy breach(es) flagged; routing to review`;
export const POLICY_GATE_REVIEW =
  'Policy breach detected; routed to review regardless of confidence';

// Catalog matching
export const MATCH_COMPLETE = (matched: number, total: number) =>
  `Catalog matching complete: ${matched}/${total} items matched`;
export const MATCH_DEGRADED =
  'Embedding service unavailable; falling back to lexical-only matching';
export const MATCH_SKIPPED_EMPTY = 'Line item skipped: raw text is empty';
export const MATCH_SKIPPED_UNKNOWN = 'Line item skipped: raw text is UNKNOWN';
export const MATCH_CLOSE_TIE_REASON = (top1: number, top2: number) =>
  `Two candidates within margin (scores: ${top1.toFixed(2)}, ${top2.toFixed(2)})`;

// Line items
export const LINE_ITEM_NOT_FOUND = (id: string) => `Line item ${id} not found`;
export const CANDIDATES_RETRIEVED = 'Candidates retrieved successfully';

// Clarification
export const CLARIFICATION_DRAFT_GENERATED = 'Clarification draft generated successfully';
export const CLARIFICATION_DRAFT_UPDATED = 'Clarification draft updated successfully';
export const CLARIFICATION_SENT = 'Clarification sent successfully';
export const CLARIFICATION_RETRIEVED = 'Clarification retrieved successfully';
export const CLARIFICATION_NOT_FOUND = 'Clarification not found';
export const CLARIFICATION_NO_GAPS =
  'At least one gap is required to generate a clarification draft';
export const CLARIFICATION_ALREADY_SENT = 'Clarification has already been sent';
export const CLARIFICATION_SEND_ACTOR_REQUIRED =
  'A valid actor ID is required to send a clarification';
export const CLARIFICATION_DRAFT_PARSE_FAILED =
  'Failed to parse clarification draft from LLM response';
export const CLARIFICATION_DRAFT_EMPTY = 'Cannot send a clarification with empty draft content';

// Catalog search (manual re-map fallback)
export const SKUS_RETRIEVED = 'SKUs retrieved successfully';

// Decline
export const REQUEST_DECLINED = 'Request declined successfully';
export const DECLINE_REASON_REQUIRED = 'Decline reason is required and must not be empty';

// Re-map line item (US-E6-2-BE). Not-found messages are fixed strings (no id echo) so a 404 cannot
// be used to probe whether an id exists in another org (SEC-01, no enumeration).
export const LINE_ITEM_REMAPPED = 'Line item re-mapped and quote recomputed';
export const REMAP_NOTHING_TO_UPDATE =
  'Provide at least one of sku_id, quantity, unit_price_minor, or override';
export const REMAP_SKU_NOT_FOUND = 'SKU not found';
export const REMAP_LINE_NOT_FOUND = 'Line item not found for this request';
export const REMAP_OVERRIDE_PRICE_REQUIRED =
  'override requires unit_price_minor (or a line that already has a manual price)';
export const REMAP_OVERRIDE_CONFLICT = 'unit_price_minor cannot be combined with override:false';

// Explain routing
export const EXPLAIN_ROUTING_ALL_CLEAR = 'All checks passed - quote is auto-eligible for pricing.';
export const EXPLAIN_ROUTING_REVIEW_REQUIRED = 'This quote requires manual review.';
export const EXPLAIN_ROUTING_POLICY_FLAGS = (count: number) =>
  `${count} policy flag(s) on line items.`;
export const EXPLAIN_ROUTING_DEAL_VALUE_INCOMPLETE = 'Some line items have incomplete pricing.';
export const EXPLAIN_ROUTING_NO_LINE_ITEMS = 'No line items were found on this quote.';
export const EXPLAIN_ROUTING_EXTRACTION_FAILED =
  'The source document could not be fully extracted.';
