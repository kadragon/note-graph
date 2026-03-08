/**
 * Settings management routes
 */

import {
  bodyValidator,
  getValidatedBody,
  getValidatedQuery,
  queryValidator,
} from '../middleware/validation-middleware';
import { listSettingsQuerySchema, updateSettingSchema } from '../schemas/setting';
import { fetchOpenAIModelsFromLiteLLM } from '../utils/litellm-models';
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
 *
 * Fetches model list from LiteLLM's maintained model registry (GitHub).
 * AI Gateway does not proxy /models, and direct OpenAI calls are blocked by region.
 */
settings.get('/openai-models', async (c) => {
  const models = await fetchOpenAIModelsFromLiteLLM();
  return c.json(models);
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
