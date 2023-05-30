import path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import SfpPackage, { PackageType } from '../SfpPackage';
import { PackageAnalyzer } from './PackageAnalyzer';
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';

export default class FHTAnalyser implements PackageAnalyzer {
    public async analyze(sfpPackage: SfpPackage, componentSet:ComponentSet, logger:Logger): Promise<SfpPackage> {
        try {

            let fhtFields: { [key: string]: Array<string> } = {};

            //read the yaml
            let fhtYamlPath = path.join(
                sfpPackage.workingDirectory,
                sfpPackage.projectDirectory,
                sfpPackage.packageDirectory,
                '/postDeploy/history-tracking.yml'
            );

            //read components mentioned in yaml
            if (fs.existsSync(fhtYamlPath)) {
                //convert yaml to json
                fhtFields = yaml.load(fs.readFileSync(fhtYamlPath, { encoding: 'utf-8' })) as {[key: string]: string[]};
            }


            //filter the components in the package
            fhtFields = await this.addFieldsFromComponentSet(fhtFields, componentSet);

            if (Object.keys(fhtFields).length>0) {
                sfpPackage['isFHTFieldFound'] = true;
                sfpPackage['fhtFields'] = fhtFields;
            }
        } catch (error) {
            //Ignore error for now
            SFPLogger.log(`Unable to process Field History Tracking due to ${error.message}`,LoggerLevel.TRACE,logger);
        }
        return sfpPackage;
    }

    private async addFieldsFromComponentSet(
        fhtFields: { [key: string]: Array<string> },
        componentSet: ComponentSet
    ): Promise<Record<string, Array<string>>> {
        let sourceComponents = componentSet.getSourceComponents().toArray();

        for (const sourceComponent of sourceComponents) {
            if (sourceComponent.type.name !== registry.types.customobject.children.types.customfield.name) {
                continue;
            }

            let customField = sourceComponent.parseXmlSync().CustomField;
            if (customField['trackHistory'] == 'true') {
                let objName = sourceComponent.parent.fullName;
                if (!fhtFields[objName]) fhtFields[objName] = [];
                fhtFields[objName].push(sourceComponent.name);
            }
        }
        return fhtFields;
    }

    public async isEnabled(sfpPackage: SfpPackage,logger:Logger): Promise<boolean> {
        if (sfpPackage.packageType != PackageType.Data) return true;
        else return false;
    }
}
