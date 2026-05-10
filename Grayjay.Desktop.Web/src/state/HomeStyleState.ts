import { createSignal } from 'solid-js';

const KEY = 'grayjay_home_style';

type HomeStyle = 'netflix' | 'classic';

function read(): HomeStyle {
    const v = localStorage.getItem(KEY);
    return v === 'classic' ? 'classic' : 'netflix';
}

export const [homeStyle$, setHomeStyleRaw] = createSignal<HomeStyle>(read());

export function setHomeStyle(style: HomeStyle) {
    localStorage.setItem(KEY, style);
    setHomeStyleRaw(style);
}
