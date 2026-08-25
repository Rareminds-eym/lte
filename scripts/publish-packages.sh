#!/usr/bin/env bash
# Publishes the @rareminds-eym packages that lte depends on to GitHub Packages.
# Usage: NPM_TOKEN=<token> ./scripts/publish-packages.sh
set -euo pipefail

PACKAGES_DIR="${PACKAGES_DIR:-../skill-echosystem-packages}"
PACKAGES=(auth-client auth-core identity-client sso-gateway entitlements)

if [ -z "${NPM_TOKEN:-}" ]; then
  echo "ERROR: NPM_TOKEN is not set. Export a GitHub Packages token with write:packages scope." >&2
  exit 1
fi

NPMRC_FILE="$(mktemp)"
trap 'rm -f "$NPMRC_FILE"' EXIT
chmod 600 "$NPMRC_FILE"

cat <<EOF > "$NPMRC_FILE"
@rareminds-eym:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
registry=https://npm.pkg.github.com
EOF

for pkg in "${PACKAGES[@]}"; do
  dir="$PACKAGES_DIR/$pkg"
  if [ ! -f "$dir/package.json" ]; then
    echo "SKIP $pkg: no package.json at $dir" >&2
    continue
  fi
  if [ ! -d "$dir/dist" ]; then
    echo "SKIP $pkg: dist/ missing — run 'npm run build' in $dir first" >&2
    continue
  fi
  name=$(node -p "require('./$dir/package.json').name")
  version=$(node -p "require('./$dir/package.json').version")
  if npm view "$name@$version" version --userconfig "$NPMRC_FILE" >/dev/null 2>&1; then
    echo "OK   $name@$version already published"
    continue
  fi
  echo "PUBLISHING $name@$version ..."
  (cd "$dir" && npm publish --userconfig "$NPMRC_FILE")
  echo "DONE $name@$version"
done

echo "All packages processed."
