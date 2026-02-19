import * as vscode from 'vscode';
import { detectProjectType, ProjectType } from './detector';
import { getProfileConfig } from './profiles';
import { ProfileManager } from './profileManager';
import { ProfileStatusBar, promptForProfileApplication, showProfilePicker, showNotification } from './ui';

let statusBar: ProfileStatusBar;
let profileManager: ProfileManager;
let extensionContext: vscode.ExtensionContext;

export async function activate(context: vscode.ExtensionContext) {
    console.log('🚀 Workspace Extension Manager is now active!');

    // Store context for later use
    extensionContext = context;

    // Initialize components
    statusBar = new ProfileStatusBar();
    profileManager = new ProfileManager();

    console.log('📋 Registering commands...');

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'workspace-extension-manager.detectAndApply',
            () => detectAndApplyProfile(true)
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'workspace-extension-manager.switchProfile',
            switchProfile
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'workspace-extension-manager.showCurrentProfile',
            showCurrentProfile
        )
    );

    // Auto-detect on startup if enabled
    const config = vscode.workspace.getConfiguration('workspace-extension-manager');
    const autoDetect = config.get<boolean>('autoDetect', true);

    console.log(`⚙️  Auto-detect enabled: ${autoDetect}`);
    console.log(`📁 Workspace folders: ${vscode.workspace.workspaceFolders?.length || 0}`);

    if (autoDetect && vscode.workspace.workspaceFolders) {
        console.log('⏳ Scheduling auto-detection in 2 seconds...');
        // Run detection after a short delay to let VSCode fully initialize
        setTimeout(() => detectAndApplyProfile(false), 2000);
    }

    context.subscriptions.push(statusBar);

    console.log('✅ Workspace Extension Manager activation complete');
}

async function detectAndApplyProfile(forcePrompt: boolean = false): Promise<void> {
    console.log('🔍 Starting project type detection...');

    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        console.log('❌ No workspace folder open');
        showNotification('No workspace folder open', 'warning');
        return;
    }

    // Detect project type for the first workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    console.log(`📂 Detecting project type in: ${workspaceFolder.uri.fsPath}`);

    const projectType = await detectProjectType(workspaceFolder);
    console.log(`🎯 Detected project type: ${projectType}`);

    statusBar.show(projectType);

    if (projectType === 'unknown') {
        console.log('ℹ️  Unknown project type, skipping profile application');
        showNotification('Could not detect project type', 'info');
        return;
    }

    // Check if we've already applied a profile for this workspace
    const appliedProfile = extensionContext.workspaceState.get<string>('appliedProfile');
    const hasPrompted = extensionContext.workspaceState.get<boolean>('hasPrompted', false);

    console.log(`📋 Applied profile: ${appliedProfile || 'none'}`);
    console.log(`📋 Has prompted: ${hasPrompted}`);

    // Skip if we've already applied this profile and not forcing
    if (!forcePrompt && appliedProfile === projectType) {
        console.log(`✅ Profile "${projectType}" already applied, skipping prompt`);
        return;
    }

    // Skip if we've already prompted and user declined
    if (!forcePrompt && hasPrompted && !appliedProfile) {
        console.log('⏭️  User previously declined, skipping prompt');
        return;
    }

    const profileConfig = getProfileConfig(projectType);

    if (!profileConfig) {
        console.log(`⚠️  No profile config found for ${projectType}`);
        showNotification(`No profile available for ${projectType}`, 'warning');
        return;
    }

    console.log(`📝 Found profile config: ${profileConfig.name}`);
    console.log(`📦 Extensions in profile: ${profileConfig.extensions.length}`);

    // Check which extensions are missing
    const missingExtensions = await profileManager.getMissingExtensions(profileConfig.extensions);
    console.log(`📦 Missing extensions: ${missingExtensions.length}`);

    // If all extensions are already installed and profile was applied, skip
    if (!forcePrompt && missingExtensions.length === 0 && appliedProfile === projectType) {
        console.log('✅ All extensions already installed, skipping');
        return;
    }

    // Mark that we've prompted
    await extensionContext.workspaceState.update('hasPrompted', true);

    // Prompt user to apply profile
    const shouldApply = await promptForProfileApplication(projectType, profileConfig);
    console.log(`👤 User response: ${shouldApply ? 'Apply' : 'Declined'}`);

    if (shouldApply) {
        const success = await profileManager.applyProfile(profileConfig);
        if (success) {
            // Remember that we applied this profile
            await extensionContext.workspaceState.update('appliedProfile', projectType);
            await profileManager.promptForReload();
        }
    }
}

async function switchProfile(): Promise<void> {
    const selectedType = await showProfilePicker();

    if (!selectedType) {
        return;
    }

    const profileConfig = getProfileConfig(selectedType);

    if (!profileConfig) {
        showNotification(`Profile not found for ${selectedType}`, 'error');
        return;
    }

    const success = await profileManager.applyProfile(profileConfig);

    if (success) {
        statusBar.show(selectedType);
        // Remember the applied profile
        await extensionContext.workspaceState.update('appliedProfile', selectedType);
        await profileManager.promptForReload();
    }
}

async function showCurrentProfile(): Promise<void> {
    const currentProfile = await profileManager.getCurrentProfile();

    if (currentProfile) {
        showNotification(`Current profile: ${currentProfile}`, 'info');
    } else {
        showNotification('No profile information available', 'info');
    }
}

export function deactivate() {
    if (statusBar) {
        statusBar.dispose();
    }
}
