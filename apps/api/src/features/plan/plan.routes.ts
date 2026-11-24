import { Router } from 'express';
import {
  AddOptionsSchema,
  DateParamsSchema,
  OptionIdParamsSchema,
  SetDinnerSchema,
  ShuffleWeekSchema,
  VoteSchema,
} from '@app/shared';
import { currentUserId } from '../../auth/middleware.ts';
import { validate } from '../../lib/validate.ts';
import type { PlanService } from './plan.service.ts';

export function planRouter(plan: PlanService): Router {
  const router = Router();

  router.get('/weeks/current', async (req, res) => {
    res.json(await plan.week(currentUserId(req)));
  });

  router.get('/weeks/:date', async (req, res) => {
    const { date } = validate(DateParamsSchema, req.params);
    res.json(await plan.week(currentUserId(req), date));
  });

  router.post('/weeks/:date/shuffle', async (req, res) => {
    const { date } = validate(DateParamsSchema, req.params);
    const { optionsPerNight } = validate(ShuffleWeekSchema, req.body ?? {});
    res.json(await plan.shuffleWeek(currentUserId(req), date, optionsPerNight));
  });

  router.get('/nights/:date', async (req, res) => {
    const { date } = validate(DateParamsSchema, req.params);
    res.json(await plan.night(currentUserId(req), date));
  });

  router.put('/nights/:date/dinner', async (req, res) => {
    const { date } = validate(DateParamsSchema, req.params);
    const input = validate(SetDinnerSchema, req.body);
    res.json(await plan.setDinner(currentUserId(req), date, input));
  });

  router.delete('/nights/:date/dinner', async (req, res) => {
    const { date } = validate(DateParamsSchema, req.params);
    res.json(await plan.clearDinner(currentUserId(req), date));
  });

  router.post('/options', async (req, res) => {
    const input = validate(AddOptionsSchema, req.body);
    res.status(201).json(await plan.addOptions(currentUserId(req), input));
  });

  router.delete('/options/:id', async (req, res) => {
    const { id } = validate(OptionIdParamsSchema, req.params);
    res.json(await plan.removeOption(currentUserId(req), id));
  });

  router.put('/options/:id/vote', async (req, res) => {
    const { id } = validate(OptionIdParamsSchema, req.params);
    const input = validate(VoteSchema, req.body);
    res.json(await plan.vote(currentUserId(req), id, input));
  });

  router.post('/options/:id/choose', async (req, res) => {
    const { id } = validate(OptionIdParamsSchema, req.params);
    res.json(await plan.chooseOption(currentUserId(req), id));
  });

  return router;
}
