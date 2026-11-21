# Master organizations API

Edge Function: `master-organizations`

## Access control

- Requires a valid authenticated Supabase user JWT.
- Requires an active row in `public.platform_admins` for the caller.
- Never exposes the service-role key to the browser.
- Uses the service-role client only after checking the caller's platform-admin membership.
- Administrative writes are recorded in `platform_admin_audit`; failed audit writes cause the requested change to be reverted or rolled back.

## Actions

- `list`: list organizations and branding/status fields.
- `audit`: return the latest 100 administrative events.
- `create`: create an organization and its first organization administrator.
- `update`: update organization name, slug, branding and logo.
- `status`: change organization status.

The first platform administrator must be provisioned through a controlled, verified administrative process. There is intentionally no public Master bootstrap endpoint.
