import { createSignal } from 'solid-js';
import { SettingsBackend } from '../backend/SettingsBackend';

export type HomeStyle = 'netflix' | 'classic';

const [homeStyle$, setHomeStyleSignal] = createSignal<HomeStyle>('netflix');

SettingsBackend.settings().then(s => applyHomeStyleFromSettings(s?.object)).catch(() => {});

export { homeStyle$ };

export function applyHomeStyleFromSettings(obj: any) {
    const val = obj?.home?.netflixStyleHome;
    setHomeStyleSignal(val === false ? 'classic' : 'netflix');
}

