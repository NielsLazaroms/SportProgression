#!/usr/bin/env bash
# Builds both images, loads them into the platform's k3s and applies k8s/.
#   ./k8s/deploy.sh
# Needs Docker, kubectl (only to render the Kustomize files, offline) and SSH
# access as root to the platform VM. Everything on the cluster goes through
# SSH, so it works from any IP (the Kubernetes API itself is firewalled).
#
# The images are tagged with the git commit, so every deploy is traceable.
# Uncommitted changes give a "-dirty" tag.
set -euo pipefail

HOST="${DEPLOY_HOST:-root@77.42.22.102}"
NS=app-sportprogression
cd "$(dirname "$0")/.."

[ -f k8s/secret.yaml ] || { echo "k8s/secret.yaml is missing (copy k8s/secret.example.yaml)"; exit 1; }

TAG="$(git rev-parse --short=12 HEAD)"
[ -z "$(git status --porcelain)" ] || TAG="$TAG-dirty"
echo "== building $TAG"

for part in backend frontend; do
  docker build --platform linux/amd64 -t "sportprogression-$part:$TAG" "$part"
done

for part in backend frontend; do
  echo "== loading sportprogression-$part:$TAG into k3s"
  docker save "sportprogression-$part:$TAG" | gzip -1 \
    | ssh "$HOST" 'gunzip | k3s ctr -n k8s.io images import -'
done

echo "== applying"
kubectl kustomize k8s/ | sed "s/:COMMIT\$/:$TAG/" | ssh "$HOST" kubectl apply -f -
ssh "$HOST" "kubectl -n $NS rollout status deploy/backend --timeout=300s && kubectl -n $NS rollout status deploy/frontend --timeout=120s"
echo "== deployed $TAG to https://sportprogression.mn-platform.tech"
