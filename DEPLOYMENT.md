# Deployment: Docker, Kubernetes and PostgreSQL

The app runs as two containers:

| Image | What it does | Port |
| --- | --- | --- |
| `sportprogression-frontend` | nginx with the built Angular app. Forwards `/api/` to the backend, so browser and API share one origin (no CORS, the strict session cookies just work). | 8080 |
| `sportprogression-backend` | NestJS API. Connects to PostgreSQL and applies pending schema migrations on startup. | 3001 |

PostgreSQL itself is **not** part of these manifests: the VM provides it as a container.

```
browser --https--> ingress --> frontend (nginx :8080) --/api/--> backend (:3001) --> PostgreSQL (provided)
```

## 1. Build the images

On the VM (or any machine with Docker), from the repository root:

```bash
docker build -t sportprogression-backend:1.0.0 backend
docker build -t sportprogression-frontend:1.0.0 frontend
```

Kubernetes has to be able to find these images. Pick what fits the VM:

- **Docker Desktop / minikube with the Docker driver**: the cluster sees images built with `docker build` directly.
- **k3s** (uses containerd, not Docker): `docker save sportprogression-backend:1.0.0 | sudo k3s ctr images import -` (same for the frontend).
- **kind**: `kind load docker-image sportprogression-backend:1.0.0 sportprogression-frontend:1.0.0`
- **microk8s**: `docker save sportprogression-backend:1.0.0 | microk8s ctr image import -`
- **A registry**: tag as `registry.example.com/sportprogression-backend:1.0.0`, push, and set `newName` under `images:` in `k8s/kustomization.yaml`.

The manifests use fixed tags with `imagePullPolicy: IfNotPresent`, so a locally loaded image is used without contacting a registry. For a new version, build with a new tag (`1.0.1`) and change `newTag` in `k8s/kustomization.yaml`.

## 2. Prepare the PostgreSQL database

PostgreSQL 13 or newer. Create a database and a user that owns it (in the provided container):

```sql
CREATE USER sportprogression WITH PASSWORD 'a-strong-password';
CREATE DATABASE sportprogression OWNER sportprogression;
```

No extensions or superuser rights are needed. The API creates the tables itself on first start (migration `InitialSchema`).

## 3. Configure Kubernetes

All manifests are in `k8s/`:

| File | Contents |
| --- | --- |
| `namespace.yaml` | Namespace `sportprogression` |
| `configmap.yaml` | Settings that are not secret: database host and name, public URL, time zone, proxy hops |
| `secret.example.yaml` | Template for the secrets: database user and password, JWT secrets, Google sign-in, Claude API key |
| `postgres-external.yaml` | A `postgres` Service pointing at the provided database container |
| `backend.yaml`, `frontend.yaml` | Deployments and Services |
| `ingress.yaml` | Public host name and HTTPS |
| `kustomization.yaml` | Ties it together, sets the image tags |

Steps:

1. **Secrets.** `cp k8s/secret.example.yaml k8s/secret.yaml` and fill it in (`secret.yaml` is in `.gitignore`). Generate the JWT secrets with `openssl rand -base64 48`.
2. **Where the database is.** One of:
   - The database container runs on the VM **outside** Kubernetes (plain Docker): set its address in `k8s/postgres-external.yaml`. Use the VM's own network IP, not `127.0.0.1` (inside a pod that is the pod itself), and make sure the container publishes port 5432 on that address.
   - The database runs **inside** the cluster with its own Service: remove `postgres-external.yaml` from `kustomization.yaml` and set `DB_HOST` in `configmap.yaml` to that Service (`<service>.<namespace>.svc.cluster.local` when it lives in another namespace).
3. **Public address.** Replace `sportprogression.example.com` in `configmap.yaml` (`FRONTEND_URL`, `GOOGLE_CALLBACK_URL`) and `ingress.yaml`. Uncomment `ingressClassName` for the ingress controller on the VM (k3s comes with `traefik`).
4. **Google sign-in.** In Google Cloud, add `https://<your host>/api/auth/google/callback` to the OAuth client's authorised redirect URIs.
5. **HTTPS.** Required: in production the session cookies are `Secure`, and browsers drop them on plain http, so signing in would silently fail. Use cert-manager (annotation in `ingress.yaml`) or create the `sportprogression-tls` secret yourself:
   `kubectl -n sportprogression create secret tls sportprogression-tls --cert=fullchain.pem --key=privkey.pem`
6. **Apply:**

   ```bash
   kubectl kustomize k8s/          # preview
   kubectl apply -k k8s/
   kubectl -n sportprogression rollout status deploy/backend
   kubectl -n sportprogression logs deploy/backend
   ```

   The backend log shows the migrations running and then `Nest application successfully started`.

**No ingress controller?** Change the frontend Service to `type: NodePort` (see the comment in `frontend.yaml`), set `TRUST_PROXY` to `"1"`, and put a TLS terminating proxy in front of the VM port.

**Replicas.** Keep the backend at one replica: migrations run on startup without a lock, and the rate limits (including the 10 AI calls per hour) are counted in memory per pod.

## 4. Updating the app

1. Build both images with a new tag and load them (step 1).
2. Change `newTag` in `k8s/kustomization.yaml`, then `kubectl apply -k k8s/`.
3. Schema changes ship as migrations (see README, "Database schema changes") and are applied when the new backend starts. Back up the database first: `pg_dump -Fc sportprogression > backup.dump`.

## Trying it locally

`docker compose up --build` runs the same two images with a throwaway PostgreSQL on http://localhost:8080. Without `GOOGLE_CLIENT_ID` the Google sign-in button cannot complete; the demo login only exists in the local development setup (README, Quick start).
