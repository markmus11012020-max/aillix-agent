export class KaitenError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly body?: string;

  constructor(message: string, status = 0, body?: string, code?: string) {
    super(message);
    this.name = "KaitenError";
    this.status = status;
    this.body = body;
    this.code = code;
  }

  get isAuth(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isRateLimit(): boolean {
    return this.status === 429;
  }

  get isTariff(): boolean {
    return this.status === 402;
  }
}
