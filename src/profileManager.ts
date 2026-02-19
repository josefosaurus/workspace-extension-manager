import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProfileConfig, generateCodeProfileContent } from './profiles';

export class ProfileManager {
    private getProfilesDirectory(): string {
        // VSCode stores profiles in user data directory
        const platform = process.platform;
        let baseDir: string;

        if (platform === 'darwin') {
            baseDir = path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'profiles');
        } else if (platform === 'win32') {
            baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'profiles');
        } else {
            baseDir = path.join(os.homedir(), '.config', 'Code', 'User', 'profiles');
        }

        return baseDir;
    }

    async applyProfile(config: ProfileConfig): Promise<boolean> {
        try {
            // First, try to install missing extensions
            await this.installMissingExtensions(config.extensions);

            // Apply settings if provided
            if (config.settings) {
                await this.applySettings(config.settings);
            }

            vscode.window.showInformationMessage(
                `Profile "${config.name}" applied successfully. Some extensions may require reload.`
            );

            return true;
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to apply profile: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            return false;
        }
    }

    async getMissingExtensions(extensionIds: string[]): Promise<string[]> {
        const installedExtensions = vscode.extensions.all.map(ext => ext.id.toLowerCase());
        const missing: string[] = [];

        for (const extId of extensionIds) {
            if (!installedExtensions.includes(extId.toLowerCase())) {
                missing.push(extId);
            }
        }

        return missing;
    }

    private async installMissingExtensions(extensionIds: string[]): Promise<void> {
        const missing = await this.getMissingExtensions(extensionIds);

        if (missing.length === 0) {
            console.log('✅ All extensions already installed');
            return;
        }

        console.log(`📦 Installing ${missing.length} missing extensions...`);

        for (const extId of missing) {
            try {
                console.log(`⏬ Installing ${extId}...`);
                await vscode.commands.executeCommand('workbench.extensions.installExtension', extId);
                console.log(`✅ Installed ${extId}`);
            } catch (error) {
                console.warn(`❌ Could not install extension ${extId}:`, error);
            }
        }
    }

    private async applySettings(settings: Record<string, any>): Promise<void> {
        const config = vscode.workspace.getConfiguration();

        for (const [key, value] of Object.entries(settings)) {
            try {
                await config.update(key, value, vscode.ConfigurationTarget.Workspace);
            } catch (error) {
                console.warn(`Could not apply setting ${key}:`, error);
            }
        }
    }

    async getCurrentProfile(): Promise<string | null> {
        // Try to get current profile name from VSCode
        try {
            // This is an internal API that may not be available
            // Fall back to checking configuration or extension state
            return null;
        } catch {
            return null;
        }
    }

    async exportProfile(config: ProfileConfig, outputPath: string): Promise<void> {
        const content = generateCodeProfileContent(config);
        fs.writeFileSync(outputPath, content, 'utf-8');
    }

    async promptForReload(): Promise<void> {
        const reload = await vscode.window.showInformationMessage(
            'Extensions have been installed. Reload window to activate them?',
            'Reload',
            'Later'
        );

        if (reload === 'Reload') {
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    }
}
