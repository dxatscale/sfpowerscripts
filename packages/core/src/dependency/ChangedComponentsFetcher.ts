import Git from '../git/Git';
import IgnoreFiles from '../ignore/IgnoreFiles';
import ProjectConfig from '../project/ProjectConfig';
import MetadataFiles from '../metadata/MetadataFiles';
import Component from './Component';
import * as fs from 'fs-extra';
import path = require('path');
import SFPLogger, { LoggerLevel } from '../logger/SFPLogger';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';

export default class ChangedComponentsFetcher {
    constructor(private baseBranch: string, private isToUseDeploymentReports: boolean = true) {}

    async fetch(): Promise<Component[]> {
        let components: Component[] = [];

        let git: Git = new Git();

        let projectConfig = ProjectConfig.getSFDXProjectConfig(null);

        if (!this.baseBranch.includes('origin')) {
            // for user convenience, use full ref name to avoid errors involving missing local refs
            this.baseBranch = `remotes/origin/${this.baseBranch}`;
        }

        let diff: string[] = await git.diff([this.baseBranch, `HEAD`, `--no-renames`, `--name-only`]);

        // Filter diff to package directories
        diff = diff.filter((filepath) =>
            projectConfig.packageDirectories.find((pkg) =>
                // TODO: make comparison more robust
                filepath.includes(pkg.path)
            )
        );

        // Apply root forceignore to the diff
        let ignoreFiles: IgnoreFiles = new IgnoreFiles(fs.readFileSync('.forceignore', 'utf8'));
        diff = ignoreFiles.filter(diff);

        if (diff.length > 0) {
            if (this.isToUseDeploymentReports)
                components = this.filterChangedComponentsByComponentSuccess(projectConfig, diff);
            else components = this.getComponentsFromLocalDirectory(projectConfig, diff);
        }

        return components;
    }
    private getComponentsFromLocalDirectory(projectConfig: any, diff: string[]): Component[] {
        const components: Component[] = [];

        for (const filepath of diff) {
            let componentSet = ComponentSet.fromSource(filepath);

            let individualComponentFromComponentSet = componentSet.getSourceComponents().first();
            

            // find package that file belongs to
            const indexOfPackage = projectConfig.packageDirectories.findIndex((pkg) => filepath.includes(pkg.path));

            const packageName = projectConfig.packageDirectories[indexOfPackage].package;

            const component: Component = {
                id: undefined,
                fullName: individualComponentFromComponentSet.fullName,
                type: individualComponentFromComponentSet.type.name,
                files: [filepath],
                package: packageName,
                packageType: ProjectConfig.getPackageType(projectConfig, packageName),
                indexOfPackage: indexOfPackage,
            };

            components.push(component);
        }
        return components;
    }

    /**
     * Aggregates component successes from MDAPI deploy reports
     */
    private getComponentSuccessesFromReports(): any[] {
        let componentSuccesses: any[] = [];

        const reportsDir: string = '.sfpowerscripts/mdapiDeployReports';
        if (fs.existsSync(reportsDir)) {
            let reports = fs.readdirSync(reportsDir);
            reports.forEach((report) => {
                let data = JSON.parse(fs.readFileSync(path.join(reportsDir, report), 'utf8'));
                componentSuccesses = componentSuccesses.concat(data.result.details.componentSuccesses);
            });
        }
        return componentSuccesses;
    }

    private filterChangedComponentsByComponentSuccess(projectConfig: any, diff: string[]) {
        const components: Component[] = [];

        let componentSuccesses = this.getComponentSuccessesFromReports();

        for (const filepath of diff) {
            const fullApiName = MetadataFiles.getFullApiName(filepath);

            const componentSuccess = componentSuccesses.find(
                (component) => component.fullName === fullApiName && component.id
            );

            // find package that file belongs to
            const indexOfPackage = projectConfig.packageDirectories.findIndex((pkg) => filepath.includes(pkg.path));

            const packageName = projectConfig.packageDirectories[indexOfPackage].package;

            if (componentSuccess) {
                const component: Component = {
                    id: componentSuccess?.id,
                    fullName: componentSuccess.fullName,
                    type: componentSuccess.componentType,
                    files: [filepath],
                    package: packageName,
                    packageType: ProjectConfig.getPackageType(projectConfig, packageName),
                    indexOfPackage: indexOfPackage,
                };

                components.push(component);
            } else {
                SFPLogger.log(`Unable to find ID for ${fullApiName} in deployment reports`, LoggerLevel.DEBUG);
                // Ignore file if it's not an identifiable component
                continue;
            }
        }

        return components;
    }
}
