import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import SfpPackage, { PackageType } from '../SfpPackage';
import { PackageAnalyzer } from './PackageAnalyzer';
import SFPLogger, { Logger, LoggerLevel } from '@flxblio/sfp-logger';

export default class PicklistAnalyzer implements PackageAnalyzer {

    public getName() {
        return "Picklist Analyzer"
     }

     
     
    public async analyze(sfpPackage: SfpPackage, componentSet:ComponentSet, logger:Logger): Promise<SfpPackage> {
        try {
            let sourceComponents = componentSet.getSourceComponents().toArray();
            let components = [];

            for (const sourceComponent of sourceComponents) {
                if (sourceComponent.type.name == registry.types.customobject.name) {
                    //issues/1367
                    //this can add child elements that are not custom fields..
                    components.push(...sourceComponent.getChildren());
                }

                if (sourceComponent.type.name == registry.types.customobject.children.types.customfield.name) {
                    components.push(sourceComponent);
                }
            }

            if (components) {
                for (const fieldComponent of components) {
                    let customField = fieldComponent.parseXmlSync().CustomField;
                    //issues/1367
                    //if the component isn't a field customField will be undefined..so check
                    if (customField && customField['type'] == 'Picklist') {
                        sfpPackage.isPickListsFound= true;
                        break;
                    }
                }
            }
        } catch (error) {
            SFPLogger.log(`Unable to process Picklist update due to ${error.message}`,LoggerLevel.TRACE,logger);
        }
        return sfpPackage;
    }

    public async isEnabled(sfpPackage: SfpPackage,logger:Logger): Promise<boolean> {
        if (sfpPackage.packageType != PackageType.Data) return true;
        else return false;
    }
}
