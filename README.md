# Workspace Extension Manager

A VSCode extension that automatically detects your project type and applies the appropriate workspace profile with recommended extensions.

## Features

- **Auto-detection**: Identifies project type (Node.js, Python, Rust, Go) on workspace startup
- **Smart Profiles**: Pre-configured extension sets optimized for each language
- **Easy Switching**: Quick pick menu to manually switch between profiles
- **Status Bar**: Shows current profile at a glance
- **Non-intrusive**: Only prompts once per workspace unless preferences change

## Supported Project Types

### Node.js
- ESLint, Prettier, Jest
- TypeScript support
- NPM IntelliSense and import cost analysis

### Python
- Pylance, Black formatter, Pylint
- Auto-docstring generation
- Smart indentation

### Rust
- rust-analyzer
- LLDB debugger
- Crates management

### Go
- Official Go extension with language server
- Auto-formatting and linting

## Installation

### From Source

1. Clone this repository
2. Install dependencies: `npm install`
3. Compile: `npm run compile`
4. Press F5 to launch extension development host

### Building VSIX

```bash
npm install -g @vscode/vsce
vsce package
```

Then install the `.vsix` file in VSCode.

## Usage

### Automatic Detection

The extension automatically runs when you open a workspace:
1. Detects project type from files (`package.json`, `requirements.txt`, etc.)
2. Prompts to apply the recommended profile
3. Installs missing extensions and applies settings

### Manual Profile Switching

- Click the profile indicator in the status bar (bottom right)
- Or run command: `Workspace Extension Manager: Switch Profile`
- Select desired profile from the quick pick menu

### Commands

- `Workspace Extension Manager: Detect Project Type and Apply Profile` - Re-run detection
- `Workspace Extension Manager: Switch Profile` - Manually choose a profile
- `Workspace Extension Manager: Show Current Profile` - Display active profile info

## Configuration

```json
{
  "workspace-extension-manager.autoDetect": true
}
```

Set to `false` to disable automatic profile detection for a workspace.

## Development

### Project Structure

```
workspace-extension-manager/
├── src/
│   ├── extension.ts       # Main activation and command registration
│   ├── detector.ts        # Project type detection logic
│   ├── profiles.ts        # Profile configuration loading
│   ├── profileManager.ts  # Extension installation and settings
│   └── ui.ts              # Status bar and user prompts
├── profiles/              # Profile definitions (JSON)
└── out/                   # Compiled JavaScript
```

### Building

```bash
npm run compile       # Compile TypeScript
npm run watch         # Watch mode for development
npm run lint          # Run ESLint
```

### Adding New Profiles

1. Create `profiles/yourtype.json` with extension IDs and settings
2. Add detection rules in `src/detector.ts`
3. The profile will be automatically available

## License

MIT
