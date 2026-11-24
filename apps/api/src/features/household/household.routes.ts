import { Router } from 'express';
import { JoinHouseholdSchema, UpdateHouseholdSchema, UpdateMemberSchema } from '@app/shared';
import { currentUserId } from '../../auth/middleware.ts';
import { validate } from '../../lib/validate.ts';
import type { HouseholdService } from './household.service.ts';

export function householdRouter(households: HouseholdService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await households.get(currentUserId(req)));
  });

  router.patch('/', async (req, res) => {
    const input = validate(UpdateHouseholdSchema, req.body);
    res.json(await households.update(currentUserId(req), input));
  });

  router.patch('/me', async (req, res) => {
    const input = validate(UpdateMemberSchema, req.body);
    res.json(await households.updateMe(currentUserId(req), input));
  });

  router.post('/invite-code', async (req, res) => {
    res.json(await households.regenerateInviteCode(currentUserId(req)));
  });

  router.post('/join', async (req, res) => {
    const input = validate(JoinHouseholdSchema, req.body);
    res.json(await households.join(currentUserId(req), input));
  });

  return router;
}
