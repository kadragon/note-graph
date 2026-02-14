import {
  bodyValidator,
  getValidatedBody,
  getValidatedQuery,
  queryValidator,
} from '../middleware/validation-middleware';
import {
  createWorkNoteGroupSchema,
  listWorkNoteGroupsQuerySchema,
  updateWorkNoteGroupSchema,
} from '../schemas/work-note-group';
import { notFoundJson } from './_shared/route-responses';
import { createProtectedRouter } from './_shared/router-factory';

const workNoteGroups = createProtectedRouter();

workNoteGroups.get('/', queryValidator(listWorkNoteGroupsQuerySchema), async (c) => {
  const query = getValidatedQuery<typeof listWorkNoteGroupsQuerySchema>(c);
  const { workNoteGroups: repository } = c.get('repositories');
  const results = await repository.findAll(query.q, query.limit, query.activeOnly);
  return c.json(results);
});

workNoteGroups.post('/', bodyValidator(createWorkNoteGroupSchema), async (c) => {
  const data = getValidatedBody<typeof createWorkNoteGroupSchema>(c);
  const { workNoteGroups: repository } = c.get('repositories');
  const group = await repository.create(data);
  return c.json(group, 201);
});

workNoteGroups.get('/:groupId', async (c) => {
  const groupId = c.req.param('groupId');
  const { workNoteGroups: repository } = c.get('repositories');
  const group = await repository.findById(groupId);
  if (!group) {
    return notFoundJson(c, 'Work note group', groupId);
  }
  return c.json(group);
});

workNoteGroups.put('/:groupId', bodyValidator(updateWorkNoteGroupSchema), async (c) => {
  const groupId = c.req.param('groupId');
  const data = getValidatedBody<typeof updateWorkNoteGroupSchema>(c);
  const { workNoteGroups: repository } = c.get('repositories');
  const group = await repository.update(groupId, data);
  return c.json(group);
});

workNoteGroups.patch('/:groupId/toggle-active', async (c) => {
  const groupId = c.req.param('groupId');
  const { workNoteGroups: repository } = c.get('repositories');
  const group = await repository.toggleActive(groupId);
  return c.json(group);
});

workNoteGroups.delete('/:groupId', async (c) => {
  const groupId = c.req.param('groupId');
  const { workNoteGroups: repository } = c.get('repositories');
  await repository.delete(groupId);
  return c.json({ message: 'Work note group deleted successfully' });
});

workNoteGroups.get('/:groupId/work-notes', async (c) => {
  const groupId = c.req.param('groupId');
  const { workNoteGroups: repository } = c.get('repositories');
  const workNotes = await repository.getWorkNotes(groupId);
  return c.json(workNotes);
});

workNoteGroups.post('/:groupId/work-notes/:workId', async (c) => {
  const groupId = c.req.param('groupId');
  const workId = c.req.param('workId');
  const { workNoteGroups: repository } = c.get('repositories');
  await repository.addWorkNote(groupId, workId);
  return c.json({ message: 'Work note added to group' }, 201);
});

workNoteGroups.delete('/:groupId/work-notes/:workId', async (c) => {
  const groupId = c.req.param('groupId');
  const workId = c.req.param('workId');
  const { workNoteGroups: repository } = c.get('repositories');
  await repository.removeWorkNote(groupId, workId);
  return c.json({ message: 'Work note removed from group' });
});

export default workNoteGroups;
