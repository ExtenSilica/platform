# Account OAuth provider summary (`GET /auth/me`)

This describes the **lightweight** OAuth fields returned on the authenticated profile endpoint so clients can prepare account settings (e.g. show which providers are already linked) **without** implementing connect/disconnect flows yet.

## Endpoint

`GET /auth/me` — requires `Authorization: Bearer <apiToken>`.

## Response shape (additive)

The JSON body remains `{ "user": { ... } }` plus a sibling object:

```json
{
  "user": {
    "id": 7,
    "username": "alice",
    "email": "alice@example.com",
    "bio": null,
    "avatarUrl": null,
    "createdAt": "2026-03-10T12:00:00.000Z",
    "updatedAt": "2026-03-10T12:00:00.000Z"
  },
  "oauthProviders": {
    "hasGithub": true,
    "hasGoogle": false
  }
}
```

- **`user`**: unchanged from before (no `passwordHash`, no `apiToken`).
- **`oauthProviders`**: derived from `OAuthAccount` rows for this user.
  - **`hasGithub`**: at least one linked GitHub identity.
  - **`hasGoogle`**: at least one linked Google identity.

When the user has no OAuth rows, both booleans are `false`.

## Backward compatibility

Existing clients that only read **`user`** keep working. New fields are top-level siblings, not nested inside `user`, so strict serializers that whitelist `user` keys are unaffected.

## Future work (not implemented here)

- Connect / disconnect UI and APIs for linking additional providers.
- If more `OAuthProvider` enum values are added, extend **`oauthProviders`** (or introduce a `connectedProviders: string[]` alongside booleans) in a coordinated API version.

## Implementation

Server: `getOAuthProviderSummaryForUser` in `store-backend/src/services/oauthProviderSummary.ts`, used by `me` in `store-backend/src/controllers/authController.ts`.
