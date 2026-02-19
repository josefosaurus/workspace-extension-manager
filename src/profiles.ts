import * as fs from 'fs';
import * as path from 'path';
import { ProjectType } from './detector';

export interface ProfileConfig {
    name: string;
    extensions: string[];
    settings?: Record<string, any>;
}

export function getProfileConfig(projectType: ProjectType): ProfileConfig | null {
    if (projectType === 'unknown') {
        return null;
    }

    const profilePath = path.join(__dirname, '..', 'profiles', `${projectType}.json`);

    if (!fs.existsSync(profilePath)) {
        return null;
    }

    try {
        const content = fs.readFileSync(profilePath, 'utf-8');
        return JSON.parse(content) as ProfileConfig;
    } catch (error) {
        console.error(`Error reading profile config for ${projectType}:`, error);
        return null;
    }
}

export function generateCodeProfileContent(config: ProfileConfig): string {
    // Generate a .code-profile JSON structure
    const profile = {
        name: config.name,
        extensions: config.extensions.map(ext => ({
            identifier: { id: ext }
        })),
        settings: config.settings || {}
    };

    return JSON.stringify(profile, null, 2);
}

export function getAvailableProfiles(): ProjectType[] {
    const profilesDir = path.join(__dirname, '..', 'profiles');

    if (!fs.existsSync(profilesDir)) {
        return [];
    }

    const files = fs.readdirSync(profilesDir);
    return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', '') as ProjectType);
}
