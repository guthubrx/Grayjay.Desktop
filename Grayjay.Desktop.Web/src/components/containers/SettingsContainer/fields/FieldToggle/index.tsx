import { Component, Show, createSignal } from 'solid-js'

import styles from './index.module.css';
import { ISettingsField } from '../../../../../backend/models/settings/SettingsObject';
import { ISettingsFieldToggle } from '../../../../../backend/models/settings/fields/SettingsFieldToggle';
import Toggle from '../../../../basics/inputs/Toggle';
import FieldKey from '../FieldKey';
import { focusable } from '../../../../../focusable';import { Direction } from '../../../../../nav';
 void focusable;

interface FieldToggleProps {
    field: ISettingsFieldToggle,
    onFieldChanged?: (field: ISettingsField, newVal: boolean, onCancel: ()=>void)=>void,
    value: boolean,
    isSubField?: boolean
    onBack?: () => boolean
    focusableGroupOpts?: {
        groupId?: string;
        groupType?: "grid" | "horizontal" | "vertical";
        groupIndices?: (number | undefined)[];
        groupEscapeTo?: Partial<Record<Direction, string[]>>;
    };
}

const FieldToggle: Component<FieldToggleProps> = (props) => {

    const [value$, setValue] = createSignal(props.value);

    function toggle(newVal: boolean) {
        setValue(newVal);
        if(props.onFieldChanged){
            props.onFieldChanged(props.field, newVal, ()=>{
                setValue(!newVal);
            })
        }
    }

    return (
        <div class={styles.container} use:focusable={{
            ... (props.focusableGroupOpts ?? {}),
            onPress: () => toggle(!value$()),
            onBack: () => props.onBack?.() ?? false
        }}>
            <FieldKey field={props.field} isSubField={props.isSubField} />
            <div class={styles.value}>
                <Toggle value={value$()} onToggle={(newVal)=>toggle(newVal)} />
            </div>
        </div>
    );
};

export default FieldToggle;