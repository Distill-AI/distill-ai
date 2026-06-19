export class ReservedToolNameError extends Error {
  constructor(name: string) {
    super(`"${name}" is a reserved tool name and cannot be registered.`);
    this.name = 'ReservedToolNameError';
  }
}
