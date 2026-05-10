import { createSignal } from 'solid-js';
import { SettingsBackend } from '../backend/SettingsBackend';

export type HomeStyle = 'netflix' | 'classic';

const [homeStyle$, setHomeStyleSignal] = createSignal<HomeStyle>('netflix');

SettingsBackend.settings().then(s => {
    const val = (s?.object as any)?.home?.netflixStyleHome;
    if (val === false) setHomeStyleSignal('classic');
}).catch(() => {});

export { homeStyle$ };

export async function setHomeStyle(style: HomeStyle) {
    setHomeStyleSignal(style);
    try {
        const s = await SettingsBackend.settings();
        if (s?.object) {
            (s.object as any).home = {
                ...(s.object as any).home,
                netflixStyleHome: style === 'netflix'
            };
            await SettingsBackend.settingsSave(s.object);
        }
    } catch (e) {
        console.error('Failed to save home style setting', e);
    }
}
