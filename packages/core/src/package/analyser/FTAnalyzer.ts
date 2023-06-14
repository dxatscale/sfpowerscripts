import path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import SfpPackage, { PackageType } from '../SfpPackage';
import { PackageAnalyzer } from './PackageAnalyzer';
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';

export default class FTAnalyser implements PackageAnalyzer {

    public getName(): string {
        return "Feed Tracking Analyzer";
    };

    public async analyze(sfpPackage: SfpPackage, componentSet:ComponentSet, logger:Logger): Promise<SfpPackage> {
        try {

            let ftFields: { [key: string]: Array<string> } = {};

            //read the yaml
            let ftYamlPath = path.join(
                sfpPackage.workingDirectory,
                sfpPackage.projectDirectory,
                sfpPackage.packageDirectory,
                '/postDeploy/feed-tracking.yml'
            );

            //read components mentioned in yaml
            if (fs.existsSync(ftYamlPath)) {
                //convert yaml to json
                ftFields = yaml.load(fs.readFileSync(ftYamlPath, { encoding: 'utf-8' })) as {[key: string]: string[]};
            }


            //filter the components in the package
            ftFields = await this.addFieldsFromComponentSet(ftFields, componentSet);

            if (Object.keys(ftFields).length>0) {
                sfpPackage['isFTFieldFound'] = true;
                sfpPackage['ftFields'] = ftFields;
            }
        } catch (error) {
            //Ignore error for now
            SFPLogger.log(`Unable to process Feed Tracking due to ${error.message}`,LoggerLevel.TRACE,logger);
        }
        return sfpPackage;
    }

    private async addFieldsFromComponentSet(
        ftFields: { [key: string]: Array<string> },
        componentSet: ComponentSet
    ): Promise<Record<string, Array<string>>> {
        let sourceComponents = componentSet.getSourceComponents().toArray();

        for (const sourceComponent of sourceComponents) {
            if (sourceComponent.type.name !== registry.types.customobject.children.types.customfield.name) {
                continue;
            }

            let customField = sourceComponent.parseXmlSync().CustomField;
            if (customField['trackFeedHistory'] == 'true') {
                let objName = sourceComponent.parent.fullName;
                if (!ftFields[objName]) ftFields[objName] = [];
                ftFields[objName].push(sourceComponent.name);
            }
        }
        return ftFields;
    }

    public async isEnabled(sfpPackage: SfpPackage,logger:Logger): Promise<boolean> {
        if (sfpPackage.packageType != PackageType.Data) return true;
        else return false;
    }
}
