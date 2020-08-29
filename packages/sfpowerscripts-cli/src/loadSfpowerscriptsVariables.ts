import { sfpowerscripts_variable_dictionary } from "./VariableDictionary";

/**
 * @description substitutes CLI inputs, that match the variable dictionary, with
 * the corresponding environment variable
 * @param flags
 */
export default function loadSfpowerscriptsVariables(flags): void {
    for (let flag in flags ) {
        for ( let sfpowerscripts_variable of sfpowerscripts_variable_dictionary ) {
            if (
                typeof flags[flag] === "string" &&
                flags[flag].includes(sfpowerscripts_variable)
            ) {
                console.log(`Substituting ${flags[flag]} with ${process.env[sfpowerscripts_variable]}`);
                flags[flag] = process.env[sfpowerscripts_variable];
                break;
            }
        }
    }
}
