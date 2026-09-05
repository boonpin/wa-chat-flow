# Login and Access

## Credentials

There are **no default credentials**. The first admin account is created from
environment variables when the application starts for the first time:

```env
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=a-strong-password
```

If those are unset, no account is created and the login page cannot be used
until you create one:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' pnpm seed
```

The same command resets the password of an existing account.

## How to Login

1. Open `http://localhost:3000/login` (or your `APP_URL`).
2. Enter email and password.
3. Click **Sign In**.

After successful login, you will be redirected to `/dashboard`.

## Session Behavior

- Login creates an `auth_token` cookie signed with `JWT_SECRET`.
- Session remains active for 7 days unless you sign out.
- Clicking **Sign Out** in the sidebar clears the session and returns to login.

> `JWT_SECRET` is required in production. Generate one with
> `openssl rand -hex 32`. Changing it signs everyone out.

## Screenshot

![Login](./screenshots/01-login.png)
