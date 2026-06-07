import { type Request, type Response, type NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly fields?: string[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body: { error: { code: string; message: string; fields?: string[] } } = {
      error: { code: err.code, message: err.message },
    };
    if (err.fields) body.error.fields = err.fields;
    res.status(err.httpStatus).json(body);
    return;
  }
  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
}
