import { SfdxCommand } from "@salesforce/command";

export default abstract class SfpowerscriptsCommand extends SfdxCommand {

    private readonly sfpowerscripts_variable_dictionary: string[] = [
        'sfpowerscripts_incremented_project_version',
        'sfpowerscripts_artifact_directory',
        'sfpowerscripts_artifact_metadata_directory',
        'sfpowerscripts_delta_package_path',
        'sfpowerscripts_package_version_id',
        'sfpowerscripts_package_version_number',
        'sfpowerscripts_pmd_output_path',
        'sfpowerscripts_exportedsource_zip_path',
        'sfpowerkit_deploysource_id'
    ];

    /**
     * @description substitutes CLI inputs, that match the variable dictionary, with
     * the corresponding environment variable
     * @param flags
     */
    protected loadSfpowerscriptsVariables(flags): void {
        for (let flag in flags ) {
            for ( let sfpowerscripts_variable of this.sfpowerscripts_variable_dictionary ) {
                if (
                    typeof flags[flag] === "string" &&
                    flags[flag].includes(sfpowerscripts_variable)
                ) {
                    console.log(`Substituting ${flags[flag]} with ${process.env[flags[flag]]}`);
                    flags[flag] = process.env[flags[flag]];
                    break;
                }
            }
        }
    }
}
