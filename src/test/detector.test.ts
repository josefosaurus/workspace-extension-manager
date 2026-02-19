import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode before importing detector
vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn(() => []), // empty = use defaults
        })),
    },
}));

// Mock fs
vi.mock('fs', () => ({
    existsSync: vi.fn(() => false),
}));

import { detectProjectType } from '../detector';
import * as fs from 'fs';
import * as vscode from 'vscode';

function makeWorkspaceFolder(fsPath: string): vscode.WorkspaceFolder {
    return {
        uri: { fsPath } as vscode.Uri,
        name: 'test',
        index: 0,
    };
}

function setExistingFiles(root: string, files: string[]) {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
        files.some(f => p === `${root}/${f}` || p === `${root}\\${f}`)
    );
}

beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn(() => []),
    } as any);
});

describe('detectProjectType', () => {
    const root = '/workspace';
    const folder = makeWorkspaceFolder(root);

    it('returns unknown when no marker files exist', async () => {
        setExistingFiles(root, []);
        expect(await detectProjectType(folder)).toBe('unknown');
    });

    it('detects node from package.json', async () => {
        setExistingFiles(root, ['package.json']);
        expect(await detectProjectType(folder)).toBe('node');
    });

    it('detects node from tsconfig.json', async () => {
        setExistingFiles(root, ['tsconfig.json']);
        expect(await detectProjectType(folder)).toBe('node');
    });

    it('detects python from requirements.txt', async () => {
        setExistingFiles(root, ['requirements.txt']);
        expect(await detectProjectType(folder)).toBe('python');
    });

    it('detects python from pyproject.toml', async () => {
        setExistingFiles(root, ['pyproject.toml']);
        expect(await detectProjectType(folder)).toBe('python');
    });

    it('detects rust from Cargo.toml', async () => {
        setExistingFiles(root, ['Cargo.toml']);
        expect(await detectProjectType(folder)).toBe('rust');
    });

    it('detects go from go.mod', async () => {
        setExistingFiles(root, ['go.mod']);
        expect(await detectProjectType(folder)).toBe('go');
    });

    it('picks the type with the most marker files when mixed', async () => {
        // node has 2 matches, python has 1 → node wins
        setExistingFiles(root, ['package.json', 'tsconfig.json', 'requirements.txt']);
        expect(await detectProjectType(folder)).toBe('node');
    });

    it('skips marker files inside excluded folders (libraries/)', async () => {
        // Only file is inside libraries/ — should be excluded
        vi.mocked(fs.existsSync).mockImplementation((p) =>
            String(p).includes('libraries')
        );
        expect(await detectProjectType(folder)).toBe('unknown');
    });

    it('respects custom excludedFolders from config', async () => {
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
            get: vi.fn(() => ['custom_vendor']),
        } as any);

        vi.mocked(fs.existsSync).mockImplementation((p) =>
            String(p) === `${root}/package.json`
                ? false
                : String(p).includes('custom_vendor')
        );
        expect(await detectProjectType(folder)).toBe('unknown');
    });

    it('uses default excluded list when config returns empty array', async () => {
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
            get: vi.fn(() => []),
        } as any);

        setExistingFiles(root, ['package.json']);
        expect(await detectProjectType(folder)).toBe('node');
    });
});
