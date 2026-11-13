#!/usr/bin/env bash
# Dedicated CI runners only. Docker's publish filter matches container ports,
# not HostPort, so inspect bindings to find 54322:5432 mappings correctly.
set -euo pipefail

mapfile -t containers < <(docker ps -aq)
for container in "${containers[@]}"; do
  bindings=$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$container")
  if node -e '
    const bindings = JSON.parse(process.argv[1]) || {};
    const conflict = Object.values(bindings).flat().some(binding => {
      const port = Number(binding?.HostPort);
      return port >= 54321 && port <= 54328;
    });
    process.exit(conflict ? 0 : 1);
  ' "$bindings"; then
    echo "Removing CI container with a conflicting local-stack host port: $container"
    docker rm -f "$container"
  fi
done

for port in 54321 54322 54323 54324 54325 54326 54327 54328; do
  if command -v fuser >/dev/null 2>&1; then
    sudo fuser -k -n tcp "$port" 2>/dev/null || true
  fi
done