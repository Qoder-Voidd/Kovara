.PHONY: dev build lint test format labels

dev:
	@pnpm dev

build:
	@pnpm build

lint:
	@pnpm lint

test:
	@pnpm test

format:
	@pnpm format

# Sync GitHub issue/PR labels from .github/labels.yml to the repository.
# Requires the GITHUB_TOKEN env var (a token with repo scope). The target
# repository is derived from the `origin` git remote.
labels:
	@test -n "$(GITHUB_TOKEN)" || { echo "GITHUB_TOKEN is not set"; exit 1; }
	@repo=$$(git remote get-url origin | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$$##'); \
		npx github-label-sync --access-token "$(GITHUB_TOKEN)" --labels .github/labels.yml "$$repo"
