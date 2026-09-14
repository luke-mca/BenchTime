# BenchTime

A lab equipment reservation system for university laboratory and maker spaces.

Lab managers create a lab, register its equipment, and add members by username. Members browse
the equipment in their labs and book open time slots. Overlapping reservations are rejected,
and managers get utilization statistics for maintenance and purchasing decisions.

**CS415/515 — Fall 2026**
Luke McArthur (lgmcarthur@crimson.ua.edu) · Jesse Seidel (jpseidel@crimson.ua.edu)

## Status

Mileston 1 has begun. Scaffolding has been implemented. Has a basic webpage for viewing a health endpoint. 

## Stack

We are using React 19 on the client, Node.js + Express 5 on the server, PostgreSQL for storage. Three-tier
client–server: only the backend interacts with the database, and all permission checks happen on the
server. See [docs/architecture.md](docs/architecture.md) for the diagrams and data model.

## Getting started

**Prerequisites:** Node.js 20+, npm, PostgreSQL 16+, postgrator. 

```bash
git clone https://github.com/luke-mca/BenchTime.git
cd BenchTime

# Server
cd server
cp .env.example .env      # then fill in all the fields. 
npm install
npm run migrate           # make sure your sql database is running. 
npm run dev               # http://localhost:3000

# Client (second terminal)
cd client
npm install
npm run dev               # http://localhost:5173(open this in your browser). 
```

Configuration comes from a `.env` file that is never committed. `.env.example` documents every
variable.

### Tests

```bash
cd server && npm test
cd client && npm test
```

## Layout

```
BACKLOG.md     Prioritized user stories and requirements
CHANGELOG.md   Notable changes per release
docs/          Architecture, data model, milestone reports
client/        React front end            (Sprint 1)
server/        Express API and migrations (Sprint 1)
```

## Working agreement

Two-week sprints, two per milestone. Work is tracked as GitHub Issues; `main` is protected, and
every change lands through a pull request reviewed by the other member. `main` is tagged at each
milestone.

A task is considered done when it does what the issue asked, has been reviewed and merged through a pull
request, has tests and the suite passes(if applicable), and the app still runs from a fresh clone using the
instructions above.

## Contribution statements — Milestone 0

**Luke McArthur** — Wrote the initial design and architecture, data model, agile development
process, milestone plan, team responsibilities, and risk analysis, and set up the repository,
README, backlog, and architecture diagram.

**Jesse Seidel** — Wrote the executive summary, target users and personas, proposed application,
MVP scope, initial requirements (user stories, acceptance criteria, and the functional and
non-functional requirement tables), and the success criteria.

## Documents

- [Prioritized backlog](BACKLOG.md)
- [Architecture and data model](docs/architecture.md)
- [Milestone 0 proposal report](docs/milestone-0/)
