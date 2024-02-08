import * as fs from 'fs-extra';
import ProjectConfig from '../../core/project/ProjectConfig';
import Ajv, { _ } from 'ajv';
import ReleaseConfig from './ReleaseConfig';
import lodash = require('lodash');
const yaml = require('js-yaml');
import { Logger } from '@flxblio/sfp-logger';
const path = require('path');

export default class ReleaseConfigLoader {
    private _releaseConfig: ReleaseConfig;

    get releaseConfig() {
        // Return clone of releaseDefinition for immutability
        return lodash.cloneDeep(this._releaseConfig);
    }

    public constructor(private logger: Logger, pathToReleaseDefinition: string, private isExplicitDependencyCheckEnabled:boolean=false) {
        this._releaseConfig = yaml.load(fs.readFileSync(pathToReleaseDefinition, 'utf8'));
        this.validateReleaseDefinitionGeneratorConfig(this._releaseConfig);

        // Easy to handle here than with schema
        if (
            this._releaseConfig.includeOnlyArtifacts &&
            this.releaseConfig.excludeArtifacts
        ) {
            throw new Error('Error: Invalid schema: either use includeArtifacts or excludeArtifacts');
        }
        // Easy to handle here than with schema
        if (
            this._releaseConfig.includeOnlyPackageDependencies &&
            this.releaseConfig.excludePackageDependencies
        ) {
            throw new Error(
                'Error: Invalid schema: either use includePackageDependencies or excludePackageDependencies'
            );
        }

        // Workaround for jsonschema not supporting validation based on dependency value
        if (
            this._releaseConfig.releasedefinitionProperties?.baselineOrg &&
            !this._releaseConfig.releasedefinitionProperties?.skipIfAlreadyInstalled
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

        if(packages.length>0)
        {
            for (const sfdxPackage of sfdxPackages) {
                if (this.getPackageDependencyPredicate(sfdxPackage)) {
                    packages.push(sfdxPackage);
                }
            }
        }


        return packages;
    }

    private validateReleaseDefinitionGeneratorConfig(
        releaseDefinitionGeneratorSchema: ReleaseConfig
    ): void {
        let schema = fs.readJSONSync(
            path.join(__dirname, '..', '..', '..', 'resources', 'schemas', 'release-config.schema.json'),
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
        if (this.releaseConfig.includeOnlyArtifacts) {
            return this.releaseConfig.includeOnlyArtifacts?.includes(artifact);
        } else if (this.releaseConfig.excludeArtifacts) {
            return !this.releaseConfig.excludeArtifacts?.includes(artifact);
        } else if(this.isExplicitDependencyCheckEnabled && this.releaseConfig.dependencyOn) {
            return this.releaseConfig.dependencyOn?.includes(artifact);
        }
        else return true;
    }

    private getPackageDependencyPredicate(artifact: string): boolean {
        if(this.isExplicitDependencyCheckEnabled && this.releaseConfig.dependencyOn) {
            return this.releaseConfig.dependencyOn?.includes(artifact);
        }
    }
}
