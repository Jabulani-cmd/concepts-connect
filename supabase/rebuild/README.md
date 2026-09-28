# Rebuilding the database

The website's code expects the database described by `supabase/migrations`.
If a project ends up on a database with a different structure (for example
after remixing it in Lovable), `rebuild_database.sql` resets that database and
builds the correct structure in one run.

## Running it

1. Open an SQL editor connected to the project's database (for example the
   Supabase dashboard's SQL Editor).
2. Paste the whole of `rebuild_database.sql` and run it once. It takes a few
   seconds and ends with `Concepts Learning Academy database rebuilt`.
3. In the Admin Portal, click **Re-seed Demo Data**, then **Create missing logins**.

**It deletes every table in the `public` schema, and all data in them.**
Logins (`auth.users`) and uploaded files are kept.

## What it contains

| Part | Source |
|---|---|
| Reset | `reset.sql`: drops the `public` tables, views, functions and types, the `private` schema, storage policies and custom triggers on `auth.users` |
| Setup | every file in `supabase/migrations` from the 22 May 2026 catch-up onward, each in its own transaction |
| Bridge | `bridge.sql`: 13 columns the live database had from earlier setup files that the catch-up does not create |

After any change to `supabase/migrations`, regenerate it with:

```
python3 supabase/rebuild/build_rebuild_sql.py [project-ref]
```
