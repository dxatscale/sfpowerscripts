import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import Ajv from 'ajv';
import path = require('path');
import * as fs from 'fs-extra';
import { PackageType } from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';

export default class ProjectValidation {
    private readonly projectConfig;
    private ajv: Ajv;
    resourcesDir: string;

    constructor() {
        this.projectConfig = ProjectConfig.getSFDXProjectConfig(null);
        this.ajv = new Ajv({ allErrors: true });
        this.resourcesDir = path.join(__dirname, '..', 'resources', 'schemas');
    }

    public validateSFDXProjectJSON() {
        let schema = fs.readJSONSync(path.join(this.resourcesDir, `sfdx-project.schema.json`), { encoding: 'UTF-8' });
        let validator = this.ajv.compile(schema);
        let isSchemaValid = validator(this.projectConfig);
        if (!isSchemaValid) {
            let errorMsg: string = `The sfdx-project.json is invalid, Please fix the following errors\n`;

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

    public validatePackageNames() {
        ProjectConfig.getAllPackageDirectoriesFromConfig(this.projectConfig).forEach((pkg) => {
            let name = pkg.package;
            if ( name.length > 38) {
                throw new Error(
                    'sfdx-project.json validation failed for package "' +
                    pkg['package'] +
                        '".' +
                    `Package name exceed maximum length of 38 characters.`
                )
            }else if( name.match(/^[a-zA-Z0-9-._~]+$/) === null ){
                throw new Error(
                    'sfdx-project.json validation failed for package "' +
                    pkg['package'] +
                        '".' +
                    `Package names can only contain alphanumeric characters and the symbols - . _ ~.`
                )
            }
        });
    }


    public validatePackageBuildNumbers() {
        ProjectConfig.getAllPackageDirectoriesFromConfig(this.projectConfig).forEach((pkg) => {
            let packageType = ProjectConfig.getPackageType(this.projectConfig, pkg.package);

            let pattern: RegExp = /NEXT$|LATEST$/i;
            if (
                pkg.versionNumber.match(pattern) &&
                (packageType === PackageType.Source || packageType === PackageType.Data)
            ) {
                throw new Error(
                    'sfdx-project.json validation failed for package "' +
                        pkg['package'] +
                        '".' +
                        ' Build-number keywords "NEXT" & "LATEST" are not supported for ' +
                        packageType +
                        ' packages.' +
                        '\nTry the following:' +
                        '\n - If package should be built as a ' +
                        packageType +
                        ' package, use 0 instead of NEXT/LATEST' +
                        '\n - If package should be built as an Unlocked package, ensure the package has been created in the Devhub and the ID included in packageAliases of sfdx-project.json'
                );
            }
        });
    }
}
