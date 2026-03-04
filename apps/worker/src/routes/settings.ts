/**
 * Settings management routes
 */

import type { OpenAIModel } from '@shared/types/setting';
import {
  bodyValidator,
  getValidatedBody,
  getValidatedQuery,
  queryValidator,
} from '../middleware/validation-middleware';
import { listSettingsQuerySchema, updateSettingSchema } from '../schemas/setting';
import { getAIGatewayHeaders, getAIGatewayUrl } from '../utils/ai-gateway';
import { notFoundJson } from './_shared/route-responses';
import { createProtectedRouter } from './_shared/router-factory';

const settings = createProtectedRouter();

/**
 * GET /settings - List all settings
 * Query params: category (optional)
 */
settings.get('/', queryValidator(listSettingsQuerySchema), async (c) => {
  const query = getValidatedQuery<typeof listSettingsQuerySchema>(c);
  const { settings: repository } = c.get('repositories');
  const results = await repository.findAll(query.category);

  return c.json(results);
});

/**
 * GET /settings/openai-models - List available OpenAI models
 */
settings.get('/openai-models', async (c) => {
  const url = getAIGatewayUrl(c.env, 'models');
  const headers = getAIGatewayHeaders(c.env);

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorText = await response.text();
    return c.json(
      { code: 'OPENAI_API_ERROR', message: `Failed to fetch models: ${errorText}` },
      500
    );
  }

  const data = await response.json<{ data: OpenAIModel[] }>();

  // Filter to GPT/O-series models only
  const filtered = (data.data || [])
    .filter((m) => /^(gpt-|o[1-9]|text-embedding-)/.test(m.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  return c.json(filtered);
});

/**
 * GET /settings/:key - Get single setting
 */
settings.get('/:key{.+}', async (c) => {
  const key = c.req.param('key');
  const { settings: repository } = c.get('repositories');
  const setting = await repository.findByKey(key);

  if (!setting) {
    return notFoundJson(c, 'Setting', key);
  }

  return c.json(setting);
});

/**
 * PUT /settings/:key - Update setting value
 */
settings.put('/:key{.+}', bodyValidator(updateSettingSchema), async (c) => {
  const key = c.req.param('key');
  const data = getValidatedBody<typeof updateSettingSchema>(c);
  const { settings: repository } = c.get('repositories');
  const setting = await repository.upsert(key, data.value);

  return c.json(setting);
});

/**
 * POST /settings/:key/reset - Reset setting to default value
 */
settings.post('/:key{.+}/reset', async (c) => {
  const key = c.req.param('key');
  const { settings: repository } = c.get('repositories');
  const setting = await repository.resetToDefault(key);

  return c.json(setting);
});

export default settings;
