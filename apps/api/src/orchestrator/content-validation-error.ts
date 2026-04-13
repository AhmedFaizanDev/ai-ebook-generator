export class ContentValidationError extends Error {
  constructor(
    public readonly label: string,
    public readonly errors: { type: string; message: string }[],
  ) {
    const summary = errors.map((e) => `[${e.type}] ${e.message}`).join('; ');
    super(`Content validation hard-fail for ${label}: ${summary}`);
    this.name = 'ContentValidationError';
  }
}
