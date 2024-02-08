import ReleaseDefinition from './ReleaseDefinition';
import Ajv from 'ajv';
const yaml = require('js-yaml');
import lodash = require('lodash');
import get18DigitSalesforceId from '../../utils/Get18DigitSalesforceId';
import Git from '../../core/git/Git';
import { ConsoleLogger } from '@flxblio/sfp-logger';
const fs = require('fs-extra');
const path = require('path');

export default class ReleaseDefinitionLoader {
    get releaseDefinition() {
        // Return clone of releaseDefinition for immutability
        return lodash.cloneDeep(this._releaseDefinition);
    }
    private constructor(private _releaseDefinition: ReleaseDefinition) {
        this.validateReleaseDefinition(this._releaseDefinition);

        // Workaround for jsonschema not supporting validation based on dependency value
        if (this._releaseDefinition.baselineOrg && !this._releaseDefinition.skipIfAlreadyInstalled)
            throw new Error("Release option 'skipIfAlreadyInstalled' must be true for 'baselineOrg'");

        if (this._releaseDefinition.packageDependencies) {
            this.convertPackageDependenciesIdTo18Digits(this._releaseDefinition.packageDependencies);
        }
    }

    public static async loadReleaseDefinition(pathToReleaseDefinition: string): Promise<ReleaseDefinition> {
        //Check whether path contains gitRef
        let releaseDefinition: ReleaseDefinition;
        try {
            if (pathToReleaseDefinition.includes(':')) {
                let git = await Git.initiateRepo();
                await git.fetch();
                let releaseFile = await git.show([pathToReleaseDefinition]);
                releaseDefinition = yaml.load(releaseFile);
            } else {
                releaseDefinition = yaml.load(fs.readFileSync(pathToReleaseDefinition, 'UTF8'));
            }
        } catch (error) {
            throw new Error(`Unable to read the release definition file due to ${JSON.stringify(error)}`);
        }

        let releaseDefinitionLoader = new ReleaseDefinitionLoader(releaseDefinition);
        return releaseDefinitionLoader.releaseDefinition;
    }

    private convertPackageDependenciesIdTo18Digits(packageDependencies: { [p: string]: string }) {
        for (let pkg in packageDependencies) {
            packageDependencies[pkg] = get18DigitSalesforceId(packageDependencies[pkg]);
        }
    }

    private validateReleaseDefinition(releaseDefinition: ReleaseDefinition): void {
        let schema = fs.readJSONSync(
            path.join(__dirname, '..', '..', '..', 'resources', 'schemas', 'release-defn.schema.json'),
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
