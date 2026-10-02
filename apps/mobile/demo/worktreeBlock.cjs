// Matches `<root>/.claude/worktrees` and everything below it, never other files of the root.
function agentWorktreesPattern(root) {
  const escaped = root.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return new RegExp(`^${escaped}\\/\\.claude\\/worktrees(?:\\/|$)`);
}
module.exports = { agentWorktreesPattern };
