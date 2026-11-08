const WORKER_RESTART_MESSAGE =
  'The background worker restarted before it replied, so the result is unknown. The save may have completed — check Recent before saving again.';

export function describeFailure(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/message port closed/i.test(raw)) return WORKER_RESTART_MESSAGE;
  return raw || 'Something went wrong.';
}
