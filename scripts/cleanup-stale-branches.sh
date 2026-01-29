#!/bin/bash
# cleanup-stale-branches.sh
# Script to delete stale branches that have been merged to main

set -e

echo "🧹 ParticlePainter Branch Cleanup Script"
echo "========================================="
echo ""

# Branches to delete (all have been merged via PRs #1-10)
STALE_BRANCHES=(
  "copilot/add-logging-for-mp4-export"
  "copilot/add-loop-recording-toggle"
  "copilot/add-rolling-buffer-functionality"
  "copilot/fix-html-export-particle-effects"
  "copilot/fix-mp4-export-issues"
  "copilot/fix-particle-shape-change"
  "copilot/fix-particle-shape-issue"
  "copilot/fix-particle-shape-override"
  "copilot/fix-particle-shape-parameter"
  "copilot/wasm-ported-version"
)

echo "The following branches will be deleted:"
for branch in "${STALE_BRANCHES[@]}"; do
  echo "  - $branch"
done
echo ""

read -p "Do you want to proceed? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "Deleting branches..."
  echo ""
  
  for branch in "${STALE_BRANCHES[@]}"; do
    echo "Deleting $branch..."
    output=$(git push origin --delete "$branch" 2>&1) && {
      echo "  ✅ Deleted $branch"
    } || {
      if echo "$output" | grep -q "remote ref does not exist"; then
        echo "  ⚠️  Branch $branch already deleted"
      else
        echo "  ❌ Failed to delete $branch:"
        echo "     $output"
      fi
    }
  done
  
  echo ""
  echo "✨ Branch cleanup complete!"
  echo ""
  echo "Remaining branches:"
  git ls-remote --heads origin | awk '{print "  - " $2}' | sed 's|refs/heads/||'
else
  echo "Aborted."
fi
