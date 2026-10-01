# BenchTime

A lab equipment reservation system for university laboratory and maker spaces.

Lab managers create a lab, register its equipment, and add members by username. Members browse
the equipment in their labs and book open time slots. Overlapping reservations are rejected,
and managers get utilization statistics for maintenance and purchasing decisions.

**CS415/515 — Fall 2026**
Luke McArthur (lgmcarthur@crimson.ua.edu) · Jesse Seidel (jpseidel@crimson.ua.edu)

## Status

Milestone 1 has been finished. Tasks considered vital to the MVP have been completed. See BACKLOG.md for details. 

## Stack

We are using React 19 on the client, Node.js + Express 5 on the server, PostgreSQL for storage. Three-tier
client–server: only the backend interacts with the database, and all permission checks happen on the
server. See [docs/architecture.md](docs/architecture.md) for the diagrams and data model.

## Getting started

### Required Software 
- Node.js: versions 24.19.0
- npm: version 11.17 
- PostgreSQL: version 18. 
- pgAdmin 4 : version 9.17. NOTE: This is not required, but is useful for viewing the SQL tables. 
- NOTE: Slightly older/newer versions of the above software should work, but those versions were specifically tested.

### Create the Database
```bash 
#Clone the repo 
git clone https://github.com/luke-mca/BenchTime
cd BenchTime 
```
- NOTE: the command CREATE DATABSE [your database name] should create the db using postgreSQL directly if you do not want to use pgAdmin. Just make sure the database can communicate on a port(default is 5432) and you have its URL(see .env.example for details). 
- Open pgAdmin 4. 
- Right click on your server(or create one under the main server group if needed). 
- Click Create then Database. 
- Give the database a name and make sure its exposed on a port so it can communicate with the BenchTime server. 
- Make sure the database is running when you run the BenchTime server. 

### Configure the server/.env file. 
```bash 
cd server 
#If this does not work just copy .env.example manually and rename it .env. 
cp .env.example .env 
```
- Fill out the .env file according to the comments. 

### Install Depdendencies 
```bash 
#This should install all dependencies to run both the client and the server. 
cd server && npm install 
cd ../client && npm install 
```

### Database Migration 
```bash 
cd server/scripts 
npm run migrate
```
- This will place all of the necessary tables in your SQL database. NOTE: This requires a valid database URL in your .env file. 

### Run the app 
```bash 
cd server && npm run dev 
#Switch to another terminal 
cd client && npm run dev 
```
- Open http://localhost:5173 in your browser or whatever URL you specified in the .env file. 

### Authentication/Accounts
- No accounts are included in the database. 
- You must create any demo accounts(Member/Manager) that you want to use. 
- To start, click the "Sign Up" button on the home page. 

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

## Definition of Done 
This definition of done has been taken from milestone 0 and modified to reflect the changes we plan to make while working on milestone 2. Our definition of done is that a task is not finished until:
- It does what the issue asked and we have tested it in a running version. 
- It has been reviewed and merged into main through a pull request. Since we are a group of two people, code review will be done by the other person. Any conflicts here will relay the task being finished until an agreement is reached. 
- It has tests, and the whole test suite still passes. “Passes” here means passing the automated testing via a CI/CD pipeline and not the manual testing done for milestone 1. 
The app still runs from a fresh clone using the setup instructions in the README. This will be done using the CI/CD pipeline. 


## Contribution statements — Milestone 0

**Luke McArthur** — Wrote the initial design and architecture, data model, agile development
process, milestone plan, team responsibilities, and risk analysis, and set up the repository,
README, backlog, and architecture diagram.

**Jesse Seidel** — Wrote the executive summary, target users and personas, proposed application,
MVP scope, initial requirements (user stories, acceptance criteria, and the functional and
non-functional requirement tables), and the success criteria.

## Contribution statements — Milestone 1

**Luke McArthur** — 

**Jesse Seidel** — Initial project scaffolding(including the database table structure), allowing a manager to create/delete a lab, allowing members to view what labs they have been added to, and allowing a manager to add/remove members to a lab. In the milestone 1 document: Updated product brief/scope. Piroirtized backlog and definiton of dine, analysis model, ADR, UX wireframes, design pattern + justification, and authentication. 

## Documents

- [Prioritized backlog](BACKLOG.md)
- [Architecture and data model](docs/architecture.md)
- [Milestone 0 proposal report](docs/milestone-0/)
