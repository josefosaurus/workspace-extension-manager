# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VSCode extension called **Workspace Extension Manager** that auto-detects project types and applies appropriate extension sets to the workspace.

## Development Commands

```bash
npm install              # Install dependencies
npm run compile          # Compile TypeScript to out/
npm run watch            # Watch mode for development
```

No tests or linting are configured. Manual testing is done via the Extension Development Host (F5 in VSCode). See `TESTING_GUIDE.md` for test scenarios and `QUICK_TEST.sh` to scaffold a test workspace at `~/workspace-ext-test`.

### Packaging
```bash
npm install -g @vscode/vsce
vsce package             # Creates .vsix for distribution
```

## Architecture

The extension activates on `onStartupFinished` (with a 2-second delay), detects project type, and offers to install missing extensions and apply workspace settings.

### Module Responsibilities

- `detector.ts` — Scans workspace root for marker files using a scoring system (`matchCount × priority`). Reads `excludedFolders` from config (user-provided list **replaces** defaults entirely). Exports `detectProjectType()` and `detectAllWorkspaceTypes()`.
- `profiles.ts` — Loads `profiles/*.json` at runtime relative to `__dirname` (i.e., `out/../profiles/`). `getAvailableProfiles()` reads the directory dynamically, so new JSON files are picked up automatically.
- `profileManager.ts` — Installs extensions via `workbench.extensions.installExtension` and writes workspace settings via `vscode.ConfigurationTarget.Workspace`. `getCurrentProfile()` is not implemented (always returns `null`).
- `extension.ts` — Orchestrates startup flow; uses `workspaceState` (`appliedProfile`, `hasPrompted`) to avoid re-prompting. Only the first workspace folder is used for detection, even in multi-root workspaces.
- `ui.ts` — Status bar item (bottom right, clicking opens profile picker), prompt dialog, and `showProfilePicker()` quick pick.

### Profile Files (`profiles/*.json`)

```json
{
  "name": "Display Name",
  "extensions": ["publisher.extension-id"],
  "settings": { "editor.formatOnSave": true }
}
```

Settings are applied to workspace configuration (`.vscode/settings.json`), not user settings.

### Detection Rules (`detector.ts`)

| Type   | Marker Files |
|--------|-------------|
| node   | package.json, tsconfig.json, yarn.lock, pnpm-lock.yaml |
| python | requirements.txt, setup.py, pyproject.toml, Pipfile, poetry.lock, .python-version |
| rust   | Cargo.toml, Cargo.lock |
| go     | go.mod, go.sum |

Scoring: `matchCount × priority` (all priorities currently 1). Ties go to first rule in array.

## Adding New Project Types

1. Create `profiles/yourtype.json`
2. Add a rule to `detectionRules` in `detector.ts`
3. Add `'yourtype'` to the `ProjectType` union type in `detector.ts`

## Configuration

- **`workspace-extension-manager.autoDetect`** (boolean, default: `true`) — Enable/disable startup detection per workspace.
- **`workspace-extension-manager.disableOtherExtensions`** (boolean, default: `true`) — When applying a profile, disable all user-installed extensions not in the profile. **Disable is global (not workspace-scoped)** due to VS Code API limitations — there is no public API for workspace-scoped programmatic disabling. Reload is required to apply.
- **`workspace-extension-manager.excludedFolders`** (string[], default: `node_modules`, `.git`, `build`, `dist`, `venv`, etc.) — Folders excluded from root-level scanning. **If any folders are configured, the entire default list is replaced.**

## VSCode API Constraints

- No programmatic API to create/switch named profiles — the extension works around this by directly installing extensions and applying workspace settings.
- `workbench.extensions.disableExtension` operates **globally**, not per-workspace. This is the standard pattern used by community profile-switcher extensions. The notification message communicates this to the user.
- Profile export format (`.code-profile`) is supported via `generateCodeProfileContent()` / `exportProfile()` but these are not used in the current activation flow.
- Platform-specific profile storage paths:
  - macOS: `~/Library/Application Support/Code/User/profiles/`
  - Windows: `~/AppData/Roaming/Code/User/profiles/`
  - Linux: `~/.config/Code/User/profiles/`

## Workspace State Keys

| Key | Type | Purpose |
|-----|------|---------|
| `appliedProfile` | `string` | Which profile type was applied (e.g., `'node'`) |
| `hasPrompted` | `boolean` | Whether user has been shown the prompt before |
