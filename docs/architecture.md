# BenchTime — Initial Architecture

Milestone 0 · 2026-09-02. Revised for Milestone 1 alongside the wireframes and the ADR.

## System context

BenchTime has no external datasets, APIs, or hardware dependencies. University SSO is post-MVP
(US-13) and depends on access we do not have yet.

```mermaid
graph TB
    member["<b>Member</b><br/>Student, faculty, or staff<br/>with access to a lab"]
    manager["<b>Lab Manager</b><br/>Owner of a lab space"]

    subgraph boundary["BenchTime"]
        app["<b>BenchTime Web Application</b><br/>Role-based shared equipment calendar"]
    end

    sso["<b>University SSO</b><br/>Post-MVP, US-13"]

    member -->|"Views labs and equipment,<br/>books and cancels<br/>own reservations"| app
    manager -->|"Creates labs, registers equipment,<br/>adds members, removes reservations,<br/>views statistics"| app
    app -.->|"Optional: authenticate<br/>with university account"| sso

    classDef person fill:#2d5a8c,stroke:#1a3757,color:#fff
    classDef system fill:#3d7ab8,stroke:#25567f,color:#fff
    classDef future fill:#8a8a8a,stroke:#5c5c5c,color:#fff,stroke-dasharray:4 3
    class member,manager person
    class app system
    class sso future
```

## Containers

Three-tier client–server. Only the backend touches the database, every permission check happens
on the server, and the overlap rule is enforced by the database rather than by application code.

```mermaid
graph TB
    user(["Member / Lab Manager"])

    spa["<b>Web Client</b><br/>React 19 · JSX · CSS"]
    api["<b>API Server</b><br/>Node.js · Express 5<br/>Auth, permissions, validation"]
    db[("<b>PostgreSQL</b><br/>Users, labs, memberships,<br/>equipment, reservations")]

    user -->|HTTPS| spa
    spa -->|"JSON over HTTPS<br/>session cookie"| api
    api -->|SQL| db

    classDef c fill:#3d7ab8,stroke:#25567f,color:#fff
    classDef d fill:#2d5a8c,stroke:#1a3757,color:#fff
    class spa,api c
    class db d
```

## Data model

```mermaid
erDiagram
    USER ||--o{ LAB : "owns"
    USER ||--o{ MEMBERSHIP : "has"
    USER ||--o{ RESERVATION : "books"
    LAB  ||--o{ MEMBERSHIP : "grants"
    LAB  ||--o{ EQUIPMENT : "contains"
    EQUIPMENT ||--o{ RESERVATION : "is booked by"

    USER {
        int id PK
        string username UK
        string password_hash
        string role "member | manager"
    }
    LAB {
        int id PK
        string name
        int owner_id FK
    }
    MEMBERSHIP {
        int id PK
        int lab_id FK
        int user_id FK
    }
    EQUIPMENT {
        int id PK
        string name
        string description
        int lab_id FK
        bool active "false = soft deleted"
    }
    RESERVATION {
        int id PK
        int equipment_id FK
        int user_id FK
        timestamptz start_time
        timestamptz end_time
    }
```

A lab is an equipment calendar owned by exactly one manager, and a membership is what grants a
member access to it. Equipment removal is a soft delete so old reservations stay intact for the
usage statistics planned after the MVP.

## The overlap guarantee

Checking in application code is not enough — two requests can both read "the slot is free"
before either one writes. Postgres expresses the rule directly:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservation ADD CONSTRAINT no_overlapping_reservations
  EXCLUDE USING gist (
    equipment_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  );
```

The API still validates and returns a readable error (NFR-6), but the constraint is what makes
the guarantee hold under concurrency. This backs US-4 in the [backlog](../BACKLOG.md).
