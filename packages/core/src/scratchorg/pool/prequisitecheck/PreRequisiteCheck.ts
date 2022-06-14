import { Org } from '@salesforce/core';
const retry = require('async-retry');
import { Result, ok, err } from 'neverthrow';
import { PoolConfig } from '../PoolConfig';
import { PoolError, PoolErrorCodes } from '../PoolError';

export default class PreRequisiteCheck {
    private static isPrerequisiteChecked: boolean = false;
    private static isPrerequisiteMet = false;
    private static describeResult;

    private hubOrg: Org;

    constructor(hubOrg: Org) {
        this.hubOrg = hubOrg;
    }

    public async checkForPrerequisites(): Promise<void> {
        let sfdxAuthUrlFieldExists = false;
        let conn = this.hubOrg.getConnection();
        let expectedValues = ['In Progress', 'Available', 'Allocate', 'Assigned','Return'];
        let availableValues: string[] = [];
        if (!PreRequisiteCheck.isPrerequisiteChecked) {
            await retry(
                async (bail) => {
                    PreRequisiteCheck.describeResult = await conn.sobject('ScratchOrgInfo').describe();
                    if (PreRequisiteCheck.describeResult) {
                        for (const field of PreRequisiteCheck.describeResult.fields) {
                            if (field.name === 'SfdxAuthUrl__c') {
                                sfdxAuthUrlFieldExists = true;
                            }

                            if (field.name === 'Allocation_status__c' && field.picklistValues.length >= 4) {
                                for (let picklistValue of field.picklistValues) {
                                    if (picklistValue.active) {
                                        availableValues.push(picklistValue.value);
                                    }
                                }
                            }
                        }
                    }
                },
                { retries: 3, minTimeout: 30000 }
            );

            PreRequisiteCheck.isPrerequisiteChecked = true;
            //If there are values returned, its not compatible
            let statusValuesAvailable =
                expectedValues.filter((item) => {
                    return !availableValues.includes(item);
                }).length <= 1
                    ? true
                    : false;

            if (sfdxAuthUrlFieldExists && statusValuesAvailable) PreRequisiteCheck.isPrerequisiteMet = true;
        }

        if (!PreRequisiteCheck.isPrerequisiteMet) {
              throw new Error( `Required Prerequisite values in ScratchOrgInfo is missing in the DevHub` +
                               `For more information Please refer https://sfpowerscripts.dxatscale.io/getting-started/prerequisites \n`);
        }
    }
}
