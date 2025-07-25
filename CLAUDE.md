# Claude Development Rules

## Git Commit Guidelines

### Micro-Commit Strategy

This project follows a function-level micro-commit approach for granular change tracking and better code review.

### Commit Rules

1. **Function-Level Commits Only**
   - Each commit should represent a single, atomic function or feature change
   - Commits should be small, focused, and easily reviewable
   - Avoid bundling multiple unrelated changes in one commit

2. **Commit Prefix Convention**
   - Use the prefix format: `cc{n}` where `n` is the sequential commit number
   - Examples: `cc1`, `cc2`, `cc3`, etc.
   - This provides clear chronological ordering of micro-commits

3. **Finding the Next Commit Number**
   - Check the latest commit number using: `git log --oneline --grep="^cc" | head -1`
   - Or search commit messages for the pattern: `git log --oneline | grep -E "^[a-f0-9]+ cc[0-9]+"`
   - If no previous `cc{n}` commits exist, start with `cc1`

### Commit Message Format

```
cc{n}: Brief description of the change

Optional detailed explanation of:
- What was changed
- Why it was changed
- Any important implementation details

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Examples

```bash
# Good micro-commits
cc1: Add TypeScript configuration and build setup
cc2: Convert check_os.js to TypeScript with proper types
cc3: Fix control script injection path for flattened dist structure
cc4: Update manifest.json to reference JavaScript files directly

# Avoid large bundled commits
❌ cc1: Convert entire project to TypeScript and fix all issues
```

### Implementation Notes

- Use `git log --oneline | grep -E "cc[0-9]+" | head -1` to find the latest commit number
- Increment the number for each new micro-commit
- Maintain consistency with the existing project's commit style
- Each commit should pass basic functionality tests

### Benefits

- **Granular History**: Easy to track specific changes and their impact
- **Better Reviews**: Smaller commits are easier to review and understand  
- **Selective Reverts**: Ability to revert specific changes without affecting others
- **Clear Progress**: Sequential numbering shows development progression