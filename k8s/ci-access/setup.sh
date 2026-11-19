#!/usr/bin/env bash
# Gives the GitHub Actions deploy a narrow way onto the platform VM.
#   ./k8s/ci-access/setup.sh <public key file>    set up, or replace the key
#   ./k8s/ci-access/setup.sh --remove             undo all of it
# Runs from your machine over SSH as root (needs your SSH agent).
#
# On the VM this makes:
#   - user "sportprogression-ci" whose key can only run one command
#     (restrict, forced command; no shell, no forwarding);
#   - /usr/local/bin/sportprogression-deploy: reads the rendered manifests on
#     stdin, applies them as the ServiceAccount ci-deployer and waits for the
#     rollout. It takes no arguments;
#   - /etc/sudoers.d/sportprogression-ci: that user may run only that script;
#   - k8s/ci-access/rbac.yaml: the ServiceAccount and its namespace-only Role;
#   - the Pod Security label "baseline" on the namespace, so a deployment from
#     CI cannot run privileged pods or mount the host.
# This lives outside platform-manager; remove it here when the app leaves.
set -euo pipefail
cd "$(dirname "$0")"
HOST="${DEPLOY_HOST:-root@77.42.22.102}"
NS=app-sportprogression
U=sportprogression-ci

if [ "${1:-}" = "--remove" ]; then
  ssh "$HOST" "set -e
    kubectl delete -f - --ignore-not-found
    kubectl label ns $NS pod-security.kubernetes.io/enforce- || true
    rm -f /etc/sudoers.d/$U /usr/local/bin/sportprogression-deploy
    id $U >/dev/null 2>&1 && userdel -r $U || true" < rbac.yaml
  echo "== removed"
  exit 0
fi

KEY="${1:?usage: setup.sh <public key file> | --remove}"
PUB="$(cat "$KEY")"
case "$PUB" in ssh-ed25519\ *) ;; *) echo "expected an ssh-ed25519 public key"; exit 1;; esac

echo "== Role and ServiceAccount"
ssh "$HOST" kubectl apply -f - < rbac.yaml

echo "== Pod Security baseline on $NS"
ssh "$HOST" kubectl label --overwrite ns "$NS" pod-security.kubernetes.io/enforce=baseline

echo "== user, script, sudoers"
ssh "$HOST" "set -e
id $U >/dev/null 2>&1 || useradd --system --create-home --shell /bin/sh $U
cat > /usr/local/bin/sportprogression-deploy <<'SCRIPT'
#!/bin/sh
# Forced command of user $U (k8s/ci-access/setup.sh in SportProgression).
set -eu
NS=$NS
AS=system:serviceaccount:\$NS:ci-deployer
kubectl --as=\"\$AS\" -n \"\$NS\" apply -f -
kubectl --as=\"\$AS\" -n \"\$NS\" rollout status deploy/backend --timeout=300s
kubectl --as=\"\$AS\" -n \"\$NS\" rollout status deploy/frontend --timeout=120s
SCRIPT
chmod 755 /usr/local/bin/sportprogression-deploy
echo '$U ALL=(root) NOPASSWD: /usr/local/bin/sportprogression-deploy \"\"' > /etc/sudoers.d/$U
chmod 440 /etc/sudoers.d/$U
visudo -cf /etc/sudoers.d/$U
install -d -m 700 -o $U -g $U /home/$U/.ssh
echo 'restrict,command=\"sudo /usr/local/bin/sportprogression-deploy\" $PUB' > /home/$U/.ssh/authorized_keys
chown $U:$U /home/$U/.ssh/authorized_keys
chmod 600 /home/$U/.ssh/authorized_keys"
echo "== done: $U@${HOST#*@} can deploy $NS"
