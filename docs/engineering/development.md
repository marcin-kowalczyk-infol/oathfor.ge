# Development guide

Status: documentation foundation. No PHP/Node dependencies or app scripts exist yet.

## Available now

Requirements: Git and Python 3.11+. See [commands](../../.agents/commands/README.md).

```sh
python3 .agents/commands/check_repository.py
git diff --check
mkdir -p graphics
```

The checker reads tracked/untracked non-ignored project files, resolves local Markdown file links, validates shared skills/role registration, and checks ignore behavior. It does not contact providers or prove application correctness.

## Application setup — pending

When scaffolding is requested:
- Select compatible supported Expo/React Native/Node versions from official documentation; record the versions and commit the chosen lockfile. No Expo SDK version is fixed by the previous chat. **Basis: [Expo monorepos](https://docs.expo.dev/guides/monorepos/); lockfile policy is local.**
- Create Symfony 7.4 LTS under `apps/api` using its normal structure; document PHP/extensions and commit Composer's lockfile. **Basis: [Symfony practices](https://symfony.com/doc/7.4/best_practices.html); version choice: [ADR 0001](../decisions/0001-project-foundation.md).**
- Replace this pending section with commands verified against actual manifests for install, run, test, lint, type/static analysis and migrations. **Local workflow.**
- Document configuration names in reviewed example files with placeholders. Do not put private tokens in examples, mobile variables or logs. **Basis: [security rules](../../.agents/rules/security.md).**

## Troubleshooting the foundation

- Broken symlink: restore its relative target from the [agent guide](../../.agents/README.md). Do not maintain a second copy.
- Skill/role absent: restart the agent in this repository, check project trust/settings and supported version; use the documented manual fallback if the host lacks discovery.
- Missing graphics after clone: expected, because Git excludes the entire directory.
- App command missing: expected until scaffolding; do not invent successful build/test results.
