import express, { Router } from 'express';
import {
  CreateMealSchema,
  ListMealsQuerySchema,
  MAX_PHOTO_BYTES,
  MealIdParamsSchema,
  MealPhotoParamsSchema,
  PhotoContentTypeSchema,
  SuggestMealsQuerySchema,
  UpdateMealSchema,
  UploadPhotoQuerySchema,
} from '@app/shared';
import { currentUserId } from '../../auth/middleware.ts';
import { HttpError } from '../../lib/http-error.ts';
import { validate } from '../../lib/validate.ts';
import type { PlanService } from '../plan/plan.service.ts';
import type { MealsService } from './meals.service.ts';

export function mealsRouter(meals: MealsService, plan: PlanService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = validate(ListMealsQuerySchema, req.query);
    res.json(await meals.list(currentUserId(req), query));
  });

  // Before /:id, so "suggestions" isn't read as a meal ID.
  router.get('/suggestions', async (req, res) => {
    const query = validate(SuggestMealsQuerySchema, req.query);
    res.json(await plan.suggest(currentUserId(req), query));
  });

  router.post('/', async (req, res) => {
    const input = validate(CreateMealSchema, req.body);
    res.status(201).json(await meals.create(currentUserId(req), input));
  });

  router.get('/:id', async (req, res) => {
    const { id } = validate(MealIdParamsSchema, req.params);
    res.json(await meals.get(currentUserId(req), id));
  });

  router.patch('/:id', async (req, res) => {
    const { id } = validate(MealIdParamsSchema, req.params);
    const input = validate(UpdateMealSchema, req.body);
    res.json(await meals.update(currentUserId(req), id, input));
  });

  router.post('/:id/recipe/adjust', async (req, res) => {
    const { id } = validate(MealIdParamsSchema, req.params);
    res.json(await meals.adjustSteps(currentUserId(req), id));
  });

  router.delete('/:id', async (req, res) => {
    const { id } = validate(MealIdParamsSchema, req.params);
    await meals.remove(currentUserId(req), id);
    res.status(204).end();
  });

  // Photos are uploaded as the raw image body, with its type as the Content-Type.
  // ?kind=recipe marks a photo of the recipe, which is then read into the meal's recipe text.
  router.post(
    '/:id/photos',
    express.raw({ type: () => true, limit: MAX_PHOTO_BYTES }),
    async (req, res) => {
      const { id } = validate(MealIdParamsSchema, req.params);
      const { kind } = validate(UploadPhotoQuerySchema, req.query);
      const type = PhotoContentTypeSchema.safeParse(req.headers['content-type']?.split(';')[0]);
      if (!type.success) {
        throw new HttpError(415, 'unsupported_media_type', 'Upload a JPEG, PNG or WebP image');
      }
      const body: unknown = req.body;
      const data = Buffer.isBuffer(body) ? new Uint8Array(body) : new Uint8Array();
      res.status(201).json(await meals.addPhoto(currentUserId(req), id, kind, type.data, data));
    },
  );

  router.get('/:id/photos/:photoId', async (req, res) => {
    const { id, photoId } = validate(MealPhotoParamsSchema, req.params);
    const photo = await meals.photo(currentUserId(req), id, photoId);
    // A photo never changes once uploaded (replacing one makes a new ID).
    res
      .set('Cache-Control', 'private, max-age=31536000, immutable')
      .type(photo.contentType)
      .send(Buffer.from(photo.data));
  });

  router.post('/:id/photos/:photoId/read', async (req, res) => {
    const { id, photoId } = validate(MealPhotoParamsSchema, req.params);
    res.json(await meals.rereadRecipePhoto(currentUserId(req), id, photoId));
  });

  router.delete('/:id/photos/:photoId', async (req, res) => {
    const { id, photoId } = validate(MealPhotoParamsSchema, req.params);
    await meals.removePhoto(currentUserId(req), id, photoId);
    res.status(204).end();
  });

  return router;
}
