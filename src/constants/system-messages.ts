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

// Pipeline (US-E8-4)
export const REQUEST_NOT_FOUND = (id: string) => `Request ${id} not found`;
export const PIPELINE_ENQUEUED = 'Request enqueued for pipeline processing';
export const PIPELINE_RESUMED = 'Request resumed for pipeline processing';

// Ingestion (US-E1-1, US-E1-2, US-E1-3)
export const REQUEST_CREATED = 'Request created and queued for processing';
export const REQUEST_INPUT_REQUIRED =
  'Provide at least one file or pasted text to create a request.';
export const UNSUPPORTED_FILE_TYPE =
  'Unsupported file type. Only PDF, CSV, or TXT files are accepted.';
export const FILE_TOO_LARGE = (maxMb: number) => `File too large. Maximum size is ${maxMb} MB.`;

// Auth (NFR-SEC-5)
export const AUTH_PROFILE_FETCHED = 'Profile fetched successfully';
export const AUTH_LOGIN_SUCCESS = 'Login successful';
export const AUTH_UNAUTHORIZED = 'Unauthorized. Valid token required.';
export const AUTH_FORBIDDEN = 'Forbidden. Insufficient permissions.';
export const AUTH_INVALID_TOKEN = 'Invalid or expired token.';
export const AUTH_INVALID_CREDENTIALS = 'Invalid credentials';
export const AUTH_TOKEN_MISSING_OR_INVALID = 'Missing or invalid token';

// Tool Registry (US-E8-5)
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
