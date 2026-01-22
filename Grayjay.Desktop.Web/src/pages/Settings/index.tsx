import { For, type Component, createResource, createSignal, createEffect, JSX, onCleanup, Show, createMemo } from 'solid-js';
import styles from './index.module.css';
import { SourcesBackend } from '../../backend/SourcesBackend';
import { Backend } from '../../backend/Backend';
import StateGlobal from '../../state/StateGlobal';
import iconThumb from '../../assets/icons/icon_thumb.svg'
import SourceDetails from '../subpages/SourceDetails';
import SettingsContainer from '../../components/containers/SettingsContainer';
import { SettingsBackend } from '../../backend/SettingsBackend';
import Button from '../../components/buttons/Button';
import { ImportBackend } from '../../backend/ImportBackend';
import UIOverlay from '../../state/UIOverlay';
import { Event0 } from '../../utility/Event';
import { ISettingsField } from '../../backend/models/settings/SettingsObject';
import ScrollContainer from '../../components/containers/ScrollContainer';
import { SyncBackend } from '../../backend/SyncBackend';
import { focusable } from '../../focusable'; void focusable;
import { createResourceDefault } from '../../utility';
import { ISettingsFieldGroup } from '../../backend/models/settings/fields/SettingsFieldGroup';
import Toggle from '../../components/basics/inputs/Toggle';


export interface SettingsPageProps {
  settingsMenuStyle?: JSX.CSSProperties,
  settingsContainerStyle?: JSX.CSSProperties,
  onClosingEvent?: Event0
};

const SettingsPage: Component<SettingsPageProps> = (props) => {

  const [filterGroup$, setFilterGroup] = createSignal<string | undefined>();
  const [settings$] = createResourceDefault(async () => [], async () => await SettingsBackend.settings());

  let lastBoundEvent: Event0 | undefined = undefined;
  createEffect(()=>{
    if(lastBoundEvent != props.onClosingEvent) {
      lastBoundEvent = props.onClosingEvent;
      lastBoundEvent?.registerOne(this, ()=>{
        onClosing();
      });
    }
  })

  let didChange = false;
  function onFieldChanged(setting: ISettingsField, val: any) {
    console.log("Setting [" + setting.title + "] changed", val);
    didChange = true;
  }
  function onClosing(){
    console.log("Settings closing");
    if(didChange){
      console.log("Settings changed before close, saving");
      SettingsBackend.settingsSave(settings$()?.object)
    }
  }

  const globalBack = () => {
    console.info("globalBack");
    onClosing();
    UIOverlay.dismiss();
    return true;
  };

    let [showAdvanced$, setAdvanced] = createSignal(false);
    let hasAdvanced$ = createMemo(()=>{
        const fields = settings$()?.fields;
        if(fields)
            return !!findAdvancedField(fields);
        return false;
    });

    function findAdvancedField(fields: ISettingsField[]): ISettingsField | undefined {
        if(!fields)
            return undefined;
        for(let field of fields) {
            if(field.type == "group") {
                if(field.advanced) 
                    return field;
                const group = field as ISettingsFieldGroup;
                if(group.fields) {
                    let foundField = findAdvancedField(group.fields);
                    if(foundField)
                        return foundField;
                }
            }
            if(field.advanced)
                return field;
        }
    }
    
  return (
    <div class={styles.container} style="height: calc(100% - 20px); overflow-y: hidden;">
      <div class={styles.settingsMenu} style={props.settingsMenuStyle}>
          <h1 style="flex-shrink: 0">Settings</h1>
            <ScrollContainer wrapperStyle={{"padding-right": "4px"}}>
              <div classList={{[styles.settingsMenuItem]: true, [styles.active]: !filterGroup$()}} onClick={()=>setFilterGroup(undefined)} use:focusable={{
                onPress: () => setFilterGroup(undefined),
                onBack: globalBack,
                groupRememberLast: true,
                groupType: 'vertical',
                groupId: 'settings-filters',
                groupIndices: [0]
              }}>
                All
              </div>
              <For each={settings$()?.fields?.filter(x=>x.type == 'group') ?? []}>{(item, i) => 
                <div classList={{[styles.settingsMenuItem]: true, [styles.active]: item.property == filterGroup$()}} onClick={()=>setFilterGroup(item.property)} use:focusable={{
                  onPress: () => setFilterGroup(item.property),
                  onBack: globalBack,
                  groupRememberLast: true,
                  groupType: 'vertical',
                  groupId: 'settings-filters',
                  groupIndices: [1 + i()]
                }}>
                  {item.title}
                </div>
              }</For>
            </ScrollContainer>
            <div class={styles.bottomMenu}>
              <Show when={hasAdvanced$()}>
                  <div use:focusable={{
                    onPress: () => { setAdvanced(!showAdvanced$()) },
                    onBack: globalBack
                  }} class={styles.advanced}>
                    <div style="font-size: 16px; color: #999;">
                      Advanced
                    </div>
                    <div style="flex-grow: 1"></div>
                    <div style="flex-shrink: 0; scale: 0.6">
                      <Toggle value={showAdvanced$()} onToggle={(val)=>setAdvanced(val)} />
                    </div>
                  </div>
              </Show>
              <div style="margin-top: 10px;">
                <Button onClick={()=>{UIOverlay.dismiss(); UIOverlay.overlayImportSelect()}} style={{width: '100%'}} text='Import' icon='' focusableOpts={{
                  onPress: () => { UIOverlay.dismiss(); UIOverlay.overlayImportSelect() },
                  onBack: globalBack
                }}></Button>
              </div>
              <Show when={false}>
                <div style="margin-top: 10px; margin-right: 20px;">
                  <Button onClick={()=>Backend.GET('/Dialog/Test')} style={{width: '100%'}} text='Test' icon=''></Button>
                </div>
              </Show>
            </div>
      </div>
      <div class={styles.settingsContainer} style={props.settingsContainerStyle}>
        <ScrollContainer>
          <SettingsContainer settings={settings$()} showAdvanced={showAdvanced$()} filterGroup={filterGroup$()} onFieldChanged={onFieldChanged} onBack={globalBack} />
        </ScrollContainer>
      </div>
    </div>
  );
};

export default SettingsPage;
