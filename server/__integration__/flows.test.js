import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { pool } from '../src/db/pool.js';

//Complete user flows through the real routes, services, repositories and test database. Nothing is mocked.

const PASSWORD = 'integration-test-pass';

//These tests make more auth requests than the production limits allow.
const app = createApp({
  rateLimits: {
    api: { windowMs: 60_000, limit: 10_000 },
    auth: { windowMs: 60_000, limit: 10_000 },
  },
});

//Times are relative to now so the tests never fall into the past.
function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

//An agent keeps its cookies between requests, the same way a browser does.
async function registerUser(username, role) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ username, password: PASSWORD, role });
  expect(res.status).toBe(201);
  return agent;
}

async function createLab(manager, name = 'Chem Lab') {
  const res = await manager.post('/api/labs').send({ name });
  expect(res.status).toBe(201);
  return res.body.lab;
}

async function addEquipment(manager, labId, name = 'Microscope') {
  const res = await manager.post(`/api/labs/${labId}/equipment`).send({ name, description: 'Zeiss' });
  expect(res.status).toBe(201);
  return res.body.equipment;
}

async function addMember(manager, labId, username) {
  const res = await manager.post(`/api/labs/${labId}/members`).send({ username });
  expect(res.status).toBe(201);
  return res.body.member;
}

function reserve(agent, labId, equipmentId, startTime, endTime) {
  return agent
    .post(`/api/labs/${labId}/equipment/${equipmentId}/reservations`)
    .send({ startTime, endTime });
}

async function countRows(table) {
  const { rows } = await pool.query(`SELECT count(*)::int AS count FROM ${table}`);
  return rows[0].count;
}

beforeAll(() => {
  //Every test clears the tables, so never run against anything but a test database.
  const databaseName = new URL(config.databaseUrl).pathname.slice(1);
  if (config.env !== 'test' || !databaseName.endsWith('_test')) {
    throw new Error(`Refusing to run integration tests against "${databaseName}".`);
  }
});

beforeEach(async () => {
  await pool.query('TRUNCATE reservations, equipment, memberships, labs, users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe('core flow', () => {
  it('lets a manager set up a lab and a member reserve equipment', async () => {
    const manager = await registerUser('manager1', 'manager');
    await registerUser('luke', 'member');

    const lab = await createLab(manager);
    const microscope = await addEquipment(manager, lab.id);
    const member = await addMember(manager, lab.id, 'luke');
    expect(member.username).toBe('luke');

    const { body: managerLabs } = await manager.get('/api/labs').expect(200);
    expect(managerLabs.labs).toHaveLength(1);
    expect(managerLabs.labs[0]).toMatchObject({
      id: lab.id,
      name: 'Chem Lab',
      ownerUsername: 'manager1',
      memberCount: 1,
      equipmentCount: 1,
    });

    //The member logs in fresh, like they would on another device.
    const luke = request.agent(app);
    const login = await luke.post('/api/auth/login').send({ username: 'luke', password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ username: 'luke', role: 'member' });

    const { body: lukeLabs } = await luke.get('/api/labs').expect(200);
    expect(lukeLabs.labs.map((item) => item.id)).toEqual([lab.id]);

    const { body: lukeEquipment } = await luke.get(`/api/labs/${lab.id}/equipment`).expect(200);
    expect(lukeEquipment.equipment.map((item) => item.name)).toEqual(['Microscope']);

    const startTime = hoursFromNow(24);
    const endTime = hoursFromNow(26);
    const booked = await reserve(luke, lab.id, microscope.id, startTime, endTime);
    expect(booked.status).toBe(201);
    expect(booked.body.reservation).toMatchObject({ username: 'luke', isMine: true });

    //The manager sees the same reservation in the schedule, as someone else's.
    const schedulePath = `/api/labs/${lab.id}/equipment/${microscope.id}/reservations`;
    const { body: managerSchedule } = await manager.get(schedulePath).expect(200);
    expect(managerSchedule.reservations).toHaveLength(1);
    expect(managerSchedule.reservations[0]).toMatchObject({
      id: booked.body.reservation.id,
      username: 'luke',
      isMine: false,
    });
    expect(new Date(managerSchedule.reservations[0].startTime).toISOString()).toBe(startTime);
    expect(new Date(managerSchedule.reservations[0].endTime).toISOString()).toBe(endTime);

    await luke.delete(`/api/labs/${lab.id}/reservations/${booked.body.reservation.id}`).expect(204);

    const { body: emptySchedule } = await luke.get(schedulePath).expect(200);
    expect(emptySchedule.reservations).toEqual([]);
  });

  it('ends the session on log out', async () => {
    const luke = await registerUser('luke', 'member');
    await luke.get('/api/auth/me').expect(200);

    await luke.post('/api/auth/logout').expect(204);

    await luke.get('/api/auth/me').expect(401);
  });
});

describe('access control', () => {
  let manager;
  let lab;
  let microscope;

  beforeEach(async () => {
    manager = await registerUser('manager1', 'manager');
    lab = await createLab(manager);
    microscope = await addEquipment(manager, lab.id);
  });

  it('hides a lab from another manager', async () => {
    const otherManager = await registerUser('manager2', 'manager');

    await otherManager.get(`/api/labs/${lab.id}`).expect(404);
    await otherManager.post(`/api/labs/${lab.id}/equipment`).send({ name: 'Scale' }).expect(404);
    await otherManager.post(`/api/labs/${lab.id}/members`).send({ username: 'manager1' }).expect(404);
    await otherManager.delete(`/api/labs/${lab.id}`).expect(404);

    const { body } = await otherManager.get('/api/labs').expect(200);
    expect(body.labs).toEqual([]);
    expect(await countRows('labs')).toBe(1);
  });

  it('hides a lab from a member who was not added', async () => {
    const outsider = await registerUser('outsider', 'member');

    await outsider.get(`/api/labs/${lab.id}`).expect(404);
    await outsider.get(`/api/labs/${lab.id}/equipment`).expect(404);
    await reserve(outsider, lab.id, microscope.id, hoursFromNow(24), hoursFromNow(25)).expect(404);

    expect(await countRows('reservations')).toBe(0);
  });

  it('keeps manager actions from members of the lab', async () => {
    const luke = await registerUser('luke', 'member');
    await addMember(manager, lab.id, 'luke');

    await luke.post('/api/labs').send({ name: 'My Lab' }).expect(403);
    await luke.post(`/api/labs/${lab.id}/equipment`).send({ name: 'Scale' }).expect(403);
    await luke.get(`/api/labs/${lab.id}/members`).expect(403);
    await luke.get(`/api/labs/${lab.id}/stats`).expect(403);
    await luke.delete(`/api/labs/${lab.id}`).expect(403);
  });

  it('does not let a member cancel someone else\'s reservation', async () => {
    const luke = await registerUser('luke', 'member');
    const bob = await registerUser('bob', 'member');
    await addMember(manager, lab.id, 'luke');
    await addMember(manager, lab.id, 'bob');

    const booked = await reserve(luke, lab.id, microscope.id, hoursFromNow(24), hoursFromNow(25));
    const reservationPath = `/api/labs/${lab.id}/reservations/${booked.body.reservation.id}`;

    await bob.delete(reservationPath).expect(404);
    expect(await countRows('reservations')).toBe(1);

    //The lab's manager can remove anyone's.
    await manager.delete(reservationPath).expect(204);
    expect(await countRows('reservations')).toBe(0);
  });

  it('takes away lab access from a removed member but keeps their account', async () => {
    const luke = await registerUser('luke', 'member');
    const member = await addMember(manager, lab.id, 'luke');
    await luke.get(`/api/labs/${lab.id}`).expect(200);

    await manager.delete(`/api/labs/${lab.id}/members/${member.id}`).expect(204);

    await luke.get(`/api/labs/${lab.id}`).expect(404);
    await reserve(luke, lab.id, microscope.id, hoursFromNow(24), hoursFromNow(25)).expect(404);

    const { body } = await luke.get('/api/labs').expect(200);
    expect(body.labs).toEqual([]);

    await request(app).post('/api/auth/login').send({ username: 'luke', password: PASSWORD }).expect(200);
  });

  it('requires the user to be signed in', async () => {
    const signedOut = request(app);

    await signedOut.get('/api/labs').expect(401);
    await signedOut.get(`/api/labs/${lab.id}`).expect(401);
    await signedOut.post('/api/labs').send({ name: 'My Lab' }).expect(401);
  });
});

describe('database rules', () => {
  it('rejects a username that differs only by case', async () => {
    await registerUser('luke', 'member');

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'LUKE', password: PASSWORD, role: 'member' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
    expect(await countRows('users')).toBe(1);
  });

  it('rejects a duplicate lab name for the same manager only', async () => {
    const manager = await registerUser('manager1', 'manager');
    const otherManager = await registerUser('manager2', 'manager');
    await createLab(manager, 'Chem Lab');

    const res = await manager.post('/api/labs').send({ name: 'chem lab' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAB_NAME_TAKEN');
    await createLab(otherManager, 'Chem Lab');
  });

  it('rejects a duplicate equipment name until the first one is removed', async () => {
    const manager = await registerUser('manager1', 'manager');
    const lab = await createLab(manager);
    const microscope = await addEquipment(manager, lab.id, 'Microscope');

    const res = await manager.post(`/api/labs/${lab.id}/equipment`).send({ name: 'MICROSCOPE' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EQUIPMENT_NAME_TAKEN');

    await manager.delete(`/api/labs/${lab.id}/equipment/${microscope.id}`).expect(204);
    await addEquipment(manager, lab.id, 'Microscope');
  });

  it('rejects adding the same member twice', async () => {
    const manager = await registerUser('manager1', 'manager');
    await registerUser('luke', 'member');
    const lab = await createLab(manager);
    await addMember(manager, lab.id, 'luke');

    const res = await manager.post(`/api/labs/${lab.id}/members`).send({ username: 'luke' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_A_MEMBER');
    expect(await countRows('memberships')).toBe(1);
  });

  describe('reservation times', () => {
    let manager;
    let lab;
    let microscope;
    const START = hoursFromNow(24);
    const END = hoursFromNow(26);

    beforeEach(async () => {
      manager = await registerUser('manager1', 'manager');
      lab = await createLab(manager);
      microscope = await addEquipment(manager, lab.id);
      await reserve(manager, lab.id, microscope.id, START, END).expect(201);
    });

    it('rejects a reservation that overlaps another', async () => {
      const res = await reserve(manager, lab.id, microscope.id, hoursFromNow(25), hoursFromNow(27));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RESERVATION_OVERLAP');
      expect(await countRows('reservations')).toBe(1);
    });

    it('allows back-to-back reservations', async () => {
      await reserve(manager, lab.id, microscope.id, END, hoursFromNow(27)).expect(201);
      await reserve(manager, lab.id, microscope.id, hoursFromNow(23), START).expect(201);

      expect(await countRows('reservations')).toBe(3);
    });

    it('allows the same time on different equipment', async () => {
      const scale = await addEquipment(manager, lab.id, 'Scale');

      await reserve(manager, lab.id, scale.id, START, END).expect(201);
    });

    it('rejects an edit that overlaps another reservation', async () => {
      const later = await reserve(manager, lab.id, microscope.id, hoursFromNow(30), hoursFromNow(31));

      const res = await manager
        .patch(`/api/labs/${lab.id}/reservations/${later.body.reservation.id}`)
        .send({ startTime: hoursFromNow(25), endTime: hoursFromNow(27) });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RESERVATION_OVERLAP');
    });
  });

  it('deletes a lab\'s members, equipment and reservations with it but keeps the accounts', async () => {
    const manager = await registerUser('manager1', 'manager');
    const luke = await registerUser('luke', 'member');
    const lab = await createLab(manager);
    const microscope = await addEquipment(manager, lab.id);
    await addMember(manager, lab.id, 'luke');
    await reserve(luke, lab.id, microscope.id, hoursFromNow(24), hoursFromNow(25)).expect(201);

    await manager.delete(`/api/labs/${lab.id}`).expect(204);

    expect(await countRows('labs')).toBe(0);
    expect(await countRows('memberships')).toBe(0);
    expect(await countRows('equipment')).toBe(0);
    expect(await countRows('reservations')).toBe(0);
    expect(await countRows('users')).toBe(2);
    await luke.get(`/api/labs/${lab.id}`).expect(404);
  });
});
