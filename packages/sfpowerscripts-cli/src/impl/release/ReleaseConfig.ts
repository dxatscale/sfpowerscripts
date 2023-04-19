import * as fs from 'fs-extra';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import Ajv, { _ } from 'ajv';
import ReleaseDefinitionGeneratorConfigSchema from './ReleaseDefinitionGeneratorConfigSchema';
import lodash = require('lodash');
import yaml from 'js-yaml';
import { Logger } from '@dxatscale/sfp-logger';
const path = require('path');

export default class ReleaseConfig {
    private _releaseDefinitionGeneratorSchema: ReleaseDefinitionGeneratorConfigSchema;

    get releaseDefinitionGeneratorConfigSchema() {
        // Return clone of releaseDefinition for immutability
        return lodash.cloneDeep(this._releaseDefinitionGeneratorSchema);
    }

    public constructor(private logger: Logger, pathToReleaseDefinition: string) {
        this._releaseDefinitionGeneratorSchema = yaml.load(fs.readFileSync(pathToReleaseDefinition, 'utf8'));
        this.validateReleaseDefinitionGeneratorConfig(this._releaseDefinitionGeneratorSchema);

        // Easy to handle here than with schema
        if (
            this._releaseDefinitionGeneratorSchema.includeOnlyArtifacts &&
            this.releaseDefinitionGeneratorConfigSchema.excludeArtifacts
        ) {
            throw new Error('Error: Invalid schema: either use includeArtifacts or excludeArtifacts');
        }
        // Easy to handle here than with schema
        if (
            this._releaseDefinitionGeneratorSchema.includeOnlyPackageDependencies &&
            this.releaseDefinitionGeneratorConfigSchema.excludePackageDependencies
        ) {
            throw new Error(
                'Error: Invalid schema: either use includePackageDependencies or excludePackageDependencies'
            );
        }

        // Workaround for jsonschema not supporting validation based on dependency value
        if (
            this._releaseDefinitionGeneratorSchema.releasedefinitionProperties?.baselineOrg &&
            !this._releaseDefinitionGeneratorSchema.releasedefinitionProperties?.skipIfAlreadyInstalled
        )
            throw new Error("Release option 'skipIfAlreadyInstalled' must be true for 'baselineOrg'");
    }

    public getPackagesAsPerReleaseConfig(directory?: string): string[] {
        let packages: string[] = [];
        let projectConfig = ProjectConfig.getSFDXProjectConfig(directory);
        //Read sfdx project json
        let sfdxPackages = ProjectConfig.getAllPackagesFromProjectConfig(projectConfig);
        for (const sfdxPackage of sfdxPackages) {
            if (this.getArtifactPredicate(sfdxPackage)) {
                packages.push(sfdxPackage);
            }
        }

        return packages;
    }

    private validateReleaseDefinitionGeneratorConfig(
        releaseDefinitionGeneratorSchema: ReleaseDefinitionGeneratorConfigSchema
    ): void {
        let schema = fs.readJSONSync(
            path.join(__dirname, '..', '..', '..', 'resources', 'schemas', 'releasedefinitiongenerator.schema.json'),
            { encoding: 'UTF-8' }
        );

        let validator = new Ajv({ allErrors: true }).compile(schema);
        let validationResult = validator(releaseDefinitionGeneratorSchema);

        if (!validationResult) {
            let errorMsg: string =
                `Release definition generation config does not meet schema requirements, ` +
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

    private getArtifactPredicate(artifact: string): boolean {
        if (this.releaseDefinitionGeneratorConfigSchema.includeOnlyArtifacts) {
            return this.releaseDefinitionGeneratorConfigSchema.includeOnlyArtifacts?.includes(artifact);
        } else if (this.releaseDefinitionGeneratorConfigSchema.excludeArtifacts) {
            return !this.releaseDefinitionGeneratorConfigSchema.excludeArtifacts?.includes(artifact);
        } else return true;
    }
}
