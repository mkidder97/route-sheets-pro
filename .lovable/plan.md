

# Seed Harbor Freight Demo Project

## Approach
Execute the user-provided SQL as data inserts into existing tables. Four operations:

1. **Building** — INSERT into `buildings` (Harbor Freight Tools, Duncan OK)
2. **CM Project** — INSERT into `cm_projects` with owner contacts, contractor info, CC list
3. **Checklist Sections** — INSERT 7 rows into `cm_project_sections` (Staging, Demo, Blocking, Assembly, Flashings, Drainage, Closeout)
4. **Demo Visit** — INSERT into `cm_visits` (Visit #1, submitted status)

All use `ON CONFLICT (id) DO NOTHING` for idempotency. No schema changes, no UI changes, no component modifications.

## Execution
Use the database insert tool to run the exact SQL provided. Single execution containing all four INSERT statements.

