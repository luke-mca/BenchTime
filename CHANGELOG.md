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
