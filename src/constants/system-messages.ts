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
export const PIPELINE_ENQUEUED = 'Request enqueued for pipeline processing';
export const PIPELINE_RESUMED = 'Request resumed for pipeline processing';

// Parse node
export const PARSE_UNSUPPORTED_TYPE = (ext: string) =>
  `Cannot extract text from unsupported file type "${ext}"`;

// Paste fallback
export const ATTACHMENT_PASTE_ACCEPTED = 'Content accepted; extraction re-queued';
export const ATTACHMENT_PASTE_CONFLICT = 'Extraction is already in progress for this request';
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
export const EXTRACTION_RECONCILE_FAILED = (reason: string) =>
  `Extraction reconciliation failed: ${reason}`;
export const EXTRACTION_UPSERT_FAILED = (requestId: string) =>
  `Failed to persist extraction for request ${requestId}`;
export const EXTRACTION_JSON_PARSE_FAILED = (detail: string) =>
  `Failed to parse extraction JSON: ${detail}`;

// Scoring (US-E2-3 / US-E5)
export const SCORE_ROUTING_APPLIED = (routing: string) => `Routing set to ${routing}`;

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
