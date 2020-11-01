import { SfdxCommand } from "@salesforce/command";
import { OutputFlags } from "@oclif/parser";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender"

/**
 * A base class that provides common funtionality for sfpowerscripts commands
 *
 * @extends SfdxCommand
 */
export default abstract class SfpowerscriptsCommand extends SfdxCommand {

    /**
     * List of recognised CLI inputs that are substituted with their
     * corresponding environment variable at runtime
     */
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
     * Command run code goes here
     */
    abstract execute(): Promise<any>;

    /**
     * Entry point of all commands
     */
    async run(): Promise<any> {
        this.loadSfpowerscriptsVariables(this.flags);

       //Initialise StatsD
        this.initializeStatsD();

        // Execute command run code
        await this.execute();
    }

    /**
     * Substitutes CLI inputs, that match the variable dictionary, with
     * the corresponding environment variable
     *
     * @param flags
     */
    private loadSfpowerscriptsVariables(flags: OutputFlags<any>): void {
        require("dotenv").config();


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

    private initializeStatsD()
    {
        if(process.env.SFPOWERSCRIPTS_STATSD)
        {
            SFPStatsSender.initialize(process.env.SFPOWERSCRIPTS_STATSD_PORT,process.env.SFFPOWERSCRIPTS_STATSD_HOST,process.env.SFFPOWERSCRIPTS_STATSD_PROTOCOL);
        }
    }
}
