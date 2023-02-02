const Table = require('cli-table');
import SFPLogger, { Logger, LoggerLevel, COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger';
import { ZERO_BORDER_TABLE } from './TableConstants';

export default class InstalledArtifactsDisplayer {
    public static printInstalledArtifacts(artifacts: any, logger: Logger) {
        if (!artifacts) return;
        else if(artifacts.length==0) return;
     
        let table = new Table({
            head: ['Artifact', 'Version', 'Commit Id'],
            chars: ZERO_BORDER_TABLE
        });

        artifacts.forEach((artifact) => {
            table.push([artifact.Name, artifact.Version__c, artifact.CommitId__c?artifact.CommitId__c:""]);
        });

        SFPLogger.log(COLOR_KEY_MESSAGE('Artifacts installed in org:'), LoggerLevel.INFO, logger);
        SFPLogger.log(table.toString(), LoggerLevel.INFO, logger);
    }
}
