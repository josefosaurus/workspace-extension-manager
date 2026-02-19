import * as vscode from 'vscode';
import { ProjectType } from './detector';
import { ProfileConfig, getAvailableProfiles, getProfileConfig } from './profiles';

export class ProfileStatusBar {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'workspace-extension-manager.switchProfile';
        this.statusBarItem.tooltip = 'Click to switch workspace profile';
    }

    show(projectType: ProjectType): void {
        if (projectType === 'unknown') {
            this.statusBarItem.text = '$(gear) No Profile';
        } else {
            this.statusBarItem.text = `$(gear) ${projectType.charAt(0).toUpperCase() + projectType.slice(1)}`;
        }
        this.statusBarItem.show();
    }

    hide(): void {
        this.statusBarItem.hide();
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}

export async function promptForProfileApplication(
    projectType: ProjectType,
    config: ProfileConfig
): Promise<boolean> {
    const extensionList = config.extensions.slice(0, 5).join(', ');
    const moreExtensions = config.extensions.length > 5
        ? ` and ${config.extensions.length - 5} more`
        : '';

    const message = `Detected ${projectType} project. Apply "${config.name}" profile?`;
    const detail = `Extensions: ${extensionList}${moreExtensions}`;

    const choice = await vscode.window.showInformationMessage(
        message,
        { modal: false, detail },
        'Apply',
        'Not Now',
        'Never for this workspace'
    );

    if (choice === 'Apply') {
        return true;
    } else if (choice === 'Never for this workspace') {
        // Store preference to never prompt again
        await vscode.workspace.getConfiguration('workspace-extension-manager')
            .update('autoDetect', false, vscode.ConfigurationTarget.Workspace);
    }

    return false;
}

export async function showProfilePicker(): Promise<ProjectType | null> {
    const availableProfiles = getAvailableProfiles();

    if (availableProfiles.length === 0) {
        vscode.window.showWarningMessage('No profiles available');
        return null;
    }

    interface ProfileQuickPickItem extends vscode.QuickPickItem {
        profileType: ProjectType;
    }

    const items: ProfileQuickPickItem[] = availableProfiles
        .filter(p => p !== 'unknown')
        .map(profileType => {
            const config = getProfileConfig(profileType);
            return {
                label: config?.name || profileType,
                description: config ? `${config.extensions.length} extensions` : '',
                detail: config?.extensions.slice(0, 3).join(', '),
                profileType
            };
        });

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a workspace profile to apply',
        matchOnDescription: true,
        matchOnDetail: true
    });

    return selected?.profileType || null;
}

export function showNotification(
    message: string,
    type: 'info' | 'warning' | 'error' = 'info'
): void {
    switch (type) {
        case 'info':
            vscode.window.showInformationMessage(message);
            break;
        case 'warning':
            vscode.window.showWarningMessage(message);
            break;
        case 'error':
            vscode.window.showErrorMessage(message);
            break;
    }
}
