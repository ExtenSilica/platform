# Plano de implementação ExtenSilica — registry + coordenação técnica

**Versão:** Maio 2026  
**Horizonte:** ~6 meses de engenharia + trilha legal/adoption em paralelo  
**North star:** registry público + coordenação técnica aberta + métricas de adoção, operado como **steward interino** com caminho para governança neutra (RISC-V International ou fundação afim).

**Explicitamente fora:** USDC, wallets, escrow, payouts, fee, marketplace, estados `funded`/`paid`, schema financeiro.

---

## 0. Princípios (norte do produto)

| Princípio | Racional |
|-----------|----------|
| Sem schema financeiro | Fundação não absorve custódia; tarball limpo na transferência |
| Coordenação técnica (requests → verify) | “Issue tracker do registry” — absorvível; gera adoção sem ser loja |
| Reusar `portStatus` + RL | Não criar enum `runnable`/`paid` paralelo — duas fontes de verdade mentem |
| Copiar padrão `OwnershipRequest` | Menos risco de auth/routes; time já conhece |
| Funding off-platform só | `fundingContactEmail` + `fundingNote` + disclaimer; sem `amount`/`currency` |
| `verified` ≠ `completed` | Técnico vs encerramento administrativo |
| Verifier default = upstream | Legitimidade; admin só disputa / seed sem owner |
| `portStatus=official` só admin | `verified` técnico ≠ endosso institucional |
| Tom institucional na copy | “Community infrastructure”, não startup comercial |
| Contribuição não-paga = reputação | Perfil público + citações + CFF |
| Anti-deriva | `rejectStructuredMoney()` + grep/CI contra `wallet`/`escrow`/`USDC` |

---

## 1. Baseline (já existe — não reconstruir)

| Área | Onde |
|------|------|
| Registry | `Extension`, `Version`, publish, yank, scoped `@org/pkg` |
| Proveniência | `portStatus`, cap RL1 para `seeded` |
| Claim | `OwnershipRequest`, `claim-ownership-card.tsx`, admin approve |
| Orgs | `Organization`, `OrgMember` |
| Auth | Multi-token, OAuth, `/dashboard/tokens` |
| Catálogo | ~102 seeds, `docs/catalog-seed/` |
| CLI | `xsil` 0.2.2 (crates.io) |
| Downloads | `DownloadEvent`, `recordDownload` em `analytics.ts` |
| Perfil user | `GET /users/:username`, `app/users/[username]/page.tsx` |
| Legal pivot | Sem pay-per-flash (`docs/history/license-wrapper.md`) |

**Gap:** licença do backend `ISC` em `package.json` → alinhar Apache-2.0 (PR-G4).

---

## 2. Colisões resolvidas (visão externa → ExtenSilica)

| Sugestão externa | Decisão |
|------------------|---------|
| `package_claims` | `OwnershipRequest` — estender |
| Enum longo de status de pacote | **Não criar** — derivar de `portStatus` + RL + request |
| `Package Author` | Derivado: `ownerId` / primeiro publisher |
| `Upstream Maintainer` | Owner/maintainer pós-claim; default verifier |
| `Sponsor` (papel DB) | **Não** — só `fundingContactEmail` opcional |
| `wallets`, `payouts`, `funding_contributions` | **Não criar** |
| USDC / escrow | **Fora do roadmap** |
| Approved Implementer “para paid work” | Endosso/curadoria leve; sem gate financeiro |

### Rótulos de UI derivados (não colunas DB)

| Rótulo humano | Fonte |
|---------------|--------|
| Seed / scaffold | `portStatus=seeded`, RL1 |
| Precisa implementação | Request `open` + RL baixo |
| Runnable / testável | RL + capabilities + submission |
| Verificado (trabalho) | `VerificationRun.outcome=pass` |
| Official | `portStatus=official` (admin only) |

---

## 3. Papéis (capabilities, não 8 tabelas)

| Papel | Implementação |
|-------|----------------|
| User | `User` |
| Package Author | Derivado |
| Upstream Maintainer | `ownerId` / `Maintainer` / org admin após claim |
| Contributor / Implementer | Qualquer user; `implementerGithubUrl` + `implementerBio` (PR-B1) |
| Verifier | Upstream → independente (futuro) → platform admin |
| Organization | `Organization` + `OrgMember` |
| ExtenSilica Admin | `platformAdmin` |

**Funding:** off-platform; plataforma não é parte do contrato.

---

## 4. Modelo de dados

### 4.1 Estender existente

```text
OwnershipRequest  + claimantOrgId?     (PR-A1)
User              + implementerGithubUrl?, implementerBio?  (PR-B1)
```

### 4.2 Criar (Fase C)

```text
ImplementationRequest
ImplementationMilestone
ImplementationSubmission
VerificationRun
ImplementationInterest
```

**`ImplementationRequest` (campos principais):**

```text
id, packageId, createdByUserId, createdByOrgId?
title, description, visibility (public|org_only|unlisted)
status (draft|open|in_progress|submitted|verified|completed|cancelled)
targetCapability?, acceptanceCriteriaSummary?
fundingContactEmail?, fundingNote?          // off-platform only
assignedImplementerUserId?
timestamps
```

**Proibido em API/body:** `amount`, `currency`, `wallet`, `txHash`, `payout`, `escrow`, `usdc`, `funded`, `paid`.

### 4.3 Métricas / citação (Fase G)

```text
PackageViewEvent     (packageId, day, count)     — PR-G1
ExternalCitation     (packageId?, label, url, kind) — PR-G2
```

Zenodo: manual (G6a), automação depois (G6b).

### 4.4 O que nunca entra no schema

`wallets`, `payouts`, `funding_contributions`, escrow, qualquer saldo.

---

## 5. Guard anti-deriva

**`store-backend/src/lib/implementationRequest.ts`:**

```ts
export function rejectStructuredMoney(body: Record<string, unknown>): string | null;
```

**CI (PR-G8, opcional):** falhar se schema/código introduzir termos financeiros proibidos.

---

## 6. Máquina de estados — Implementation Request

```text
draft → open → in_progress → submitted → verified → completed
         └──────────────────────────────────→ cancelled
```

| Transição | Quem |
|-----------|------|
| draft → open | criador |
| open → in_progress | criador, upstream, admin |
| in_progress → submitted | implementer/upstream |
| submitted → verified | verifier pass |
| verified → completed | upstream, admin |
| → cancelled | criador (draft/open), upstream/admin |

**Não alterar `portStatus` automaticamente** em verify.  
**`official`:** só platform admin com `decisionNote` registrada.

---

## 7. Plano de PRs

Cada PR: **O quê | Por quê | Se pular | Depende de | Não é**

### FASE A — Registry confiável (semanas 1–4)

#### PR-A1 — `claimantOrgId` em ownership

| | |
|--|--|
| **O quê** | Migration; validar org membership; POST body; UI dropdown; testes |
| **Arquivos** | `prisma/`, `lib/ownershipRequest.ts`, `ownershipRequestsController.ts`, `claim-ownership-card.tsx`, `lib/types.ts`, `lib/api.ts`, `test/ownershipRequest.test.ts` |
| **Por quê** | Claim institucional (OpenHW, vendor, lab) |
| **Se pular** | Só PF reivindica |
| **Depende de** | Orgs existentes |
| **Não é** | Papel Sponsor |

#### PR-A2 — Email approve/reject claim

| | |
|--|--|
| **O quê** | `mailerOwnership.ts` ou extensão `mailer.ts`; hooks em admin approve/reject |
| **Por quê** | Fecha loop com requester |
| **Se pular** | Fila admin opaca |
| **Depende de** | SMTP |
| **Não é** | Newsletter |

#### PR-A3 — Hero packages + smoke

| | |
|--|--|
| **O quê** | `docs/hero-packages.md`; `store-backend/scripts/smoke-heroes.sh` |
| **Por quê** | Demo/LinkedIn não quebra |
| **Se pular** | Marketing mente sobre `xsil run` |
| **Não é** | Feature de backend |

---

### FASE B — Identidade contributor (semanas 4–8)

#### PR-B1 — Perfil implementer no User

| | |
|--|--|
| **O quê** | `implementerGithubUrl`, `implementerBio`; `PATCH /auth/me`; dashboard form |
| **Por quê** | Identidade antes de submissions |
| **Se pular** | Interests anônimos |
| **Não é** | KYC / aprovação admin |

#### PR-B2 — Perfil público “glória”

| | |
|--|--|
| **O quê** | `GET /users/:username/contributions`; estender `app/users/[username]/page.tsx` |
| **Por quê** | URL citável no CV |
| **Depende de** | C3 para dados completos |
| **Não é** | Leaderboard |

---

### FASE C — Coordenação técnica (semanas 8–22)

#### PR-C1 — Prisma + `lib/implementationRequest.ts`

| | |
|--|--|
| **O quê** | 5 modelos; validators; `rejectStructuredMoney`; testes |
| **Por quê** | Contrato antes de HTTP |
| **Não é** | Pagamento |

#### PR-C2 — `lib/implementationAccess.ts`

| | |
|--|--|
| **O quê** | `isPackageUpstreamMaintainer`, `canVerifySubmission`, `canEditRequest` |
| **Por quê** | Auth centralizada |

#### PR-C3 — Controller + rotas + admin cancel

| | |
|--|--|
| **O quê** | `implementationRequestsController.ts`, rotas nested + top-level, `server.ts` |
| **Ver** | Seção 8 (API) |

#### PR-C3b — Emails fluxo C

| | |
|--|--|
| **O quê** | Nova submission → creator + upstream; verification fail → implementer |
| **Por quê** | Fórum com notificação |

#### PR-C4 — Transições + regra `official`

| | |
|--|--|
| **O quê** | State machine; `createVerificationRun`; `official` só admin |
| **Por quê** | Status e proveniência honestos |

#### PR-C5 — Frontend `types.ts` + `api.ts`

#### PR-C6 — `RequestImplementationCard` + package page

#### PR-C7 — `/requests` + `/requests/[id]`

#### PR-C8 — Admin UI

#### PR-C9 — Swagger (baixa prioridade)

#### PR-C10 — CLI `xsil request` (média prioridade, repo xsil)

#### PR-C11 — Stale `open` 30 dias (cron + email)

---

### FASE G — Adoção, citação, governança

#### PR-G1 — `PackageViewEvent` + `GET /stats/adoption`

#### PR-G2 — `ExternalCitation` + admin CRUD

#### PR-G2b — `GET /packages/:slug/citation` (CFF + BibTeX)

#### PR-G3 — `/governance`, `/adoption`, `/contributing`

#### PR-G4 — LICENSE Apache-2.0

#### PR-G5 — CLA + CONTRIBUTING (+ CLA Assistant opcional)

#### PR-G6a — `docs/zenodo-doi.md` (manual)

#### PR-G6b — Zenodo pós-publish (futuro, L)

#### PR-G7 — Copy institucional (home, faq, legal)

#### PR-G8 — CI anti-financeiro (opcional)

### Trilha legal (não-dev)

| ID | O quê |
|----|-------|
| **L1** | Trademark ExtenSilica + `.xsil` (INPI/USPTO) |
| **L2** | Parecer advogado: funding off-platform, sem custódia |

---

## 8. API — superfície (Fase C)

```text
POST   /packages/:name/implementation-requests          requireAuth
GET    /packages/:name/implementation-requests
POST   /@:scope/:name/implementation-requests           requireAuth

GET    /implementation-requests                         ?status=&capability=
GET    /implementation-requests/:id
PATCH  /implementation-requests/:id

POST   /implementation-requests/:id/interests
POST   /implementation-requests/:id/milestones
PATCH  /implementation-requests/:id/milestones/:mid

POST   /implementation-requests/:id/submissions
PATCH  /submissions/:id
POST   /submissions/:id/verification-runs

GET    /me/implementation-requests
GET    /me/implementation-submissions

GET    /users/:username/contributions                     PR-B2
GET    /packages/:slug/citation                           PR-G2b
GET    /stats/adoption

GET    /admin/implementation-requests
POST   /admin/implementation-requests/:id/cancel
POST   /admin/citations
DELETE /admin/citations/:id
```

**Ownership (existente):** eligibility, create, me list, admin approve/reject.

---

## 9. UI — mapa de telas

| Rota | PR |
|------|-----|
| `/package/[slug]` | C6, G2b |
| `/requests`, `/requests/[id]` | C7 |
| `/users/[username]` | B2 |
| `/dashboard` | B1, C7 |
| `/dashboard/admin` | C8, G2 |
| `/governance`, `/adoption`, `/contributing` | G3, G5 |

---

## 10. Ordem de merge

```text
G7, G4, G5 (paralelo)
A1 → A2 → A3
B1
C1 → C2 → C3 → C3b → C4
C5 → C6 → C7 → C8
G1 → G2 → G2b → G3
B2 (após C3)
C11, C9, C10, G6a, G6b, G8
L1, L2 (paralelo humano)
```

---

## 11. Deploy após migration

```bash
cd store-backend
git pull && npm ci && npx prisma migrate deploy && npx prisma generate && npm run build
pm2 restart extensilica-api --update-env
# frontend: npm ci && npm run build && pm2 restart extensilica-web --update-env
```

---

## 12. Testes

```bash
cd store-backend && npx vitest run test/implementationRequest.test.ts
cd store-backend && npx vitest run test/implementationAccess.test.ts
cd store-backend && npx vitest run
cd store-frontend && npx tsc --noEmit
```

---

## 13. Critérios de done (6 meses)

- [ ] Fluxo open → submission → verify → `verified`
- [ ] ≥1 verification por upstream (não só admin)
- [ ] ≥5 claims aprovados
- [ ] `/stats/adoption` com série temporal (G1 cedo)
- [ ] CLA + Apache-2.0 no repo
- [ ] Schema sem wallet/escrow
- [ ] Hero smoke verde
- [ ] `/governance` + copy G7

---

## 14. Explicitamente FORA

USDC, wallets, escrow, payouts, fee, `funded`/`paid`, `targetAmount`, Sponsor DB, enum paralelo de pacote, auto `official` em verify, marketplace, DOI prometido em todo pacote antes de G6b.

---

## 15. Resumo

| Fase | Entrega |
|------|---------|
| **A** | Claim org + emails + heroes |
| **B** | Perfil implementer + página pública |
| **C** | Requests → verify + emails + admin |
| **G** | Views, citations, CFF, governance, Apache, CLA, copy |
| **Legal** | Trademark |

**~20 PRs**, sem economia na plataforma, absorvível por fundação, contribuição por reputação e citação.

---

## Texto base `/governance` (rascunho)

> ExtenSilica operates as interim technical steward of the public RISC-V extension registry and `.xsil` packaging format. Our goal is neutral, long-term governance — including transfer to RISC-V International or an affiliated foundation when ready.
>
> We coordinate **open technical work** (package publication, ownership claims, implementation requests, verification). We **do not** hold funds, process payments, set prices, or broker contracts. Optional funding contact fields point to off-platform arrangements only.
>
> Contributions to platform code require accepting our Contributor License Agreement. Registry packages remain under their upstream licenses.
