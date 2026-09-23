import { Router } from 'express';
import { LabService } from '../services/labService.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

//Relies on the token system provided in auth.js. 
//Lab endpoints. All buisness logic lives in labService.js. 
export const labsRouter = Router();

//Lists the labs the signed in manager owns. Empty array if they have none yet.
labsRouter.get('/', requireAuth, requireRole('manager'), async (req, res) => {
  const labs = await LabService.listLabs(req.user.id);
  res.json({ labs });
});

//Creates a lab owned by the signed in manager.
labsRouter.post('/', requireAuth, requireRole('manager'), async (req, res) => {
  const { name } = req.body ?? {};
  const lab = await LabService.createLab({ name, ownerId: req.user.id });
  res.status(201).json({ lab });
});

//Returns a single lab the signed in manager owns.
labsRouter.get('/:id', requireAuth, requireRole('manager'), async (req, res) => {
  const lab = await LabService.getLab({ labId: req.params.id, ownerId: req.user.id });
  res.json({ lab });
});

//Deletes a lab the signed in manager owns, along with everything inside it.
labsRouter.delete('/:id', requireAuth, requireRole('manager'), async (req, res) => {
  await LabService.deleteLab({ labId: req.params.id, ownerId: req.user.id });
  res.status(204).end();
});

//Lists the members of a lab the signed in manager owns.
labsRouter.get('/:id/members', requireAuth, requireRole('manager'), async (req, res) => {
  const members = await LabService.listMembers({ labId: req.params.id, ownerId: req.user.id });
  res.json({ members });
});

//Adds a member to a lab the signed in manager owns, using the member's username.
labsRouter.post('/:id/members', requireAuth, requireRole('manager'), async (req, res) => {
  const { username } = req.body ?? {};
  const member = await LabService.addMember({
    labId: req.params.id,
    username,
    ownerId: req.user.id,
  });
  res.status(201).json({ member });
});

//Removes a member from a lab the signed in manager owns.
labsRouter.delete('/:id/members/:userId', requireAuth, requireRole('manager'), async (req, res) => {
  await LabService.removeMember({
    labId: req.params.id,
    userId: req.params.userId,
    ownerId: req.user.id,
  });
  res.status(204).end();
});
