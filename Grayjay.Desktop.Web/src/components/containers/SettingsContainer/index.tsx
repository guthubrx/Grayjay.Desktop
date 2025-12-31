import { Component, For, createMemo, Show, createEffect, JSX, createSignal } from "solid-js";
import styles from './index.module.css';

import { Event1 } from "../../../utility/Event";
import { ISettingsField, ISettingsObject } from "../../../backend/models/settings/SettingsObject";
import { focusable } from '../../../focusable'; void focusable;
import Field from "./fields/Field";
import { Direction } from "../../../nav";
import { ISettingsFieldGroup } from "../../../backend/models/settings/fields/SettingsFieldGroup";
import FieldToggle from "./fields/FieldToggle";
import Toggle from "../../basics/inputs/Toggle";

export interface SettingsContainerProps {
    settings: ISettingsObject | undefined,
    filterGroup?: string,
    filterName?: string,
    showAdvanced?: boolean,
    onFieldChanged?: (arg0: ISettingsField, arg1: any) => void;
    style?: JSX.CSSProperties;
    onBack?: () => boolean;
    focusableGroupOpts?: {
        groupId?: string;
        groupType?: "grid" | "horizontal" | "vertical";
        groupEscapeTo?: Partial<Record<Direction, string[]>>;
    }
};

export class SettingsContainerParent {
    settings: ISettingsObject;

    onFieldChange = new Event1<IFieldChangedEvent>()

    constructor(settingsObject: ISettingsObject) {
        this.settings = settingsObject;
        this.settings.onFieldChanged = (field, newVal) =>{
            this.onFieldChange.invoke({ field: field, newValue: newVal });
        }
    }
}
export interface IFieldChangedEvent {
    field: ISettingsField,
    newValue: any
}

const SettingsContainer: Component<SettingsContainerProps> = (props) => {
    let object = createMemo(()=>(props.settings) ? new SettingsContainerParent(props.settings) : undefined);
    let existing: ISettingsObject | undefined = undefined;
    let didChange = false;


    createEffect(()=>{
        if(existing != props.settings) {
            if(didChange) {
                didChange = false;
                //save(existing!);
            }
        }
        existing = props.settings;
    });

    function onFieldChanged(field: ISettingsField, newVal: any) {
        console.log("Field [" + field.property + "] changed", newVal);
        console.log("Settings [" + props.settings?.id + "] changed", props.settings?.object);
        didChange = true;
        if(props.settings?.onFieldChanged)
            props.settings.onFieldChanged(field, newVal);
        if(props.onFieldChanged)
            props.onFieldChanged(field, newVal);
    }

    function save(settings: ISettingsObject) {
        if(settings?.onSave)
            settings.onSave();
    }

    return (
        <div class={styles.container} style={props.style}>
            <Show when={props.settings}>
                <div style="margin: 24px">
                    <For each={props.settings!!.fields}>{ (field, index) =>
                        <Show when={(!props.filterGroup || (field.type == 'group' && field.property == props.filterGroup)) && (!props.filterName || field.title.indexOf(props.filterName!) >= 0)}>
                            <Field container={object()} field={field} parentObject={props.settings?.object} onFieldChanged={onFieldChanged} showAdvanced={props.showAdvanced} onBack={() => {
                                console.info("onBack");
                                return props.onBack?.() ?? false;
                            }} focusableGroupOpts={props.focusableGroupOpts} />
                        </Show>
                    }</For>
                </div>
            </Show>
        </div>
    );
};

export default SettingsContainer;
