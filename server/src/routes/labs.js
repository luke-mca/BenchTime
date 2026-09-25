import { Router } from 'express';
import { LabService } from '../services/labService.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

//Relies on the token system provided in auth.js. 
//Lab endpoints. All buisness logic lives in labService.js. 
export const labsRouter = Router();

//Lists the caller's labs either the ones that a manager owns or the ones that a member has been added to. 
labsRouter.get('/', requireAuth, async (req, res) => {
  const labs =
    req.user.role === 'manager'
      ? await LabService.listLabs(req.user.id)
      : await LabService.listLabsForMember(req.user.id);
  res.json({ labs });
});

//Creates a lab owned by the signed in manager.
labsRouter.post('/', requireAuth, requireRole('manager'), async (req, res) => {
  const { name } = req.body ?? {};
  const lab = await LabService.createLab({ name, ownerId: req.user.id });
  res.status(201).json({ lab });
});

//Returns a single lab for either a manager or a member
labsRouter.get('/:id', requireAuth, async (req, res) => {
  const lab =
    req.user.role === 'manager'
      ? await LabService.getLab({ labId: req.params.id, ownerId: req.user.id })
      : await LabService.getLabForMember({ labId: req.params.id, userId: req.user.id });
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

//Lists the equipment in a lab for either the manager that owns it or a member that has been added to it.
labsRouter.get('/:id/equipment', requireAuth, async (req, res) => {
  const equipment = await LabService.listEquipment({
    labId: req.params.id,
    userId: req.user.id,
    role: req.user.role,
  });
  res.json({ equipment });
});

//Adds a piece of equipment to a lab the signed in manager owns.
labsRouter.post('/:id/equipment', requireAuth, requireRole('manager'), async (req, res) => {
  const { name, description } = req.body ?? {};
  const equipment = await LabService.addEquipment({
    labId: req.params.id,
    name,
    description,
    ownerId: req.user.id,
  });
  res.status(201).json({ equipment });
});

//Removes a piece of equipment from a lab the signed in manager owns. Past reservations are kept.
labsRouter.delete('/:id/equipment/:equipmentId', requireAuth, requireRole('manager'), async (req, res) => {
  await LabService.removeEquipment({
    labId: req.params.id,
    equipmentId: req.params.equipmentId,
    ownerId: req.user.id,
  });
  res.status(204).end();
});
