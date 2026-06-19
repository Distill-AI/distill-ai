export class DuplicateToolError extends Error {
  constructor(name: string) {
    super(`Tool "${name}" has already been registered.`);
    this.name = 'DuplicateToolError';
  }
}
