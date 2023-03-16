import { Connection } from 'jsforce';
import { RetrieveResult } from 'jsforce/lib/api/metadata';
import { delay } from './delay';
import SFPLogger, {LoggerLevel } from '@dxatscale/sfp-logger';
import { SfdxError } from '@salesforce/core';

export async function checkRetrievalStatus(conn: Connection, retrievedId: string, isToBeLoggedToConsole = true): Promise<RetrieveResult> {
    let metadata_result;

    while (true) {
        try {
            metadata_result = await conn.metadata.checkRetrieveStatus(retrievedId);
        } catch (error) {
            throw new SfdxError(error.message);
        }

        if (metadata_result.done === 'false') {
            if (isToBeLoggedToConsole) SFPLogger.log(`Polling for Retrieval Status`, LoggerLevel.INFO);
            await delay(5000);
        } else {
            //this.ux.logJson(metadata_result);
            break;
        }
    }
    return metadata_result;
}
