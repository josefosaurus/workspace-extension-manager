#!/bin/bash

# Quick test script for Workspace Extension Manager

echo "🧪 Setting up test workspace..."

# Create test directory
TEST_DIR="$HOME/workspace-ext-test"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "📝 Creating test files..."

# Create a package.json for Node.js detection
cat > package.json << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0",
  "description": "Test project for extension"
}
EOF

# Create a libraries folder to test exclusion
mkdir -p libraries/bluetooth
cat > libraries/bluetooth/package.json << 'EOF'
{
  "name": "fake-library",
  "description": "This should be excluded from detection"
}
EOF

echo ""
echo "✅ Test workspace created at: $TEST_DIR"
echo ""
echo "📋 Next steps:"
echo "1. In VSCode, press Cmd+Shift+P"
echo "2. Type: 'Developer: Reload Window'"
echo "3. After reload, press F5"
echo "4. In the Extension Development Host window:"
echo "   - File → Open Folder → Select: $TEST_DIR"
echo "5. Wait 2 seconds and watch for the prompt!"
echo ""
echo "Expected: Detects 'node' type (ignores libraries/bluetooth)"
echo ""
