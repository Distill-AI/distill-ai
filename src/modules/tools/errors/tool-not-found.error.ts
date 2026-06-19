export class ToolNotFoundError extends Error {
  constructor(name: string) {
    super(`Tool "${name}" is not registered.`);
    this.name = 'ToolNotFoundError';
  }
}
