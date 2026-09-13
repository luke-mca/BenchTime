# BenchTime — Prioritized Backlog

Last updated: 2026-09-02 (Milestone 0)

## How this backlog works

Priority levels:

| Priority | Meaning |
| --- | --- |
| **High** | Must be in the MVP — Milestone 1 |
| **Medium** | Improves the product substantially: target Milestone 2 |
| **Low** | Valuable, added if time allows: Milestone 3 |

Points are on a 1–5 scale and estimate **complexity**, not elapsed time.

Items are worked top to bottom. Each story becomes a GitHub Issue with its acceptance criteria
copied in before anyone starts on it, and is closed only when it meets the Definition of Done
in the [README](README.md#development-process).

**Totals:** High 30 pts · Medium 10 pts · Low 8 pts

---

## High priority — MVP (Milestone 1)

### US-1 — Member registration · 5 pts
> As a prospective member, I want to register as a member with a unique username and password
> so that I can begin reserving equipment.

**Acceptance criteria**
- A prospective member can reach a sign-up page and register as a member.
- Sign-up requires a username unique across *all* users (members and managers) and a password.
- The account is persisted to the database so it can be retrieved later.
- The password is stored as a hash, never plaintext (NFR-2).
- A duplicate username is rejected with a message saying why (NFR-6).

**Requirements:** FR-1, FR-3, NFR-1, NFR-2, NFR-6

---

### US-6 — Lab manager registration · 5 pts
> As a prospective lab manager, I want to register as a lab manager with a unique username and
> password so that I can begin managing equipment.

**Acceptance criteria**
- A prospective lab manager can reach the sign-up page and register with the manager role.
- Sign-up requires a username unique across all users and a password.
- The account and its role are persisted to the database.
- Signing in as a manager grants manager permissions; role is enforced on the server.

**Requirements:** FR-1, FR-2, FR-3, NFR-2

---

### US-7 — Create an equipment calendar · 3 pts
> As a lab manager, I want to create an equipment calendar so that I can begin inviting members
> to make reservations.

**Acceptance criteria**
- A signed-in manager can create a new lab and give it a name.
- The lab is persisted and linked to its manager owner.
- After creation the manager is taken to the new lab, where US-8 and US-9 apply.
- Members cannot create labs; the server rejects the attempt.

**Requirements:** FR-3, FR-6

---

### US-9 — Add and remove equipment · 4 pts
> As a lab manager, I want to add and remove equipment from my equipment calendar so members can
> make reservations.

**Acceptance criteria**
- A manager can view a lab they created and add a piece of equipment with a name and description.
- A manager can remove equipment from that lab.
- Removal is a **soft delete** so historical reservations survive for usage statistics.
- Changes are persisted and linked to that specific lab.
- Only the owning manager can add or remove equipment, enforced server-side.

**Requirements:** FR-3, FR-5, FR-7

---

### US-8 — Add members to a lab · 3 pts
> As a lab manager, I want to invite members to an equipment calendar so that they can begin
> making reservations.

**Acceptance criteria**
- A manager can view a lab they own and add a member to it by username.
- The membership is persisted so it can be retrieved later.
- An unknown username is rejected with a message saying why.
- Only the owning manager can add members.

**Requirements:** FR-3, FR-9

---

### US-2 — Member is added to a lab · 3 pts
> As a member, I want to be added to an equipment calendar by a lab manager so I can begin
> reserving equipment.

**Acceptance criteria**
- After being added, the lab appears in the member's list of labs on sign-in.
- The member can then use US-3 and US-4 within that lab.
- A member cannot see or reach a lab they have no membership in — enforced on the server, not
  by hiding UI.

**Requirements:** FR-3, FR-9

---

### US-3 — View equipment in a lab · 3 pts
> As a member, I want to see all available machines in a given equipment calendar.

**Acceptance criteria**
- A member with a membership in a lab sees every active piece of equipment in that lab, read
  from the database.
- Soft-deleted equipment is not listed.
- A member without a membership is denied.

**Requirements:** FR-3, FR-5

---

### US-4 — Reserve equipment · 4 pts
> As a member, I want to reserve a piece of equipment during an open time slot so that it is
> reserved for me when I arrive.

**Acceptance criteria**
- A member can view current reservations for a specific piece of equipment.
- A member can create a reservation with a start and end time.
- A reservation that does not overlap an existing one is persisted and linked to that equipment
  and lab.
- An overlapping reservation is **rejected by the database constraint**, not only by an
  application-level check, and the member is told why (NFR-6).
- A newly registered member can complete a reservation in no more than five interactions from
  the sign-in page (NFR-5).

**Requirements:** FR-3, FR-4, FR-8, NFR-5, NFR-6

---

## Medium priority (Milestone 2)

Acceptance criteria for these are written before the sprint that picks them up.

### US-5 — Cancel my own reservation · 2 pts
> As a member, I want to cancel a reservation I no longer need so that someone else can reserve
> during that time.

### US-10 — Manager edits reservations in their labs · 3 pts
> As a lab manager, I want to edit the reservations under the equipment calendars I own so that
> I can resolve conflicts and misuse.

### US-11 — Utilization statistics · 5 pts
> As a manager, I want to view utilization statistics for every piece of equipment so that I can
> make informed decisions about purchases and maintenance.

---

## Low priority (Milestone 3, if time allows)

### US-12 — Recurring reservations · 3 pts
> As a member, I would like to set up a recurring/repeating reservation so that I can avoid
> having to enter many reservations manually.

### US-13 — University single sign-on · 5 pts
> As a lab manager, I would like to sign in using my university email so that I can only add
> members to equipment calendars that are from my university.

---

## Explicitly out of scope for the MVP

| Item | Why deferred |
| --- | --- |
| Notifications / reservation reminders | Useful, but not needed for minimal functionality |
| Real-time server push | Periodic client refresh demonstrates every MVP feature without a persistent connection |
| Multiple managers per lab | Useful for shared labs; not needed for minimal functionality |
| Enforcement of correct equipment use | BenchTime is a reservation system; enforcement is the manager's job |
| Mobile or desktop clients | Web only |
| Financial transactions | Not a goal of the project |

---

## Requirements reference

### Functional

| ID | Description |
| --- | --- |
| FR-1 | The system shall allow member/lab manager registration with a unique username and password. |
| FR-2 | The system shall authenticate users by username and password. |
| FR-3 | The system shall support two roles — member and lab manager — and shall enforce role permissions for every operation. |
| FR-4 | The system shall restrict modification (creation and cancellation) of a reservation to its member owner and the lab manager. |
| FR-5 | The system shall maintain a list of equipment linked to every lab. |
| FR-6 | The system shall maintain a list of labs linked to their lab manager owner. |
| FR-7 | The system shall allow managers to add and remove equipment from their labs. |
| FR-8 | The system shall allow an authenticated member to reserve a time slot for a specific piece of equipment. |
| FR-9 | The system shall allow a lab manager to add a member to a lab they own. |

### Non-functional

| ID | Description |
| --- | --- |
| NFR-1 | The system shall collect only a username, password, and possibly an email (see US-13). No other personally identifiable information shall be collected. |
| NFR-2 | The system shall store passwords using a hashing algorithm, never plaintext. |
| NFR-3 | No secret or credential shall be committed to version control. Configuration is supplied via a documented `.env` file. |
| NFR-4 | All website functionality shall be achievable on a desktop/laptop with keyboard and mouse alone. |
| NFR-5 | A newly registered member shall be able to complete a reservation in no more than five interactions, starting from the sign-in page. |
| NFR-6 | Any rejected action shall produce an error message stating the reason for the rejection. |

---

## Risk register

Reviewed and updated at the end of each sprint.

| Risk | Type | Impact | Mitigation |
| --- | --- | --- | --- |
| Two people book the same equipment at the same time | Technical | High | PostgreSQL exclusion constraint rejects the overlap at the database level (INF-4) |
| Midterms and fall break fall near milestone deadlines | Schedule | Medium | Plan ahead and front-load work so nothing is crammed at the end |
| A user reaches a lab they are not a member of | Security | High | Every endpoint checks permissions server-side; client-side hiding is never the control |
| A bad migration corrupts the database | Data | High | Test every migration locally before it merges |
