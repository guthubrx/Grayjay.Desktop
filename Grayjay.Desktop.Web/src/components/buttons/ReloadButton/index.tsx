import { Component, JSX, createSignal, onCleanup, onMount } from 'solid-js';
import IconButton from '../IconButton';
import SettingsMenu, { Menu, MenuItemButton } from '../../menus/Overlays/SettingsMenu';
import Anchor, { AnchorStyle } from '../../../utility/Anchor';
import { getKeybinding } from '../../../state/StateKeybindings';
import { FocusableOptions } from '../../../nav';
import iconRefresh from '../../../assets/icons/icon_reload_temp.svg';

export interface ReloadButtonProps {
  // Réseau : force une mise à jour depuis la source
  onReloadUpdate: () => void;
  // Cache : recharge la vue déjà en cache, sans réseau
  onReloadCache: () => void;
  updateDescription?: string;
  cacheDescription?: string;
  style?: JSX.CSSProperties;
  // Infos de navigation clavier (le onPress est fourni en interne pour ouvrir le menu)
  focusableOpts?: Omit<FocusableOptions, 'onPress'>;
}

// Bouton de rafraîchissement partagé : un clic ouvre un menu « Reload from Update / Reload from Cache ».
// Utilisé par les pages Subscriptions et Home pour éviter toute duplication de ce comportement.
const ReloadButton: Component<ReloadButtonProps> = (props) => {
  const [show$, setShow] = createSignal(false);
  const anchor = new Anchor(null, show$, AnchorStyle.BottomRight);

  const openMenu = (el: HTMLElement) => {
    anchor.setElement(el);
    setShow(true);
  };

  const menu = {
    title: '',
    items: [
      new MenuItemButton('Reload from Update', iconRefresh, props.updateDescription ?? 'Updates from the source', () => {
        props.onReloadUpdate();
        setShow(false);
      }),
      new MenuItemButton('Reload from Cache', iconRefresh, props.cacheDescription ?? 'Just reloads the cached view', () => {
        props.onReloadCache();
        setShow(false);
      }),
    ],
  } as Menu;

  const onReloadKeyDown = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === getKeybinding('reload')) {
      props.onReloadUpdate();
      e.preventDefault();
    }
  };
  onMount(() => window.addEventListener('keydown', onReloadKeyDown));
  onCleanup(() => window.removeEventListener('keydown', onReloadKeyDown));

  return (
    <>
      <IconButton
        icon={iconRefresh}
        variant="none"
        shape="circle"
        width="30px"
        height="30px"
        iconInset="0px"
        style={props.style}
        onClick={(e) => openMenu(e.currentTarget as HTMLElement)}
        focusableOpts={{
          ...(props.focusableOpts ?? {}),
          onPress: (el) => openMenu(el),
        }}
      />
      <SettingsMenu menu={menu} show={show$()} anchor={anchor} onHide={() => setShow(false)} />
    </>
  );
};

export default ReloadButton;
