import { LabRepository } from '../repositories/labRepository.js';
import { EquipmentRepository } from '../repositories/equipmentRepository.js';
import { UserRepository } from '../repositories/userRepository.js';
import { assertNonEmpty } from '../utils/validation.js';
import { ValidationError, NotFoundError, ConflictError } from '../errors.js';

//Max acceptable lab name.
export const MAX_LAB_NAME_LENGTH = 30;

//Max acceptable equipment name and description.
export const MAX_EQUIPMENT_NAME_LENGTH = 50;
export const MAX_EQUIPMENT_DESCRIPTION_LENGTH = 500;

//Postgres error code for a unique constraint violation. Needed for duplicate lab names. 
const UNIQUE_VIOLATION = '23505';

export function toPublicLab(row) {
  return {
    id: String(row.id),
    name: row.name,
    createdAt: row.createdAt,
    ownerUsername: row.ownerUsername,
    memberCount: row.memberCount,
    equipmentCount: row.equipmentCount,
  };
}

export function toPublicMember(row) {
  return { id: String(row.id), username: row.username, addedAt: row.addedAt };
}

export function toPublicEquipment(row) {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
  };
}

//Returns the id, or null if it is not a positive integer. Used for values from the sql table.
function parseId(value) {
  return /^\d+$/.test(value) ? value : null;
}

//Every route that works inside a lab starts here.
async function findOwnedLabOrThrow(labId, ownerId) {
  const id = parseId(labId);
  const lab = id ? await LabRepository.findOwnedBy(id, ownerId) : null;

  if (!lab) {
    throw new NotFoundError('That lab does not exist.');
  }

  return lab;
}

//Same as above but for a member that has been added to the lab.
async function findMemberLabOrThrow(labId, userId) {
  const id = parseId(labId);
  const lab = id ? await LabRepository.findForMember(id, userId) : null;

  if (!lab) {
    throw new NotFoundError('That lab does not exist.');
  }

  return lab;
}

export const LabService = {
  async listLabs(ownerId) {
    const rows = await LabRepository.listByOwner(ownerId);
    return rows.map(toPublicLab);
  },

  async createLab({ name, ownerId } = {}) {
    //These fields are required. 
    assertNonEmpty(name, 'Lab name', 'MISSING_LAB_NAME');

    //Length is checked after trimming so that extra trailing spaces cannot push a name over.
    const cleanName = name.trim();
    if (cleanName.length > MAX_LAB_NAME_LENGTH) {
      throw new ValidationError(
        `A lab name can be at most ${MAX_LAB_NAME_LENGTH} characters.`,
        'LAB_NAME_TOO_LONG',
      );
    }

    let row;
    try {
      row = await LabRepository.createLab({ name: cleanName, ownerId });
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictError(`You already have a lab named "${cleanName}".`, 'LAB_NAME_TAKEN');
      }
      throw error;
    }

    return toPublicLab(row);
  },

  //Lists the labs a member has been added to. 
  async listLabsForMember(userId) {
    const rows = await LabRepository.listByMember(userId);
    return rows.map(toPublicLab);
  },

  //One lab, but only for the manager that owns it.
  async getLab({ labId, ownerId } = {}) {
    return toPublicLab(await findOwnedLabOrThrow(labId, ownerId));
  },

  //One lab but only for a member that has been added to it. 
  async getLabForMember({ labId, userId } = {}) {
    return toPublicLab(await findMemberLabOrThrow(labId, userId));
  },

  //Deletes a lab the manager owns. The lab's members, equipment and reservations are deleted with it. 
  async deleteLab({ labId, ownerId } = {}) {
    const id = parseId(labId);
    const deleted = id ? await LabRepository.deleteOwnedBy(id, ownerId) : false;

    if (!deleted) {
      throw new NotFoundError('That lab does not exist.');
    }
  },

  //Lists the members of a lab but only for the manager that owns it.
  async listMembers({ labId, ownerId } = {}) {
    const lab = await findOwnedLabOrThrow(labId, ownerId);

    const rows = await LabRepository.listMembers(lab.id);
    return rows.map(toPublicMember);
  },

  //Adds a member to a lab the manager owns, found by username.
  async addMember({ labId, username, ownerId } = {}) {
    const lab = await findOwnedLabOrThrow(labId, ownerId);

    assertNonEmpty(username, 'Username', 'MISSING_USERNAME');
    const cleanUsername = username.trim();

    //Case insensitive to find a member. 
    const user = await UserRepository.findByUsername(cleanUsername);
    if (!user) {
      throw new NotFoundError(`There is no user named "${cleanUsername}".`);
    }

    //Make sure the owner cannot add themsevles to the lab. 
    if (String(user.id) === String(ownerId)) {
      throw new ValidationError('You already own this lab.', 'OWNER_CANNOT_BE_MEMBER');
    }

    //Only allow members to be added to a lab. 
    if (user.role !== 'member') {
      throw new ValidationError(
        `${user.username} is a lab manager, not a member.`,
        'NOT_A_MEMBER_ACCOUNT',
      );
    }

    const membership = await LabRepository.addMember(lab.id, user.id);
    if (!membership) {
      throw new ConflictError(
        `${user.username} is already a member of this lab.`,
        'ALREADY_A_MEMBER',
      );
    }
    
    return toPublicMember({ id: user.id, username: user.username, addedAt: membership.addedAt });
  },

  //Removes a member from a lab the manager owns. The member keeps their account.
  async removeMember({ labId, userId, ownerId } = {}) {
    const lab = await findOwnedLabOrThrow(labId, ownerId);

    const id = parseId(userId);
    const removed = id ? await LabRepository.removeMember(lab.id, id) : false;

    if (!removed) {
      throw new NotFoundError('That member is not part of this lab.');
    }
  },

  //Lists the active equipment in a lab. Managers only see their own labs and members only see labs they were added to.
  async listEquipment({ labId, userId, role } = {}) {
    const lab =
      role === 'manager'
        ? await findOwnedLabOrThrow(labId, userId)
        : await findMemberLabOrThrow(labId, userId);

    const rows = await EquipmentRepository.listActiveByLab(lab.id);
    return rows.map(toPublicEquipment);
  },

  //Adds a piece of equipment to a lab the manager owns. The description is optional.
  async addEquipment({ labId, name, description, ownerId } = {}) {
    const lab = await findOwnedLabOrThrow(labId, ownerId);

    assertNonEmpty(name, 'Equipment name', 'MISSING_EQUIPMENT_NAME');
    const cleanName = name.trim();
    if (cleanName.length > MAX_EQUIPMENT_NAME_LENGTH) {
      throw new ValidationError(
        `An equipment name can be at most ${MAX_EQUIPMENT_NAME_LENGTH} characters.`,
        'EQUIPMENT_NAME_TOO_LONG',
      );
    }

    if (description !== undefined && description !== null && typeof description !== 'string') {
      throw new ValidationError('Description must be text.', 'INVALID_EQUIPMENT_DESCRIPTION');
    }
    const cleanDescription = (description ?? '').trim();
    if (cleanDescription.length > MAX_EQUIPMENT_DESCRIPTION_LENGTH) {
      throw new ValidationError(
        `A description can be at most ${MAX_EQUIPMENT_DESCRIPTION_LENGTH} characters.`,
        'EQUIPMENT_DESCRIPTION_TOO_LONG',
      );
    }

    let row;
    try {
      row = await EquipmentRepository.create({
        labId: lab.id,
        name: cleanName,
        description: cleanDescription,
      });
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictError(
          `This lab already has equipment named "${cleanName}".`,
          'EQUIPMENT_NAME_TAKEN',
        );
      }
      throw error;
    }

    return toPublicEquipment(row);
  },

  //Removes a piece of equipment from a lab the manager owns. This is a soft delete so past reservations are kept.
  async removeEquipment({ labId, equipmentId, ownerId } = {}) {
    const lab = await findOwnedLabOrThrow(labId, ownerId);

    const id = parseId(equipmentId);
    const removed = id ? await EquipmentRepository.deactivate(lab.id, id) : false;

    if (!removed) {
      throw new NotFoundError('That equipment is not part of this lab.');
    }
  },
};
