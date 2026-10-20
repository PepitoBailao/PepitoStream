import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const profileSettingsSchema = z.object({
  mode: z.enum(['simple', 'expert']).default('simple'),
  languages: z.array(z.string().min(2).max(12)).max(20).default(['fr']),
  maxResolution: z.enum(['720p', '1080p', '2160p']).default('1080p')
}).strict();
export type ProfileSettings = z.infer<typeof profileSettingsSchema>;

/** Sign a random profile identifier. Keep the secret server-side. */
export function createProfileToken(secret: string): string {
  if (secret.length < 32) throw new Error('PROFILE_TOKEN_SECRET must contain at least 32 characters');
  const id = randomBytes(24).toString('base64url');
  const signature = createHmac('sha256', secret).update(id).digest('base64url');
  return `${id}.${signature}`;
}

export function verifyProfileToken(token: string, secret: string): boolean {
  if (secret.length < 32) return false;
  const [id, signature, extra] = token.split('.');
  if (!id || !signature || extra) return false;
  const expected = createHmac('sha256', secret).update(id).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { return false; }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
