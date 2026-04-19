# ExtenSilica — package index

Minimal Next.js UI that lists `.xsil` packages from the registry (`GET /packages`) and shows per-package details: description, ISA, optional declared targets (from package metadata only), and the example command:

```bash
xsil run <package-slug>
```

Set `NEXT_PUBLIC_API_URL` to your registry base (default `http://localhost:3001/api` — the client strips `/api` for `/packages` and `/auth/*` requests).

Login and register include **Continue with GitHub / Google**, which navigate the browser to `GET /auth/github/start` and `GET /auth/google/start` on the same registry origin. See `docs/frontend-oauth-ui.md`.

```bash
npm install
npm run dev
```
