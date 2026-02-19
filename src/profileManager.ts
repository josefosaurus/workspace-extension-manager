import * as vscode from 'vscode';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as os from 'os';
import { ProfileConfig, generateCodeProfileContent } from './profiles';

interface MarketplaceExtensionInfo {
    deprecated: boolean;
    notFound: boolean;
    replacement?: string;
}

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

            // Disable non-profile extensions if configured (non-fatal)
            const extConfig = vscode.workspace.getConfiguration('workspace-extension-manager');
            const shouldDisable = extConfig.get<boolean>('disableOtherExtensions', true);
            if (shouldDisable) {
                try {
                    await this.disableNonProfileExtensions(config.extensions);
                } catch (e) {
                    console.warn('⚠️ disableNonProfileExtensions failed:', e);
                }
            }

            // Apply settings if provided
            if (config.settings) {
                await this.applySettings(config.settings);
            }

            vscode.window.showInformationMessage(
                `Profile "${config.name}" applied. Non-profile extensions disabled globally. Reload to activate changes.`
            );

            return true;
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to apply profile: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            return false;
        }
    }

    private async disableNonProfileExtensions(profileExtensions: string[]): Promise<void> {
        const profileSet = new Set(profileExtensions.map(id => id.toLowerCase()));
        const vscodePath = path.join(os.homedir(), '.vscode', 'extensions');

        const toDisable = vscode.extensions.all.filter(ext => {
            // Keep extensions that are part of the profile
            if (profileSet.has(ext.id.toLowerCase())) {
                return false;
            }
            // Keep this extension itself
            if (ext.id.toLowerCase().includes('workspace-extension-manager')) {
                return false;
            }
            // Keep built-in extensions (not installed in ~/.vscode/extensions)
            if (!ext.extensionPath.startsWith(vscodePath)) {
                return false;
            }

            const pkg = ext.packageJSON as any;
            const contributes = pkg?.contributes ?? {};
            const categories: string[] = pkg?.categories ?? [];

            // Keep theme extensions (color themes, icon themes, product icon themes)
            if (
                (contributes.themes?.length ?? 0) > 0 ||
                (contributes.iconThemes?.length ?? 0) > 0 ||
                (contributes.productIconThemes?.length ?? 0) > 0 ||
                categories.includes('Themes')
            ) {
                return false;
            }

            // Keep AI / ML extensions
            if (categories.some((c: string) => ['AI', 'Machine Learning', 'Data Science'].includes(c))) {
                return false;
            }

            return true;
        });

        if (toDisable.length === 0) {
            console.log('✅ No non-profile extensions to disable.');
            return;
        }

        console.log(`🚫 Disabling ${toDisable.length} non-profile extensions...`);

        // Try each candidate command directly rather than pre-checking with
        // getCommands(), because internal workbench commands may not appear in
        // that list even though they are available.
        const candidates = [
            'workbench.extensions.disableExtension',
            'workbench.extensions.action.disableExtension',
        ];

        let disableCommandId: string | null = null;

        // Probe with the first extension to find a working command
        const probe = toDisable[0];
        for (const cmd of candidates) {
            try {
                await vscode.commands.executeCommand(cmd, probe.id);
                disableCommandId = cmd;
                console.log(`  ⊘ Disabled ${probe.id} (using ${cmd})`);
                break;
            } catch {
                // This candidate command is not available, try next
            }
        }

        if (!disableCommandId) {
            console.warn('⚠️ No extension-disable command available in this VS Code version.');
            vscode.window.showWarningMessage(
                'Could not disable non-profile extensions: no supported disable command was found. ' +
                'Please update VS Code to the latest version or disable unneeded extensions manually.'
            );
            return;
        }

        // Disable the remaining extensions using the command that worked
        for (let i = 1; i < toDisable.length; i++) {
            const ext = toDisable[i];
            try {
                console.log(`  ⊘ Disabling ${ext.id}`);
                await vscode.commands.executeCommand(disableCommandId, ext.id);
            } catch (e) {
                console.warn(`  ⚠️ Could not disable ${ext.id}:`, e);
            }
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

        console.log(`🔍 Checking marketplace for ${missing.length} extensions...`);
        const marketplaceInfo = await this.checkExtensionsDeprecation(missing);

        const toInstall: string[] = [];
        for (const extId of missing) {
            const info = marketplaceInfo.get(extId.toLowerCase());
            if (info?.notFound) {
                console.warn(`⚠️ Extension not found on marketplace, skipping: ${extId}`);
                vscode.window.showWarningMessage(`Extension "${extId}" was not found on the marketplace and will be skipped.`);
            } else if (info?.deprecated) {
                const msg = info.replacement
                    ? `Extension "${extId}" is deprecated. Consider using "${info.replacement}" instead.`
                    : `Extension "${extId}" is deprecated and will be skipped.`;
                console.warn(`⚠️ ${msg}`);
                vscode.window.showWarningMessage(msg);
            } else {
                toInstall.push(extId);
            }
        }

        if (toInstall.length === 0) {
            console.log('⚠️ No extensions to install after deprecation check');
            return;
        }

        console.log(`📦 Installing ${toInstall.length} missing extensions...`);

        for (const extId of toInstall) {
            try {
                console.log(`⏬ Installing ${extId}...`);
                await vscode.commands.executeCommand('workbench.extensions.installExtension', extId);
                console.log(`✅ Installed ${extId}`);
            } catch (error) {
                console.warn(`❌ Could not install extension ${extId}:`, error);
            }
        }
    }

    private checkExtensionsDeprecation(extensionIds: string[]): Promise<Map<string, MarketplaceExtensionInfo>> {
        const result = new Map<string, MarketplaceExtensionInfo>();
        for (const id of extensionIds) {
            result.set(id.toLowerCase(), { deprecated: false, notFound: false });
        }

        return new Promise((resolve) => {
            const body = JSON.stringify({
                filters: [{
                    criteria: extensionIds.map(id => ({ filterType: 7, value: id }))
                }],
                // IncludeVersions (0x1) | IncludeVersionProperties (0x10) | IncludeLatestVersionOnly (0x200)
                flags: 0x211
            });

            const options: https.RequestOptions = {
                hostname: 'marketplace.visualstudio.com',
                path: '/_apis/public/gallery/extensionquery',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json;api-version=7.1-preview.1',
                    'Content-Length': Buffer.byteLength(body)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk: string) => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        const extensions: any[] = parsed.results?.[0]?.extensions ?? [];
                        const foundIds = new Set<string>();

                        for (const ext of extensions) {
                            const id = `${ext.publisher.publisherName}.${ext.extensionName}`.toLowerCase();
                            foundIds.add(id);

                            const properties: any[] = ext.versions?.[0]?.properties ?? [];
                            const deprecationProp = properties.find(
                                (p: any) => p.key === 'Microsoft.VisualStudio.Code.Deprecation'
                            );
                            const alternateProp = properties.find(
                                (p: any) => p.key === 'Microsoft.VisualStudio.Code.AlternateExtension'
                            );

                            if (deprecationProp) {
                                result.set(id, { deprecated: true, notFound: false, replacement: alternateProp?.value });
                            }
                        }

                        for (const id of extensionIds) {
                            if (!foundIds.has(id.toLowerCase())) {
                                result.set(id.toLowerCase(), { deprecated: false, notFound: true });
                            }
                        }
                    } catch (e) {
                        console.warn('⚠️ Failed to parse marketplace response:', e);
                    }
                    resolve(result);
                });
            });

            req.setTimeout(5000, () => {
                req.destroy();
                console.warn('⚠️ Marketplace API timed out, skipping deprecation check');
                resolve(result);
            });

            req.on('error', (e: Error) => {
                console.warn('⚠️ Marketplace API request failed:', e.message);
                resolve(result);
            });

            req.write(body);
            req.end();
        });
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
