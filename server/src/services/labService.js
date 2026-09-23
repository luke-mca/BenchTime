import { LabRepository } from '../repositories/labRepository.js';
import { UserRepository } from '../repositories/userRepository.js';
import { assertNonEmpty } from '../utils/validation.js';
import { ValidationError, NotFoundError, ConflictError } from '../errors.js';

//Max acceptable lab name.
export const MAX_LAB_NAME_LENGTH = 30;

//Postgres error code for a unique constraint violation. Needed for duplicate lab names. 
const UNIQUE_VIOLATION = '23505';

export function toPublicLab(row) {
  return { id: String(row.id), name: row.name, createdAt: row.createdAt };
}

export function toPublicMember(row) {
  return { id: String(row.id), username: row.username, addedAt: row.addedAt };
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

  //One lab, but only for the manager that owns it.
  async getLab({ labId, ownerId } = {}) {
    return toPublicLab(await findOwnedLabOrThrow(labId, ownerId));
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
};
