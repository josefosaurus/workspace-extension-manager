# Complete Testing Guide for Workspace Extension Manager

## Pre-Test Checklist
✅ Extension compiled successfully
✅ Fresh test workspace created at: `/Users/josefosaurus/workspace-test-fresh`
✅ Test workspace has `package.json` (for Node.js detection)
✅ Test workspace has `libraries/bluetooth/` folder (to verify exclusion)

---

## Test Scenario 1: First Time Opening Workspace

### Steps:
1. **Start Debugging** (in this project):
   ```
   Press F5
   ```
   - Wait for Extension Development Host window to open

2. **Open Test Workspace**:
   - In the Extension Development Host window:
   - File → Open Folder
   - Select: `/Users/josefosaurus/workspace-test-fresh`

3. **Open Debug Console** (in the ORIGINAL window, not Extension Development Host):
   ```
   View → Debug Console
   OR
   Cmd+Shift+Y
   ```

### Expected Results (after ~2 seconds):

**✅ Debug Console should show:**
```
🚀 Workspace Extension Manager is now active!
📋 Registering commands...
⚙️  Auto-detect enabled: true
📁 Workspace folders: 1
⏳ Scheduling auto-detection in 2 seconds...
✅ Workspace Extension Manager activation complete
🔍 Starting project type detection...
📂 Detecting project type in: /Users/josefosaurus/workspace-test-fresh
🔍 Scanning workspace: /Users/josefosaurus/workspace-test-fresh
🚫 Excluded folders: node_modules, .git, libraries, vendor, ...
⏭️  Skipping excluded path: libraries/...  ← IMPORTANT: Should skip libraries!
✅ Found marker file: package.json
🎯 Detected project type: node
📋 Applied profile: none  ← First time!
📋 Has prompted: false
📝 Found profile config: Node.js Development
📦 Extensions in profile: 7
📦 Missing extensions: [number]
```

**✅ Notification should appear:**
```
"Detected node project. Apply 'Node.js Development' profile?"
[Apply] [Not Now] [Never for this workspace]
```

**✅ Status Bar (bottom right):**
```
⚙️ Node
```

4. **Click "Apply"**

**✅ Should show:**
```
📦 Installing [X] missing extensions...
⏬ Installing dbaeumer.vscode-eslint...
✅ Installed dbaeumer.vscode-eslint
...
```

**✅ Reload prompt:**
```
"Extensions have been installed. Reload window to activate them?"
[Reload] [Later]
```

5. **Click "Later" (don't reload yet)**

---

## Test Scenario 2: Second Time Opening (No Prompt)

### Steps:
1. **Close the Extension Development Host window** (the test workspace)

2. **Press F5 again** to launch a new Extension Development Host

3. **Open the SAME test workspace**:
   - File → Open Folder
   - Select: `/Users/josefosaurus/workspace-test-fresh`

### Expected Results (after ~2 seconds):

**✅ Debug Console should show:**
```
🚀 Workspace Extension Manager is now active!
...
🔍 Starting project type detection...
🎯 Detected project type: node
📋 Applied profile: node  ← Already applied!
📋 Has prompted: true
✅ Profile "node" already applied, skipping prompt  ← KEY LINE!
```

**❌ NO notification should appear**
**✅ Status bar still shows:** `⚙️ Node`
**✅ No extension installation happens**

---

## Test Scenario 3: Manual Command (Force Prompt)

### Steps:
1. **With the test workspace still open**, run:
   ```
   Cmd+Shift+P → Type: "Detect Project Type"
   Select: "Detect Project Type and Apply Profile"
   ```

### Expected Results:

**✅ Debug Console should show:**
```
🔍 Starting project type detection...
(forcePrompt = true)  ← Forced!
📦 Missing extensions: 0  ← Already installed
```

**✅ Notification appears again:**
```
"Detected node project. Apply 'Node.js Development' profile?"
```

**✅ If you click Apply:**
```
✅ All extensions already installed
Profile "Node.js Development" applied successfully
```

---

## Test Scenario 4: Switch Profile

### Steps:
1. **Create a Python file** in the test workspace:
   ```bash
   echo "print('hello')" > /Users/josefosaurus/workspace-test-fresh/test.py
   echo "flask==2.0.0" > /Users/josefosaurus/workspace-test-fresh/requirements.txt
   ```

2. **Run the switch command**:
   ```
   Cmd+Shift+P → Type: "Switch"
   Select: "Switch Workspace Profile"
   ```

3. **Select "Python Development"** from the list

### Expected Results:

**✅ Shows profile picker with:**
- Node.js Development (7 extensions)
- Python Development (7 extensions)
- Rust Development (4 extensions)
- Go Development (1 extension)

**✅ After selecting Python:**
```
📦 Installing [X] missing Python extensions...
Profile "Python Development" applied successfully
```

**✅ Workspace state updated:**
```
Applied profile: python (changed from node)
```

---

## Troubleshooting

### Issue: Extension doesn't activate
- Check if F5 launched Extension Development Host
- Look for errors in Debug Console
- Verify compilation succeeded

### Issue: Prompt appears every time
- Check Debug Console for "Applied profile: node"
- Verify workspace state is being saved
- Try running manual command to force state update

### Issue: Libraries folder not excluded
- Look for: `⏭️  Skipping excluded path:` in Debug Console
- Verify excludedFolders configuration

### Issue: Extensions install every time
- Check: `📦 Missing extensions: 0` in Debug Console
- Verify extensions actually installed (Extensions sidebar)

---

## Reset Test

To reset and test from scratch:
```bash
# Close Extension Development Host
# Delete test workspace
rm -rf /Users/josefosaurus/workspace-test-fresh

# Re-run the test setup script
./QUICK_TEST.sh
```

---

## Success Criteria

✅ First open: Shows prompt, installs extensions
✅ Second open: No prompt, skips installation
✅ Manual command: Always prompts
✅ Libraries excluded: Debug shows "Skipping excluded path"
✅ Only missing extensions installed: Debug shows count
✅ Workspace state persists: Applied profile remembered
