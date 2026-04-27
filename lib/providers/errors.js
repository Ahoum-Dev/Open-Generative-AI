// Thrown by adapters when a failure is known to be terminal (no point
// retrying — the same input will fail the same way). The worker treats this
// distinctly from generic Errors: terminal failures skip the retry/backoff
// loop and mark the job as failed immediately.
//
// Use for: 4xx client errors, content-policy rejections, malformed responses
// that indicate the request itself is bad.
//
// Do NOT use for: 5xx server errors, network timeouts, transient connection
// failures — those should throw a regular Error so the worker retries.

export class TerminalProviderError extends Error {
  constructor(message, { billed = null } = {}) {
    super(message);
    this.name = 'TerminalProviderError';
    // Whether the provider likely charged for this attempt despite failing.
    // true:  policy rejection on a 2xx (Segmind face-content errors)
    // false: 4xx client errors that never started generation
    // null:  unknown — assume billed and check provider dashboard
    this.billed = billed;
  }
}
