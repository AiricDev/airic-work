#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ -f .env ]] || { echo 'Copy task.env.example to .env and fill in the settings.' >&2; exit 1; }
[[ $EUID != 0 ]] || { echo 'Run as a non-root user with Docker access.' >&2; exit 1; }

mkdir -p -m 700 data
export AIRIC_DEPLOY_DATA="$(cd data && pwd -P)"
export AIRIC_DEPLOY_UID="$EUID" AIRIC_DEPLOY_GID="$(id -g)"
export AIRIC_DOCKER_SOCKET_GID=0
if [[ $(uname -s) == Linux ]]; then
    [[ -S /var/run/docker.sock ]] || { echo 'Docker socket /var/run/docker.sock is unavailable.' >&2; exit 1; }
    AIRIC_DOCKER_SOCKET_GID="$(stat -c %g /var/run/docker.sock)"
fi

# Let Compose parse dotenv values. The placeholder is only used for configuration lookup.
export AIRIC_DEPLOY_OM_MOUNT="$AIRIC_DEPLOY_DATA"
compose=(docker compose --env-file .env -f compose.yaml)
repository=$("${compose[@]}" config --environment | sed -n 's/^AIRIC_OM_REPOSITORY=//p')
case "$repository" in
    /*) AIRIC_DEPLOY_OM_MOUNT="$(cd -- "$repository" && pwd -P)" ;;
    https://*|ssh://*)
        mkdir -p -m 700 data/om-mount
        AIRIC_DEPLOY_OM_MOUNT="$AIRIC_DEPLOY_DATA/om-mount"
        ;;
    *) echo 'Set AIRIC_OM_REPOSITORY to an absolute path, HTTPS URL, or SSH URL.' >&2; exit 1 ;;
esac

if (( $# == 0 )); then
    set -- up -d --wait
fi
exec "${compose[@]}" "$@"
