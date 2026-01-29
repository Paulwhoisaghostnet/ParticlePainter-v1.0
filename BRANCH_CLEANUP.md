# Branch Cleanup Guide

## Current Situation

The repository has accumulated stale branches that were not deleted after their PRs were merged. While all PRs have been successfully merged to `main`, the source branches remain.

## Stale Branches to Delete

The following branches have been merged via PRs and can be safely deleted:

| Branch | Associated PR | Merged |
|--------|--------------|--------|
| `copilot/add-logging-for-mp4-export` | PR #7 | ✅ |
| `copilot/add-loop-recording-toggle` | PR #10 | ✅ |
| `copilot/add-rolling-buffer-functionality` | PR #9 | ✅ |
| `copilot/fix-html-export-particle-effects` | PR #8 | ✅ |
| `copilot/fix-mp4-export-issues` | PR #4 | ✅ |
| `copilot/fix-particle-shape-change` | PR #6 | ✅ |
| `copilot/fix-particle-shape-issue` | PR #3 | ✅ |
| `copilot/fix-particle-shape-override` | PR #2 | ✅ |
| `copilot/fix-particle-shape-parameter` | PR #5 | ✅ |
| `copilot/wasm-ported-version` | PR #1 | ✅ |

## How to Clean Up

### Option 1: Using the Cleanup Script (Recommended)

A cleanup script is provided in this repository:

```bash
# Make the script executable
chmod +x scripts/cleanup-stale-branches.sh

# Run the script
./scripts/cleanup-stale-branches.sh
```

The script will show you which branches will be deleted and ask for confirmation before proceeding.

### Option 2: Using GitHub UI

1. Go to https://github.com/Paulwhoisaghostnet/ParticlePainter-v1.0/branches
2. Click the trash icon next to each stale branch
3. Confirm deletion

### Option 3: Using Command Line

Run these commands to delete all stale branches:

```bash
# Delete remote branches one by one
git push origin --delete copilot/add-logging-for-mp4-export
git push origin --delete copilot/add-loop-recording-toggle
git push origin --delete copilot/add-rolling-buffer-functionality
git push origin --delete copilot/fix-html-export-particle-effects
git push origin --delete copilot/fix-mp4-export-issues
git push origin --delete copilot/fix-particle-shape-change
git push origin --delete copilot/fix-particle-shape-issue
git push origin --delete copilot/fix-particle-shape-override
git push origin --delete copilot/fix-particle-shape-parameter
git push origin --delete copilot/wasm-ported-version
```

### Option 4: One-Liner Script

```bash
# Delete all stale copilot branches (except fix-branch-merge-issues which is this PR)
for branch in copilot/add-logging-for-mp4-export copilot/add-loop-recording-toggle copilot/add-rolling-buffer-functionality copilot/fix-html-export-particle-effects copilot/fix-mp4-export-issues copilot/fix-particle-shape-change copilot/fix-particle-shape-issue copilot/fix-particle-shape-override copilot/fix-particle-shape-parameter copilot/wasm-ported-version; do
  git push origin --delete "$branch"
done
```

## Preventing Future Branch Accumulation

### Enable Auto-Delete in GitHub Settings

1. Go to **Settings** → **General** → **Pull Requests**
2. Check ✅ **Automatically delete head branches**

This setting will automatically delete branches after PRs are merged, preventing this issue in the future.

## Branches to Keep

- `main` - The default/production branch
- `copilot/fix-branch-merge-issues` - Current working branch (delete after this PR is merged)
