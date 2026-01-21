import { Component } from 'solid-js'

import styles from './index.module.css';
import { ISettingsField } from '../../../../../backend/models/settings/SettingsObject';
import { ISettingsFieldDropDown } from '../../../../../backend/models/settings/fields/SettingsFieldDropDown';
import FieldKey from '../FieldKey';
import Dropdown, { DropdownApi } from '../../../../basics/inputs/Dropdown';
import { AnchorStyle } from '../../../../../utility/Anchor';
import { Direction } from '../../../../../nav';
import { focusable } from '../../../../../focusable'; void focusable;

interface FieldDropDownProps {
    field: ISettingsFieldDropDown
    onFieldChanged?: (field: ISettingsField, newVal: number) => void,
    value: number,
    isSubField?: boolean,
    onBack?: () => boolean,
    focusableGroupOpts?: {
        groupId?: string;
        groupType?: "grid" | "horizontal" | "vertical";
        groupIndices?: (number | undefined)[];
        groupEscapeTo?: Partial<Record<Direction, string[]>>;
    }
}

const FieldDropDown: Component<FieldDropDownProps> = (props) => {
    let dropdownApi: DropdownApi | undefined;

    function selectedChanged(newVal: number) {
        props.onFieldChanged?.(props.field, newVal);
    }

    return (
        <div
            class={styles.container}
            use:focusable={{
                ...(props.focusableGroupOpts ?? {}),
                onPress: () => dropdownApi?.toggle("gamepad"),
                onBack: () => {
                    if (dropdownApi?.isOpen()) {
                        dropdownApi.close("gamepad");
                        return true;
                    }
                    return props.onBack?.() ?? false;
                }
            }}
        >
            <FieldKey field={props.field} isSubField={!!props.isSubField} />
            <div class={styles.value}>
                <Dropdown
                    options={props.field.options}
                    value={props.value}
                    onSelectedChanged={selectedChanged}
                    anchorStyle={AnchorStyle.BottomRight}
                    onBack={props.onBack}
                    focusable={false}
                    apiRef={(api) => (dropdownApi = api)}
                />
            </div>
        </div>
    );
};

export default FieldDropDown;
