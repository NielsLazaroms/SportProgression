# Deployment

The app runs on the shared platform VM (k3s, one shared PostgreSQL; see
[platform-manager](https://github.com/Mxndarijn/platform-manager)) at
**https://sportprogression.mn-platform.tech**.

| Image | What it does | Port |
| --- | --- | --- |
| `sportprogression-frontend` | nginx with the built Angular app. Forwards `/api/` to the backend, so browser and API share one origin (no CORS, the strict session cookies just work). | 8080 |
| `sportprogression-backend` | NestJS API. Connects to PostgreSQL and applies pending schema migrations on startup. | 3001 |

```
browser --https--> Traefik --> frontend (nginx :8080) --/api/--> backend (:3001) --> postgres.platform-db.svc (shared)
```

## What the platform provides

Made once with platform-manager (`apps/sportprogression/`, the steps of
`tools/new-app.ps1 -Apply`):

- the namespace `app-sportprogression` with its memory quota and network rules;
- the database `sportprogression` and its role in the shared PostgreSQL;
- the Secret `database` (`PGUSER`, `PGPASSWORD`, `DATABASE_URL`, ...). The
  backend reads `DB_USER` and `DB_PASS` from it (`k8s/backend.yaml`);
- cert-manager with the `letsencrypt` ClusterIssuer, and the DNS record
  `*.mn-platform.tech` pointing at the VM.

## What this repository brings

All in `k8s/`:

| File | Contents |
| --- | --- |
| `configmap.yaml` | Settings that are not secret: database host and name, public URL, time zone, proxy hops |
| `secret.example.yaml` | Template for `secret.yaml` (git-ignored): JWT secrets, Google sign-in, Claude API key, AI e-mails |
| `backend.yaml`, `frontend.yaml` | Deployments and Services |
| `ingress.yaml` | The host, Traefik and the Let's Encrypt certificate |
| `kustomization.yaml` | Ties it together; `deploy.sh` fills in the image tag |
| `deploy.sh` | Builds, loads the images into k3s and applies, all over SSH |

## Deploying

Needs Docker, kubectl (only to render the files, offline) and SSH access as
root to the VM (77.42.22.102). The Kubernetes API is firewalled to one home
IP, so the script does everything through SSH instead.

```bash
cp k8s/secret.example.yaml k8s/secret.yaml   # once; fill it in (openssl rand -base64 48 for the JWT secrets)
./k8s/deploy.sh
```

The images are tagged with the git commit (`-dirty` with uncommitted
changes), imported into k3s with `k3s ctr images import`, and used with
`imagePullPolicy: IfNotPresent`, so no registry is needed.

Google sign-in needs `https://sportprogression.mn-platform.tech/api/auth/google/callback`
under "Authorised redirect URIs" of the OAuth client in Google Cloud.

**Replicas.** Keep the backend at one replica: migrations run on startup
without a lock, and the rate limits (including the 10 AI calls per hour) are
counted in memory per pod.

**Memory.** The quota (`apps/sportprogression/quota.yaml` in platform-manager)
allows 384Mi of requests: the backend's 192Mi, the frontend's 32Mi, a second
frontend pod during a rolling update and cert-manager's 64Mi solver pod when
the certificate renews. Raise it there when the app grows.

## Looking at it

```bash
ssh root@77.42.22.102 kubectl -n app-sportprogression get pods
ssh root@77.42.22.102 kubectl -n app-sportprogression logs deploy/backend
```

Schema changes ship as migrations (README, "Database schema changes") and
are applied when the new backend starts. The platform dumps every database
to object storage each night.

## Trying it locally

`docker compose up --build` runs the same two images with a throwaway
PostgreSQL on http://localhost:8080. Without `GOOGLE_CLIENT_ID` the Google
sign-in button cannot complete; the demo login only exists in the local
development setup (README, Quick start).
