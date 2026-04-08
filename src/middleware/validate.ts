import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { MSG } from '../utils/constants';

// ✅ Zod Request Validation Middleware

/** Validate request body against a Zod schema. */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const formatted = (result.error as ZodError).issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      res.status(400).json({
        success: false,
        statusCode: 400,
        message: MSG.VALIDATION_FAILED,
        errors: formatted,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Replace body with parsed (coerced + stripped) data
    req.body = result.data;
    next();
  };
}

/** Validate request URL params against a Zod schema. */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const formatted = (result.error as ZodError).issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      res.status(400).json({
        success: false,
        statusCode: 400,
        message: MSG.VALIDATION_FAILED,
        errors: formatted,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
