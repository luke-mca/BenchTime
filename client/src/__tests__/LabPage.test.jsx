import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LabPage } from '../components/LabPage.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';

vi.mock('../lib/AuthContext.jsx', async (importOriginal) => ({
  ...(await importOriginal()),
  useAuth: vi.fn(),
}));

vi.mock('../lib/api.js', () => ({
  api: {
    getLab: vi.fn(),
    getStats: vi.fn(),
    listEquipment: vi.fn(),
    addEquipment: vi.fn(),
    removeEquipment: vi.fn(),
    listMembers: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    listReservations: vi.fn(),
    createReservation: vi.fn(),
    updateReservation: vi.fn(),
    cancelReservation: vi.fn(),
  },
}));

const MANAGER = { id: '7', username: 'boss', role: 'manager' };
const MEMBER = { id: '8', username: 'alice', role: 'member' };
const LAB = { id: '5', name: 'Chem Lab', ownerUsername: 'boss', createdAt: '2026-10-01T00:00:00.000Z' };
const MICROSCOPE = { id: '9', name: 'Microscope', description: 'Zeiss', createdAt: '2026-10-01T00:00:00.000Z' };
const ALICE = { id: '8', username: 'alice', addedAt: '2026-10-02T00:00:00.000Z' };
const GENERIC_ERROR = 'Something went wrong. Please try again.';
const OVERLAP_MESSAGE = 'That time overlaps an existing reservation. Pick a different time.';

const MY_RESERVATION = {
  id: '100',
  equipmentId: '9',
  username: 'alice',
  startTime: '2030-01-20T15:00:00.000Z',
  endTime: '2030-01-20T16:00:00.000Z',
  isMine: true,
};
const BOBS_RESERVATION = {
  id: '101',
  equipmentId: '9',
  username: 'bob',
  startTime: '2030-01-21T15:00:00.000Z',
  endTime: '2030-01-21T16:00:00.000Z',
  isMine: false,
};

function apiError(message, code) {
  return Object.assign(new Error(message), { status: 409, code });
}

function statsItem(overrides = {}) {
  return {
    id: '9',
    name: 'Microscope',
    removed: false,
    reservationCount: 2,
    totalHours: 8,
    hoursByWeekday: Array(7).fill(0),
    hoursByHour: Array(24).fill(0),
    ...overrides,
  };
}

function renderLab(user = MANAGER) {
  useAuth.mockReturnValue({ user });
  return render(
    <MemoryRouter initialEntries={['/labs/5']}>
      <Routes>
        <Route path="/labs/:labId" element={<LabPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

//Renders the lab and opens the Microscope's schedule.
async function openSchedule(user = MANAGER) {
  renderLab(user);
  await userEvent.click(await screen.findByRole('button', { name: 'Reserve' }));
  await screen.findByRole('heading', { name: 'Upcoming reservations' });
}

beforeEach(() => {
  vi.resetAllMocks();
  api.getLab.mockResolvedValue({ lab: LAB });
  api.getStats.mockResolvedValue({ stats: { weeks: 4, equipment: [] } });
  api.listEquipment.mockResolvedValue({ equipment: [MICROSCOPE] });
  api.listMembers.mockResolvedValue({ members: [ALICE] });
  api.listReservations.mockResolvedValue({ reservations: [] });
  api.removeEquipment.mockResolvedValue(null);
  api.removeMember.mockResolvedValue(null);
  api.cancelReservation.mockResolvedValue(null);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('LabPage', () => {
  it('shows loading until the lab arrives', () => {
    api.getLab.mockReturnValue(new Promise(() => {}));
    renderLab();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Back to your labs' })).toHaveAttribute('href', '/');
  });

  it('shows the error when the lab cannot be loaded', async () => {
    api.getLab.mockRejectedValue(new Error('That lab does not exist.'));
    renderLab();

    expect(await screen.findByRole('alert')).toHaveTextContent('That lab does not exist.');
  });

  it('shows a manager the equipment, members and utilization sections', async () => {
    renderLab(MANAGER);

    expect(await screen.findByRole('heading', { name: 'Chem Lab' })).toBeInTheDocument();
    expect(api.getLab).toHaveBeenCalledWith('5');
    expect(screen.getByRole('heading', { name: 'Equipment' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Utilization' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add equipment' })).toBeInTheDocument();
  });

  it('only shows a member the equipment and never loads manager data', async () => {
    renderLab(MEMBER);

    expect(await screen.findByText('Microscope')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Members' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Utilization' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add equipment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Microscope' })).not.toBeInTheDocument();
    expect(api.listMembers).not.toHaveBeenCalled();
    expect(api.getStats).not.toHaveBeenCalled();
  });
});

describe('equipment', () => {
  it('lists equipment with its description', async () => {
    renderLab();

    expect(await screen.findByText('Microscope')).toBeInTheDocument();
    expect(screen.getByText('Zeiss')).toBeInTheDocument();
  });

  it('tells a manager how to add the first piece of equipment', async () => {
    api.listEquipment.mockResolvedValue({ equipment: [] });
    renderLab(MANAGER);

    expect(await screen.findByText('This lab doesn\'t have any equipment yet.')).toBeInTheDocument();
    expect(screen.getByText('Use Add equipment to add the first one.')).toBeInTheDocument();
  });

  it('does not tell a member to add equipment', async () => {
    api.listEquipment.mockResolvedValue({ equipment: [] });
    renderLab(MEMBER);

    expect(await screen.findByText('This lab doesn\'t have any equipment yet.')).toBeInTheDocument();
    expect(screen.queryByText('Use Add equipment to add the first one.')).not.toBeInTheDocument();
  });

  it('shows the error when equipment cannot be loaded', async () => {
    api.listEquipment.mockRejectedValue(new Error('Could not load equipment.'));
    renderLab();

    expect(await screen.findByText('Could not load equipment.')).toBeInTheDocument();
  });

  it('adds equipment, keeps the list sorted and closes the form', async () => {
    api.addEquipment.mockResolvedValue({ equipment: { id: '10', name: 'Centrifuge', description: 'Fast' } });
    renderLab();
    await screen.findByText('Microscope');

    await userEvent.click(screen.getByRole('button', { name: 'Add equipment' }));
    await userEvent.type(screen.getByLabelText('Equipment name'), 'Centrifuge');
    await userEvent.type(screen.getByLabelText(/Description/), 'Fast');
    await userEvent.click(screen.getByRole('button', { name: 'Add Equipment' }));

    expect(api.addEquipment).toHaveBeenCalledWith('5', { name: 'Centrifuge', description: 'Fast' });
    const names = await screen.findAllByText(/^(Centrifuge|Microscope)$/);
    expect(names.map((name) => name.textContent)).toEqual(['Centrifuge', 'Microscope']);
    expect(screen.queryByLabelText('Equipment name')).not.toBeInTheDocument();
  });

  it.each([
    ['the server error', apiError('This lab already has equipment named "Scope".', 'EQUIPMENT_NAME_TAKEN'), 'This lab already has equipment named "Scope".'],
    ['a generic error', new Error('Failed to fetch'), GENERIC_ERROR],
  ])('shows %s when adding equipment fails', async (_label, error, message) => {
    api.addEquipment.mockRejectedValue(error);
    renderLab();
    await screen.findByText('Microscope');

    await userEvent.click(screen.getByRole('button', { name: 'Add equipment' }));
    await userEvent.type(screen.getByLabelText('Equipment name'), 'Scope');
    await userEvent.click(screen.getByRole('button', { name: 'Add Equipment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('Equipment name')).toHaveValue('Scope');
  });

  it('removes equipment after the manager confirms', async () => {
    renderLab();

    await userEvent.click(await screen.findByRole('button', { name: 'Remove Microscope' }));

    expect(window.confirm).toHaveBeenCalledWith('Remove Microscope from this lab?');
    expect(api.removeEquipment).toHaveBeenCalledWith('5', '9');
    await waitFor(() => expect(screen.queryByText('Zeiss')).not.toBeInTheDocument());
  });

  it('keeps equipment when the manager declines the confirm', async () => {
    window.confirm.mockReturnValue(false);
    renderLab();

    await userEvent.click(await screen.findByRole('button', { name: 'Remove Microscope' }));

    expect(api.removeEquipment).not.toHaveBeenCalled();
    expect(screen.getByText('Zeiss')).toBeInTheDocument();
  });

  it('keeps equipment and shows an error when removing fails', async () => {
    api.removeEquipment.mockRejectedValue(new Error('Failed to fetch'));
    renderLab();

    await userEvent.click(await screen.findByRole('button', { name: 'Remove Microscope' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR);
    expect(screen.getByText('Zeiss')).toBeInTheDocument();
  });
});

describe('reservation schedule', () => {
  it('opens and closes the schedule', async () => {
    await openSchedule();

    expect(api.listReservations).toHaveBeenCalledWith('5', '9');
    expect(await screen.findByText('No upcoming reservations. Every time is open.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hide schedule' }));

    expect(screen.queryByRole('heading', { name: 'Upcoming reservations' })).not.toBeInTheDocument();
  });

  it('shows "You" for the user\'s own reservation and a username for others', async () => {
    api.listReservations.mockResolvedValue({ reservations: [MY_RESERVATION, BOBS_RESERVATION] });
    await openSchedule(MEMBER);

    expect(await screen.findByText('You')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('shows the error when the schedule cannot be loaded', async () => {
    api.listReservations.mockRejectedValue(new Error('Could not load reservations.'));
    await openSchedule();

    expect(await screen.findByText('Could not load reservations.')).toBeInTheDocument();
  });
});

describe('booking a reservation', () => {
  it('suggests a one hour slot when the start is picked first', async () => {
    await openSchedule(MEMBER);

    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2030-01-15T10:00' } });

    expect(screen.getByLabelText('End')).toHaveValue('2030-01-15T11:00');
  });

  it('books the time, keeps the list sorted and clears the form', async () => {
    api.listReservations.mockResolvedValue({ reservations: [BOBS_RESERVATION] });
    api.createReservation.mockResolvedValue({
      reservation: {
        ...MY_RESERVATION,
        username: 'carol',
        isMine: false,
        startTime: '2030-01-15T15:00:00.000Z',
        endTime: '2030-01-15T16:00:00.000Z',
      },
    });
    await openSchedule(MEMBER);
    await screen.findByText('bob');

    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2030-01-15T10:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Reserve' }));

    expect(api.createReservation).toHaveBeenCalledWith('5', '9', {
      startTime: new Date('2030-01-15T10:00').toISOString(),
      endTime: new Date('2030-01-15T11:00').toISOString(),
    });
    const usernames = await screen.findAllByText(/^(bob|carol)$/);
    expect(usernames.map((name) => name.textContent)).toEqual(['carol', 'bob']);
    expect(screen.getByLabelText('Start')).toHaveValue('');
    expect(screen.getByLabelText('End')).toHaveValue('');
  });

  it('shows the error and reloads the schedule when the time was just taken', async () => {
    api.createReservation.mockRejectedValue(apiError(OVERLAP_MESSAGE, 'RESERVATION_OVERLAP'));
    await openSchedule(MEMBER);
    expect(api.listReservations).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2030-01-15T10:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Reserve' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(OVERLAP_MESSAGE);
    await waitFor(() => expect(api.listReservations).toHaveBeenCalledTimes(2));
  });

  it('does not reload the schedule for other errors', async () => {
    api.createReservation.mockRejectedValue(apiError('A reservation can be at most 6 hours long.', 'RESERVATION_TOO_LONG'));
    await openSchedule(MEMBER);

    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2030-01-15T10:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Reserve' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A reservation can be at most 6 hours long.');
    expect(api.listReservations).toHaveBeenCalledTimes(1);
  });
});

describe('cancelling a reservation', () => {
  it('only lets a member cancel their own reservation', async () => {
    api.listReservations.mockResolvedValue({ reservations: [MY_RESERVATION, BOBS_RESERVATION] });
    await openSchedule(MEMBER);
    await screen.findByText('bob');

    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('cancels only after a member clicks Cancel and then Confirm', async () => {
    api.listReservations.mockResolvedValue({ reservations: [MY_RESERVATION] });
    await openSchedule(MEMBER);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(api.cancelReservation).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(api.cancelReservation).toHaveBeenCalledWith('5', '100');
    await waitFor(() => expect(screen.queryByText('You')).not.toBeInTheDocument());
  });

  it('backs out of the confirm when the member clicks away', async () => {
    api.listReservations.mockResolvedValue({ reservations: [MY_RESERVATION] });
    await openSchedule(MEMBER);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('heading', { name: 'Chem Lab' }));

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(api.cancelReservation).not.toHaveBeenCalled();
  });

  it('lets a manager remove anyone\'s reservation after confirming', async () => {
    api.listReservations.mockResolvedValue({ reservations: [BOBS_RESERVATION] });
    await openSchedule(MANAGER);

    await userEvent.click(await screen.findByRole('button', { name: 'Remove bob\'s reservation' }));

    expect(window.confirm).toHaveBeenCalledWith('Remove bob\'s reservation?');
    expect(api.cancelReservation).toHaveBeenCalledWith('5', '101');
    await waitFor(() => expect(screen.queryByText('bob')).not.toBeInTheDocument());
  });

  it('keeps the reservation when the manager declines the confirm', async () => {
    window.confirm.mockReturnValue(false);
    api.listReservations.mockResolvedValue({ reservations: [BOBS_RESERVATION] });
    await openSchedule(MANAGER);

    await userEvent.click(await screen.findByRole('button', { name: 'Remove bob\'s reservation' }));

    expect(api.cancelReservation).not.toHaveBeenCalled();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('keeps the reservation and shows an error when cancelling fails', async () => {
    api.cancelReservation.mockRejectedValue(new Error('Failed to fetch'));
    api.listReservations.mockResolvedValue({ reservations: [BOBS_RESERVATION] });
    await openSchedule(MANAGER);

    await userEvent.click(await screen.findByRole('button', { name: 'Remove bob\'s reservation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR);
    expect(screen.getByText('bob')).toBeInTheDocument();
  });
});

describe('editing a reservation', () => {
  //The edit form sits in the list, so its fields come before the booking form's.
  async function openEdit() {
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    return { start: screen.getAllByLabelText('Start')[0], end: screen.getAllByLabelText('End')[0] };
  }

  it('lets a manager change the times and closes the form', async () => {
    api.listReservations.mockResolvedValue({ reservations: [BOBS_RESERVATION] });
    api.updateReservation.mockResolvedValue({ reservation: BOBS_RESERVATION });
    await openSchedule(MANAGER);

    const { start, end } = await openEdit();
    fireEvent.change(start, { target: { value: '2030-02-01T09:00' } });
    fireEvent.change(end, { target: { value: '2030-02-01T10:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(api.updateReservation).toHaveBeenCalledWith('5', '101', {
      startTime: new Date('2030-02-01T09:00').toISOString(),
      endTime: new Date('2030-02-01T10:00').toISOString(),
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument());
  });

  it('keeps the form open and reloads the schedule on an overlap', async () => {
    api.listReservations.mockResolvedValue({ reservations: [BOBS_RESERVATION] });
    api.updateReservation.mockRejectedValue(apiError(OVERLAP_MESSAGE, 'RESERVATION_OVERLAP'));
    await openSchedule(MANAGER);

    await openEdit();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(OVERLAP_MESSAGE);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    await waitFor(() => expect(api.listReservations).toHaveBeenCalledTimes(2));
  });
});

describe('members', () => {
  it('lists the members of the lab', async () => {
    renderLab();

    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(api.listMembers).toHaveBeenCalledWith('5');
  });

  it('shows a message when the lab has no members', async () => {
    api.listMembers.mockResolvedValue({ members: [] });
    renderLab();

    expect(await screen.findByText('This lab doesn\'t have any members yet.')).toBeInTheDocument();
  });

  it('adds a member, keeps the list sorted and closes the form', async () => {
    api.addMember.mockResolvedValue({ member: { id: '11', username: 'aaron', addedAt: ALICE.addedAt } });
    renderLab();
    await screen.findByText('alice');

    await userEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await userEvent.type(screen.getByLabelText('Member username'), 'aaron');
    await userEvent.click(screen.getByRole('button', { name: 'Add Member' }));

    expect(api.addMember).toHaveBeenCalledWith('5', 'aaron');
    const usernames = await screen.findAllByText(/^(aaron|alice)$/);
    expect(usernames.map((name) => name.textContent)).toEqual(['aaron', 'alice']);
    expect(screen.queryByLabelText('Member username')).not.toBeInTheDocument();
  });

  it('shows the server error when adding a member fails', async () => {
    api.addMember.mockRejectedValue(apiError('alice is already a member of this lab.', 'ALREADY_A_MEMBER'));
    renderLab();
    await screen.findByText('alice');

    await userEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await userEvent.type(screen.getByLabelText('Member username'), 'alice');
    await userEvent.click(screen.getByRole('button', { name: 'Add Member' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('alice is already a member of this lab.');
  });

  it('removes a member', async () => {
    renderLab();

    await userEvent.click(await screen.findByRole('button', { name: 'Remove alice' }));

    expect(api.removeMember).toHaveBeenCalledWith('5', '8');
    await waitFor(() => expect(screen.queryByText('alice')).not.toBeInTheDocument());
  });

  it('keeps the member and shows an error when removing fails', async () => {
    api.removeMember.mockRejectedValue(new Error('Failed to fetch'));
    renderLab();

    await userEvent.click(await screen.findByRole('button', { name: 'Remove alice' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR);
    expect(screen.getByText('alice')).toBeInTheDocument();
  });
});

describe('utilization', () => {
  //Locale formatting is built the same way as the component so these pass in any locale.
  const tuesday = new Date(2024, 0, 2).toLocaleDateString([], { weekday: 'long' });
  const formatHour = (hour) => new Date(2024, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' });

  async function findStatsRow(name) {
    const table = await screen.findByRole('table');
    return within(within(table).getByRole('row', { name }));
  }

  it('shows weekly averages and the busiest day and hour', async () => {
    const hoursByWeekday = [1, 5, 2, 0, 0, 0, 0];
    const hoursByHour = Array(24).fill(0);
    hoursByHour[14] = 6;
    hoursByHour[9] = 2;
    api.getStats.mockResolvedValue({ stats: { weeks: 4, equipment: [statsItem({ hoursByWeekday, hoursByHour })] } });
    renderLab();

    const row = await findStatsRow(/Microscope/);

    expect(row.getByText('2.0')).toBeInTheDocument();
    expect(row.getByText('0.5')).toBeInTheDocument();
    expect(row.getByText(tuesday)).toBeInTheDocument();
    expect(row.getByText(`${formatHour(14)} – ${formatHour(15)}`)).toBeInTheDocument();
  });

  it('wraps the busiest hour range around midnight', async () => {
    const hoursByHour = Array(24).fill(0);
    hoursByHour[23] = 1;
    api.getStats.mockResolvedValue({ stats: { weeks: 4, equipment: [statsItem({ hoursByHour })] } });
    renderLab();

    const row = await findStatsRow(/Microscope/);

    expect(row.getByText(`${formatHour(23)} – ${formatHour(0)}`)).toBeInTheDocument();
  });

  it('shows dashes when equipment has no reserved hours', async () => {
    api.getStats.mockResolvedValue({
      stats: { weeks: 4, equipment: [statsItem({ reservationCount: 0, totalHours: 0 })] },
    });
    renderLab();

    const row = await findStatsRow(/Microscope/);

    expect(row.getAllByText('—')).toHaveLength(2);
    expect(row.getAllByText('0.0')).toHaveLength(2);
  });

  it('labels equipment that has been removed', async () => {
    api.getStats.mockResolvedValue({ stats: { weeks: 4, equipment: [statsItem({ removed: true })] } });
    renderLab();

    const row = await findStatsRow(/Microscope/);

    expect(row.getByText('(removed)')).toBeInTheDocument();
  });

  it('shows a message when there is no equipment to report on', async () => {
    renderLab();

    expect(await screen.findByText('Add equipment to see its utilization here.')).toBeInTheDocument();
  });

  it('shows the error when stats cannot be loaded', async () => {
    api.getStats.mockRejectedValue(new Error('Could not load stats.'));
    renderLab();

    expect(await screen.findByText('Could not load stats.')).toBeInTheDocument();
  });
});
