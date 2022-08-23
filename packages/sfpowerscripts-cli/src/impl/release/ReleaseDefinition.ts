import ReleaseDefinitionSchema from './ReleaseDefinitionSchema';
import Ajv from 'ajv';
const yaml = require('js-yaml');
import lodash = require('lodash');
import get18DigitSalesforceId from '../../utils/Get18DigitSalesforceId';
import Git from '@dxatscale/sfpowerscripts.core/lib/git/Git';
import { ConsoleLogger } from '@dxatscale/sfp-logger';
const fs = require('fs-extra');
const path = require('path');

export default class ReleaseDefinition {
    get releaseDefinition() {
        // Return clone of releaseDefinition for immutability
        return lodash.cloneDeep(this._releaseDefinitionSchema);
    }
    private constructor(private _releaseDefinitionSchema: ReleaseDefinitionSchema) {
        this.validateReleaseDefinition(this._releaseDefinitionSchema);

        // Workaround for jsonschema not supporting validation based on dependency value
        if (this._releaseDefinitionSchema.baselineOrg && !this._releaseDefinitionSchema.skipIfAlreadyInstalled)
            throw new Error("Release option 'skipIfAlreadyInstalled' must be true for 'baselineOrg'");

        if (this._releaseDefinitionSchema.packageDependencies) {
            this.convertPackageDependenciesIdTo18Digits(this._releaseDefinitionSchema.packageDependencies);
        }
    }

    public static async loadReleaseDefinition(pathToReleaseDefinition: string) {
        //Check whether path contains gitRef
        let releaseDefinitionSchema: ReleaseDefinitionSchema;
        try {
            if (pathToReleaseDefinition.includes(':')) {
                let git = await Git.initiateRepo();
                await git.fetch();
                let releaseFile = await git.show([pathToReleaseDefinition]);
                releaseDefinitionSchema = yaml.load(releaseFile);
            } else {
                releaseDefinitionSchema = yaml.load(fs.readFileSync(pathToReleaseDefinition, 'UTF8'));
            }
        } catch (error) {
            throw new Error(`Unable to read the release definition file due to ${JSON.stringify(error)}`);
        }

        let releaseDefinition = new ReleaseDefinition(releaseDefinitionSchema);
        return releaseDefinition;
    }

    private convertPackageDependenciesIdTo18Digits(packageDependencies: { [p: string]: string }) {
        for (let pkg in packageDependencies) {
            packageDependencies[pkg] = get18DigitSalesforceId(packageDependencies[pkg]);
        }
    }

    private validateReleaseDefinition(releaseDefinition: ReleaseDefinitionSchema): void {
        let schema = fs.readJSONSync(
            path.join(__dirname, '..', '..', '..', 'resources', 'schemas', 'releasedefinition.schema.json'),
            { encoding: 'UTF-8' }
        );

        let validator = new Ajv({ allErrors: true }).compile(schema);
        let validationResult = validator(releaseDefinition);

        if (!validationResult) {
            let errorMsg: string =
                `Release definition does not meet schema requirements, ` +
                `found ${validator.errors.length} validation errors:\n`;

            validator.errors.forEach((error, errorNum) => {
                errorMsg += `\n${errorNum + 1}: ${error.instancePath}: ${error.message} ${JSON.stringify(
                    error.params,
                    null,
                    4
                )}`;
            });

            throw new Error(errorMsg);
        }
    }
}
