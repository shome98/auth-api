import { z } from 'zod';

/**
 * Guest data must be a flat JSON object with limited size.
 * Prevents storing arbitrary/unbounded data in the jsonb column.
 */
export const updateGuestDataSchema = z
  .record(z.string(), z.unknown())
  .refine((data) => JSON.stringify(data).length <= 16_384, {
    message: 'Guest data must be less than 16 KB.',
  });

export type UpdateGuestDataInput = z.infer<typeof updateGuestDataSchema>;
