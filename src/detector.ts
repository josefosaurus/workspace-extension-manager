import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export type ProjectType = 'node' | 'python' | 'rust' | 'go' | 'unknown';

interface DetectionRule {
    type: ProjectType;
    files: string[];
    priority: number;
}

// Folders to exclude from scanning
const EXCLUDED_FOLDERS = [
    'node_modules',
    '.git',
    '.vscode',
    'libraries',
    'vendor',
    'build',
    'dist',
    'out',
    '.next',
    '.nuxt',
    'target',
    '__pycache__',
    '.pytest_cache',
    'venv',
    '.venv',
    'env',
    '.env'
];

const detectionRules: DetectionRule[] = [
    {
        type: 'node',
        files: ['package.json', 'tsconfig.json', 'yarn.lock', 'pnpm-lock.yaml'],
        priority: 1
    },
    {
        type: 'python',
        files: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile', 'poetry.lock', '.python-version'],
        priority: 1
    },
    {
        type: 'rust',
        files: ['Cargo.toml', 'Cargo.lock'],
        priority: 1
    },
    {
        type: 'go',
        files: ['go.mod', 'go.sum'],
        priority: 1
    }
];

/**
 * Get excluded folders from configuration
 */
function getExcludedFolders(): string[] {
    const config = vscode.workspace.getConfiguration('workspace-extension-manager');
    const userExcluded = config.get<string[]>('excludedFolders', []);

    // Merge with default excluded folders
    return userExcluded.length > 0 ? userExcluded : EXCLUDED_FOLDERS;
}

/**
 * Check if a file path contains any excluded folder
 */
function isPathExcluded(filePath: string, rootPath: string, excludedFolders: string[]): boolean {
    const relativePath = path.relative(rootPath, filePath);
    const pathParts = relativePath.split(path.sep);

    // Check if any part of the path matches excluded folders
    return pathParts.some(part => excludedFolders.includes(part));
}

export async function detectProjectType(workspaceFolder: vscode.WorkspaceFolder): Promise<ProjectType> {
    const rootPath = workspaceFolder.uri.fsPath;
    const excludedFolders = getExcludedFolders();

    console.log('🔍 Scanning workspace:', rootPath);
    console.log('🚫 Excluded folders:', excludedFolders.join(', '));

    const detectedTypes: { type: ProjectType; score: number }[] = [];

    for (const rule of detectionRules) {
        let matchCount = 0;

        for (const file of rule.files) {
            const filePath = path.join(rootPath, file);

            // Skip if path is in an excluded folder
            if (isPathExcluded(filePath, rootPath, excludedFolders)) {
                console.log(`⏭️  Skipping excluded path: ${file}`);
                continue;
            }

            if (fs.existsSync(filePath)) {
                console.log(`✅ Found marker file: ${file}`);
                matchCount++;
            }
        }

        if (matchCount > 0) {
            detectedTypes.push({
                type: rule.type,
                score: matchCount * rule.priority
            });
        }
    }

    if (detectedTypes.length === 0) {
        return 'unknown';
    }

    // Sort by score descending
    detectedTypes.sort((a, b) => b.score - a.score);

    return detectedTypes[0].type;
}

export async function detectAllWorkspaceTypes(): Promise<Map<vscode.WorkspaceFolder, ProjectType>> {
    const results = new Map<vscode.WorkspaceFolder, ProjectType>();

    if (!vscode.workspace.workspaceFolders) {
        return results;
    }

    for (const folder of vscode.workspace.workspaceFolders) {
        const type = await detectProjectType(folder);
        results.set(folder, type);
    }

    return results;
}
