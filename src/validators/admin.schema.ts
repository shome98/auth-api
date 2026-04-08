import { z } from 'zod';

/** Validates :userId URL parameter is a valid UUID */
export const userIdParamSchema = z.object({
  userId: z.uuid({ version: 'v4', message: 'userId must be a valid UUID.' }),
});

export const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin'], {
    error: (iss) =>
      iss.input === undefined
        ? 'Role is required.'
        : 'Role must be either "user" or "admin".',
  }),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
