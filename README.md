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

NOTE: Every command block below starts from the repo root (the `BenchTime` folder).

### Required Software 
- Node.js: versions 24.19.0
- npm: version 11.17 
- vitest: version 5.0.5 
- playwright: version 1.64.1
- PostgreSQL: version 18. 
- pgAdmin 4 : version 9.17. NOTE: This is not required, but is useful for viewing the SQL tables. 
- NOTE: Slightly older/newer versions of the above software should work, but those versions were specifically tested.

### Create the Database
```bash 
#Clone the repo 
git clone https://github.com/luke-mca/BenchTime
cd BenchTime 
```
- NOTE: the command CREATE DATABASE [your database name] should create the db using postgreSQL directly if you do not want to use pgAdmin. Just make sure the database can communicate on a port(default is 5432) and you have its URL(see .env.example for details). 
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
- Leave `PORT=3000`. The client sends its API requests to port 3000.
- In `DATABASE_URL`, use your PostgreSQL password and the database name you created above.

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

## Testing 
If you have not already, install the needed dependencies: 
```bash 
cd server && npm install 
cd ../client && npm install 
```

### Create The Test Database 
- This is very similar to the database needed for running BenchTime. 
- First, copy the test env file 
```bash 
cd server 
cp .env.test.example .env.test 
```
- Then, create your database using pgAdmin 
- Fill out the database details in .env.test(similar to the normal .env file) 
- Initialize the test database with 
```bash 
cd server
npm run db:reset:test
```

### Unit Tests 
- Note: These tests include the rate limiting tests. 
```bash 
cd server
npm test
npm run test:coverage #Will generate a coverage report in the coverage/ folder.
```

### Component Test
```bash 
cd client
npm test
npm run test:coverage #Will generate a coverage report
```
### Browser/Viewport tests 
- Note: Running the viewport tests will also run the flow tests. Some of these tests are skipped as only mobile/desktop test cases are used. 102/110 of these test cases should pass(8 are skipped). 
- If you have not installed playwright run: 
```bash 
cd client 
npx playwright install 
#Note: you may need to run 'npx playwright install --with-deps' to install system libraries.
```
- Then, to run the tests: 
```bash 
cd client
npm run test:viewport
```

### Integration Tests
- If you have not already, create the database. 
- Install playwright as mentioned under Browser/Viewport tests
- Then run these commands: 
```bash 
cd server
npm run test:integration
``` 

## Verifying Milestone 1

With the server and client running, open http://localhost:5173 and check the following:

1. **Manager setup.** Sign up as a Lab Manager. Create a lab, open it, and add a piece of equipment.
2. **Member setup.** Log out and sign up as a Member. The home page says "You haven't been added to any labs yet."
3. **Add the member.** Log back in as the manager, open the lab, and add the member by username.
4. **Reserve.** Log in as the member. The lab now appears on the home page. Open it, click **Reserve** next to the equipment, pick a start and end time, and submit. The reservation appears under "Upcoming reservations".
5. **Overlap is rejected.** Try to reserve the same equipment for a time that overlaps the first reservation. It is rejected with an error message.

## Verifying Milestone 2
1. **Milestone 1.** Verify everything in Milestone 1. 
2. **Utilization Statistics** Verify that once a reservation inside of a lab has passed for a certain piece of equipment, the utilization statistics are updated appropriately. 
3. **More Manager Control** Verify that a manager can edit/delete a member's reservation inside of a lab. 
4. **Testing** Run the tests according to the above Testing section. 

## Layout

```
BACKLOG.md     Prioritized user stories and requirements
CHANGELOG.md   Notable changes per release
docs/          Architecture, data model, milestone reports
client/        React front end            (Sprint 1)
server/        Express API and migrations (Sprint 1)
```

## Working agreement

Two-week sprints, two per milestone. Work is tracked as GitHub Issues, `main` is protected, and
every change results eventually results in a pull request that must be review by the other member. `main` is tagged at each milestone.

A task is considered done when it does what the issue asked, has been reviewed and merged through a pull
request, has tests and the suite passes(if applicable), and the app still runs from a fresh clone using the instructions above.

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

**Luke McArthur** — The issues I worked on: Lab Member Registration, Lab Manager Registration, CRUD Equipment, Add Equipment to Lab, Allow Any User to Reserve Equipment. For the report, I did the process model, API contract, module-boundary diagram, component design, responsive design, MVP features. 

**Jesse Seidel** — Initial project scaffolding(including the database table structure), allowing a manager to create/delete a lab, allowing members to view what labs they have been added to, and allowing a manager to add/remove members to a lab. In the milestone 1 document: Updated product brief/scope. Piroirtized backlog and definiton of done, analysis model, ADR, UX wireframes, design pattern + justification, and authentication. 

## Contribution statements — Milestone 2

**Luke McArthur** — Edit reservation and cancel reservation for managers. Unit test cases for code created by Jesse. Component testing/test cases for components created by Jesse. Integration tests and browser flow test. In the milestone 2 document: Peer Code Review, Integration Tests, Threat Model, OWASP Top 10, Branch/Commit Conventions.

**Jesse Seidel** — Manager utilization statistics. Unit test cases for code created by Luke. Viewport testing/test cases. Component testing/test cases for components created by Luke. In the milestone 2 document: Changes made since Milestone 1, SQA plan, Cross-viewport/cross-platform testing evidence, implemented security control + before and after evidence, and the CHANGELOG.

## Documents

- [Prioritized backlog](BACKLOG.md)
- [Changelog](CHANGELOG.md)
- [Architecture and data model](docs/Architecture/architecture.md)
- [Milestone 0 proposal report](docs/milestone-0)
- [Milestone 1 proposal report](docs/milestone-1)
- [Software Quality Assurance Documents](docs/Quality/)
