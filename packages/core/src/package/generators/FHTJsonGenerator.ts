import path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';

//add disable fht in the sfdx-project.json plugins sections

export default class FHTJsonGenerator {
    public async getFht(workingDirectory: string, componentSet: ComponentSet): Promise<any> {
        let fhtYamlPath;
        let isFHTFieldFound = false;

        //read the yaml
        if (workingDirectory != null) fhtYamlPath = path.join(workingDirectory, 'postDeployTransfomations/history-tracking.yaml');

        if (!fs.existsSync(fhtYamlPath)) return {isFHTFieldsFound: false, fhtFields: null};

        //convert yaml to json
        let fhtFieldsFromYaml = yaml.load(fs.readFileSync(fhtYamlPath, {encoding: 'utf-8'}));

        //filter the components in the package
        let fhtFields = await this.getFieldsFromComponent(fhtFieldsFromYaml, componentSet);

        if (fhtFields !== null) {
            isFHTFieldFound = true;
        }

        return {isFHTFieldsFound: isFHTFieldFound, fhtFields: fhtFields};
    }

    private async getFieldsFromComponent(fhtFieldsFromYaml: any, componentSet: ComponentSet): Promise<any> {

        let sourceComponents = componentSet.getSourceComponents().toArray();

        for (const sourceComponent of sourceComponents) {
            if (sourceComponent.type.name !== registry.types.customobject.children.types.customfield.name) {
                continue;
            }
            let fhtXml = await sourceComponent.parseXml();
            if (fhtXml.trackHistory == true) {
                let objName = sourceComponent.parent.fullName;
                let fieldName = sourceComponent.fullName;

                if(fhtFieldsFromYaml[objName]) {
                    fhtFieldsFromYaml[objName].push(fieldName);
                } else {
                    //if not found - add the field to json
                    fhtFieldsFromYaml = {...fhtFieldsFromYaml, objName: [fieldName]};
                }
            }
        }
        return fhtFieldsFromYaml;
    }
}
