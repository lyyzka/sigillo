# Changelog

## 0.0.2

1. **Let `sig_` API tokens read their own project metadata** so CLI token login can run `setup`.

   Before this, a token worked on secrets routes but `sigillo setup --project X --env dev` called `GET /api/v0/projects/X` and got **401**. User (device-flow) login was fine. Token login was not.

   A project-scoped token can now call the read routes the CLI uses after `sigillo login --token`:

   ```bash
   sigillo login --api-url https://secrets.example.com --token sig_xxxxx
   sigillo setup --project <project-id> --env dev
   sigillo me
   sigillo orgs
   sigillo environments get dev
   ```

   | Route | Token can |
   |---|---|
   | `GET /api/v0/me` | yes. returns the token creator and that one org |
   | `GET /api/v0/orgs` | yes. that one org, role `member` |
   | `GET /api/v0/projects` | yes. only the token project |
   | `GET /api/v0/projects/:id` | yes. **403** if a different project |
   | `GET /api/v0/projects/:id/environments` | yes |
   | `GET /api/v0/projects/:id/environments/:id` | yes. **403** if env-scoped to a different env |
   | secrets routes | already worked |
   | create / rename / delete orgs, projects, envs | still **401** |

   Env-scoped tokens only see that environment in project payloads, so `setup --env prod` with a `dev` token fails early.

   Deleting a scoped environment now **revokes** the token (`ON DELETE CASCADE`). It used to `SET NULL`, which widened the token to every environment in the project. Self-hosted instances need migration `0006`.

   README curl examples now use `/api/v0/projects/{projectId}/environments/{environmentId}/secrets`. The old `/api/environments/{envId}/secrets` path does not exist.

   Fixes #4
