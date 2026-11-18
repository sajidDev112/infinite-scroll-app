import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createStorySchema,
  idParamSchema,
  listQuerySchema,
  statusSchema,
  updateStorySchema,
} from '../validation/schemas.js';
import * as stories from '../services/storyService.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'editor'));

const byId = validate(idParamSchema, 'params');

router.get('/', validate(listQuerySchema, 'query'), async (req, res) => {
  res.json(await stories.listStories(req.valid.query));
});

router.post('/', validate(createStorySchema), async (req, res) => {
  res.status(201).json({ story: await stories.createStory(req.valid.body, req.admin) });
});

router.get('/:id', byId, async (req, res) => {
  res.json({ story: await stories.getStory(req.valid.params.id) });
});

router.put('/:id', byId, validate(updateStorySchema), async (req, res) => {
  res.json({ story: await stories.updateStory(req.valid.params.id, req.valid.body, req.admin) });
});

router.delete('/:id', byId, requireRole('admin'), async (req, res) => {
  await stories.deleteStory(req.valid.params.id);
  res.status(204).end();
});

router.patch('/:id/status', byId, validate(statusSchema), async (req, res) => {
  res.json({ story: await stories.setStatus(req.valid.params.id, req.valid.body.status, req.admin) });
});

router.post('/:id/publish', byId, requireRole('admin'), async (req, res) => {
  res.json({ story: await stories.publishStory(req.valid.params.id, req.admin) });
});

router.post('/:id/duplicate', byId, async (req, res) => {
  res.status(201).json({ story: await stories.duplicateStory(req.valid.params.id, req.admin) });
});

export default router;
