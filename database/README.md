# SQL operations setup

LifeLink uses MySQL-compatible SQL through Drizzle ORM. TiDB Cloud Serverless, Railway MySQL, or managed MySQL 8 are supported.

## 1. Create the schema

Run `lifelink_operations.sql` in the database referenced by `DATABASE_URL`. Existing LifeLink tables are not deleted or modified.

Alternatively, with project dependencies installed and `DATABASE_URL` configured, run:

```bash
pnpm db:push
```

The Drizzle configuration includes both `drizzle/schema.ts` and `drizzle/operationsSchema.ts`.

## 2. Required Vercel environment variables

- `DATABASE_URL`: MySQL/TiDB connection URL.
- `JWT_SECRET`: random value of at least 32 characters used only on the server.

Generate a secret locally with `openssl rand -base64 48`. Never commit it.

## 3. Deploy

After applying the SQL, redeploy the Vercel project. Open `/operations` to register or sign in.

## Production warning

The portal includes password hashing, HTTP-only sessions, role checks, validation, and audit events. It is not healthcare-certified. Before entering real patient information, add staff verification/approval, rate limiting, CSRF controls, encryption/key management, retention automation, backups, monitoring, incident response, and an appropriate legal/security review for the operating region.
