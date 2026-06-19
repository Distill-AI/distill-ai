import { z } from 'zod';

const schema = z.object({
  AUTH_ENABLED: z.enum(['true', 'false']).default('false'),
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRY_MS: z.coerce.number().int().positive().default(3600000),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  throw new Error(`Invalid auth config: ${JSON.stringify(result.error.flatten().fieldErrors)}`);
}

export const authConfig = {
  enabled: result.data.AUTH_ENABLED === 'true',
  jwtSecret: result.data.JWT_SECRET || '',
  tokenExpiryMs: result.data.JWT_EXPIRY_MS,
};

if (authConfig.enabled && !authConfig.jwtSecret) {
  throw new Error('AUTH_ENABLED=true requires JWT_SECRET');
}
