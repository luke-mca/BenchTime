# Changelog

Notable changes to BenchTime. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [milestone-0] — 2026-09-02

### Added

- Project proposal report for Milestone 0 (`docs/milestone-0/`).
- README with problem statement, planned tech stack, setup instructions, development process,
  Definition of Done, milestone plan, success criteria, and contribution statements.
- Prioritized backlog (`BACKLOG.md`) — 13 user stories with priorities, complexity points, and
  acceptance criteria for every High-priority story, plus the functional/non-functional
  requirement tables and the risk register.
- Initial architecture (`docs/architecture.md`) — system-context and container diagrams, the
  data model, and the reservation overlap strategy.
- `.gitignore` covering dependencies, build output, coverage, and `.env` secrets.

## [milestone-1] — 2026-09-13

### Added 

- Server folder with scafolding for basic health/database endpoints. 
- Example .env file within the server folder. 
- Client folder with a basic webpage that displays the status of the health endpoint. 
- .sql files with the data base format. 
- js migration file under server/db/scripts for automatically migrating the database. 

## [Unreleased]

### Added 

- Added labs.js endpoints with SQL queries for interacting with the db(as needed to display lab pages). 
- Added me.js to allow the client to authenticate themselves(temporary). 
- Added auth.js with the authentication used by labs.js. 
- Added LabPage.jsx and LabsPage.jsx for displaying all labs belonging to a logged in lab manager and all all members inside of each lab. 
- Allowed a signed in manager to 1: create labs and 2: add members to a lab. 

## [Unreleased]

### Added

- Member and lab manager registration and login (US-1, US-6). Passwords are hashed with bcrypt.
- JWT authentication: a 15-minute access token and a 7-day refresh token, both in httpOnly cookies.
  Endpoints: `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, and `GET /api/auth/me`.
- `requireAuth` and `requireRole` middleware for server-side permission checks (FR-3).
- Consistent `{ error: { code, message } }` error responses (NFR-6).
- Client routing with a landing page, login and sign-up pages, and a role-based home placeholder.
- Tailwind CSS for client styling.

### Changed

- `SESSION_SECRET` replaced by `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` in `server/.env`.

## [Unreleased]

### Added 
- Services, routes, and repository files so that a client who is logged in as a manager can create a lab/view the members that are part of that lab. All of these were implemented with FR-3 and FR-6 in mind. 
- The ability for managers to view the labs they own and add new labs. 
- The ability for managers to view a web page associated with each lab. 

### Changed 
- errors.js was updated with some more errors according to (NFR-6). 

## [Unreleased]

### Added 
- Services, routes, and repository files so that a manager can add/delete members from a lab and so members can see the labs theyve been added to.
- All of these were implemented with FR-3 and FR-9 in mind. 
- The ability for managers to add members to the labs they own and remove them if needed. 
- The ability for members to see the labs they have been added to and be taken to a page associated with each lab. 

### Changed 
- labRepository.js, labs.js, labService.js, Home.jsx, and LabPage.jsx to implement the above mentioned changes. 

## [Unreleased]

### Added 
- equipmentRepository.js plus `GET /api/labs/:id/equipment` and `POST /api/labs/:id/equipment` so a manager can add equipment (name and optional description) to a lab they own (US-9, FR-5, FR-7).
- Managers and the lab's members can view that lab's active equipment. Anyone else gets a not found error (US-3, FR-3).
- `DELETE /api/labs/:id/equipment/:equipmentId` so a manager can remove equipment from a lab they own. This is a soft delete (`active = false`) so past reservations are kept for usage statistics (US-9, FR-7).
- Migration 003 so a lab cannot have two active pieces of equipment with the same name. Removed equipment is left out so its name can be reused.

- Lab cards on the home page show how many members and pieces of equipment each lab has.
- The lab page shows who manages the lab, for both the manager and the lab's members.

### Changed 
- Every lab returned by the API now includes `ownerUsername`, `memberCount`, and `equipmentCount`.
- labRepository.js, labService.js, labs.js, api.js, Home.jsx, and LabPage.jsx to implement the above mentioned changes. 