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

## [milestone-1] — 2026-09-16

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
