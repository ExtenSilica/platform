# ExtenSilica — package index

Minimal Next.js UI that lists `.xsil` packages from the registry (`GET /packages`) and shows per-package details: description, ISA, optional declared targets (from package metadata only), and the example command:

```bash
xsil run <package-slug>
```

Set `NEXT_PUBLIC_API_URL` to your registry base (default `http://localhost:3001/api` — the client strips `/api` for `/packages` requests).

```bash
npm install
npm run dev
```
