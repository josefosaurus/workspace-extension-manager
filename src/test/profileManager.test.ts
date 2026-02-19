import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';

const executeCommandMock = vi.fn();
const showWarningMessageMock = vi.fn();
const showInformationMessageMock = vi.fn();
const showErrorMessageMock = vi.fn();
const getConfigurationMock = vi.fn();
const getCommandsMock = vi.fn();

const vscodePath = path.join(os.homedir(), '.vscode', 'extensions');

function makeExtension(id: string, opts: {
    extensionPath?: string;
    categories?: string[];
    contributes?: Record<string, any>;
} = {}) {
    return {
        id,
        extensionPath: opts.extensionPath ?? path.join(vscodePath, id),
        packageJSON: {
            categories: opts.categories ?? [],
            contributes: opts.contributes ?? {},
        },
    };
}

let extensionsAll: any[] = [];

vi.mock('vscode', () => ({
    commands: {
        executeCommand: (...args: any[]) => executeCommandMock(...args),
        getCommands: (...args: any[]) => getCommandsMock(...args),
    },
    extensions: {
        get all() { return extensionsAll; },
    },
    window: {
        showWarningMessage: (...args: any[]) => showWarningMessageMock(...args),
        showInformationMessage: (...args: any[]) => showInformationMessageMock(...args),
        showErrorMessage: (...args: any[]) => showErrorMessageMock(...args),
    },
    workspace: {
        getConfiguration: (...args: any[]) => getConfigurationMock(...args),
    },
    ConfigurationTarget: { Workspace: 2 },
}));

vi.mock('https', () => ({
    request: vi.fn((_opts, cb) => {
        // Simulate a successful empty response
        const res = {
            on: vi.fn((event: string, handler: Function) => {
                if (event === 'data') { handler(JSON.stringify({ results: [{ extensions: [] }] })); }
                if (event === 'end') { handler(); }
            }),
        };
        setTimeout(() => cb(res), 0);
        return { on: vi.fn(), write: vi.fn(), end: vi.fn(), setTimeout: vi.fn() };
    }),
}));

import { ProfileManager } from '../profileManager';

beforeEach(() => {
    vi.clearAllMocks();
    extensionsAll = [];
    getConfigurationMock.mockReturnValue({
        get: vi.fn((_key: string, def: any) => def),
    });
});

describe('disableNonProfileExtensions (via applyProfile)', () => {
    it('tries executeCommand directly instead of pre-checking getCommands', async () => {
        // Set up a non-profile extension that should be disabled
        extensionsAll = [
            makeExtension('some.other-ext'),
        ];

        // The disable command succeeds on direct execution
        executeCommandMock.mockResolvedValue(undefined);

        const pm = new ProfileManager();
        await pm.applyProfile({
            name: 'Test',
            extensions: ['profile.ext1'],
            settings: {},
        });

        // Should NOT call getCommands at all (the old pre-check approach)
        expect(getCommandsMock).not.toHaveBeenCalled();

        // Should try to execute the disable command directly
        expect(executeCommandMock).toHaveBeenCalledWith(
            'workbench.extensions.disableExtension',
            'some.other-ext'
        );
    });

    it('falls back to second candidate when first command throws', async () => {
        extensionsAll = [
            makeExtension('some.other-ext'),
        ];

        // First candidate throws, second succeeds
        executeCommandMock
            .mockImplementation((cmd: string, ...args: any[]) => {
                if (cmd === 'workbench.extensions.disableExtension') {
                    return Promise.reject(new Error('command not found'));
                }
                return Promise.resolve(undefined);
            });

        const pm = new ProfileManager();
        await pm.applyProfile({
            name: 'Test',
            extensions: ['profile.ext1'],
            settings: {},
        });

        // Should have tried the second candidate
        expect(executeCommandMock).toHaveBeenCalledWith(
            'workbench.extensions.action.disableExtension',
            'some.other-ext'
        );
    });

    it('shows warning when all candidate commands fail', async () => {
        extensionsAll = [
            makeExtension('some.other-ext'),
        ];

        // All disable candidates fail; other commands succeed
        executeCommandMock.mockImplementation((cmd: string) => {
            if (cmd.includes('disable') || cmd.includes('Disable')) {
                return Promise.reject(new Error('not found'));
            }
            return Promise.resolve(undefined);
        });

        const pm = new ProfileManager();
        await pm.applyProfile({
            name: 'Test',
            extensions: ['profile.ext1'],
            settings: {},
        });

        expect(showWarningMessageMock).toHaveBeenCalledWith(
            expect.stringContaining('no supported disable command was found')
        );
    });

    it('skips theme extensions', async () => {
        extensionsAll = [
            makeExtension('theme.ext', { contributes: { themes: [{}] } }),
            makeExtension('nontheme.ext'),
        ];

        executeCommandMock.mockResolvedValue(undefined);

        const pm = new ProfileManager();
        await pm.applyProfile({
            name: 'Test',
            extensions: ['profile.ext1'],
            settings: {},
        });

        // Should only try to disable nontheme.ext, not theme.ext
        const disableCalls = executeCommandMock.mock.calls.filter(
            (c: any[]) => c[0].includes('disable') || c[0].includes('Disable')
        );
        expect(disableCalls).toHaveLength(1);
        expect(disableCalls[0][1]).toBe('nontheme.ext');
    });

    it('skips built-in extensions (not in ~/.vscode/extensions)', async () => {
        extensionsAll = [
            makeExtension('builtin.ext', { extensionPath: '/usr/share/code/extensions/builtin.ext' }),
            makeExtension('user.ext'),
        ];

        executeCommandMock.mockResolvedValue(undefined);

        const pm = new ProfileManager();
        await pm.applyProfile({
            name: 'Test',
            extensions: ['profile.ext1'],
            settings: {},
        });

        const disableCalls = executeCommandMock.mock.calls.filter(
            (c: any[]) => c[0].includes('disable') || c[0].includes('Disable')
        );
        expect(disableCalls).toHaveLength(1);
        expect(disableCalls[0][1]).toBe('user.ext');
    });

    it('does not disable extensions that are in the profile', async () => {
        extensionsAll = [
            makeExtension('profile.ext1'),
            makeExtension('other.ext'),
        ];

        executeCommandMock.mockResolvedValue(undefined);

        const pm = new ProfileManager();
        await pm.applyProfile({
            name: 'Test',
            extensions: ['profile.ext1'],
            settings: {},
        });

        const disableCalls = executeCommandMock.mock.calls.filter(
            (c: any[]) => c[0].includes('disable') || c[0].includes('Disable')
        );
        expect(disableCalls).toHaveLength(1);
        expect(disableCalls[0][1]).toBe('other.ext');
    });
});
