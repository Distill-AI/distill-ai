# Deployment

Distill.ai deploys to **Alibaba Cloud (Singapore, ap-southeast-1)**, co-located with our Qwen
Cloud endpoint. Rationale and tradeoffs are in [`../docs/deployment-alibaba.md`](../docs/deployment-alibaba.md).

**Path: GHCR images + a single Alibaba ECS VM running docker-compose.** Alibaba's Singapore
(International) region offers only paid Enterprise ACR (no free Personal Edition), so we keep
images in **GitHub Container Registry (GHCR, free)** and run the whole stack on **one ECS VM**.
The hackathon requirement is that the backend runs on Alibaba Cloud (the compute), which this
satisfies; image-registry location is not part of that requirement.

The `docker-compose.yml` runs **everything on the one VM**: `api`, `worker`, `postgres`
(pgvector image), `redis`, and `client`. So no managed RDS, managed Redis, ACR, SAE, or RAM
AccessKeys are needed.

## Pipeline

CI/CD stays on GitHub Actions:

- `.github/workflows/ci.yml` runs lint, test, build, and the security scans (forbidden-pattern +
  Lazarus + gitleaks + Trivy) on every push/PR.
- `.github/workflows/deploy.yml` (triggers on `staging` / `main`): builds the API and client
  images, pushes them to GHCR, SSHes into the ECS host, runs `docker compose pull && up`, runs
  `pnpm migration:run`, and health-checks `/api/v1/health`.

## One-time provisioning (account owner / devops)

Region **Singapore (ap-southeast-1)**, all in one VPC.

1. **VPC + vSwitch:** one VPC (e.g. `192.168.0.0/16`) and a vSwitch in one zone. (Already created:
   `distill-vpc` / `distill-sw-a`, Singapore Zone B.)
2. **ECS VM:** one Ubuntu 22.04 instance (2 vCPU / 2-4 GB) in that VPC, with a public IP. Install
   Docker + the compose plugin. Create `/opt/distill-ai/` and place `docker-compose.yml` plus the
   per-environment `.env` (from `../.env.production.example`) at `/opt/distill-ai/<env>/.env`. Add
   a non-root `deploy` user in the `docker` group for the SSH deploy.
3. **GHCR image access:** make the GHCR packages public, or run `docker login ghcr.io` on the VM
   with a read-scoped token, so `docker compose pull` can fetch the images.
4. **OSS bucket** (optional): for serving the client build + generated PDFs.

Postgres and Redis need no separate provisioning, they come up as containers from
`docker-compose.yml` (with the `pgdata` volume persisting Postgres data).

## GitHub secrets (Settings -> Secrets and variables -> Actions)

The `deploy.yml` (ECS over SSH) path needs:

- `ECS_HOST` - public IP or hostname of the ECS VM
- `ECS_USERNAME` - the `deploy` SSH user
- `ECS_SSH_KEY` - that user's private SSH key

GHCR auth uses the built-in `GITHUB_TOKEN`, no extra secret. The DB/Redis passwords and Qwen keys
live in the per-environment `.env` on the ECS host, not in GitHub secrets.

## Client to OSS (optional)

If serving the client from OSS instead of the compose `client` container, build and upload:

```sh
pnpm --filter client build
# upload the build output to the OSS bucket (ossutil), e.g.
# ossutil cp -r client/dist/ oss://<bucket>/ --update
```

## Notes

- The whole stack on one VM keeps cost to a single ECS instance. Managed RDS / Redis / OSS-CDN are
  optional upgrades if the demo outgrows one box.
- SAE remains a possible future upgrade (it can pull a public GHCR image), but it adds setup and
  its own cost, so ECS + GHCR is the chosen path for the hackathon.
