import * as _ from 'lodash';
import ApexDepedencyCheckImpl from "@dxatscale/apexlink/lib/ApexDepedencyCheckImpl"
import Component from '../dependency/Component';
import SFPLogger, { COLOR_KEY_MESSAGE, COLOR_WARNING, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import SfpPackage, { PackageType } from '../package/SfpPackage';
import path from 'path';

export default class ImpactedApexTestClassFetcher {
    public constructor(
        private sfpPackage: SfpPackage,
        private changedComponents: Component[],
        private logger: Logger,
        private loglevel?: LoggerLevel
    ) {}

    public async getImpactedTestClasses(): Promise<string[]> {
    
        let invalidatedClasses = [];
        let invalidatedTestClasses = [];

        try
        {
        let validatedChangedComponents = this.changedComponents.filter(
            (component) => component.package == this.sfpPackage.packageName
        );

        SFPLogger.log(`Computing impacted apex class and associated tests`, LoggerLevel.INFO, this.logger);
        SFPLogger.log(`Changed components ${JSON.stringify(validatedChangedComponents)}`, LoggerLevel.INFO, this.logger);

    
       
        let apexLinkImpl = new ApexDepedencyCheckImpl(this.logger,path.join(this.sfpPackage.workingDirectory, this.sfpPackage.packageDirectory));
        let dependencies = (await apexLinkImpl.execute()).dependencies;

        if(dependencies.length==0)
        {
            //go for another attempt
            SFPLogger.log(`No dependencies found, retrying with apexlink,Retrying again`, LoggerLevel.INFO,this.logger);
            apexLinkImpl = new ApexDepedencyCheckImpl(this.logger,this.sfpPackage.workingDirectory);
            dependencies = (await apexLinkImpl.execute()).dependencies;
        }

        SFPLogger.log(`Dependencies: ${JSON.stringify(dependencies)}`, LoggerLevel.INFO,this.logger);

        //compute invalidated apex classes
        for (const changedComponent of validatedChangedComponents) {
            //If the component is a permset or profile, add every test class
            //There is a change in security model, add all test classes as invalidated
            // Temoorarily disabled this check as it is not working as expected
            if (this.sfpPackage.packageType != PackageType.Diff && _.includes(['Profile', 'PermissionSet', 'SharingRules'], changedComponent.type)) {
                SFPLogger.log(
                    COLOR_WARNING(`Change in Security Model, pushing all test classes through`),
                    LoggerLevel.INFO,
                    this.logger
                );
                invalidatedClasses = invalidatedClasses.concat(this.sfpPackage.apexTestClassses);
                break;
            }

            for (const apexClass of dependencies) {
                // push any apex class or test class that is changed, which would then get filtered during subsequent matching with test class
                if (apexClass.name == changedComponent.fullName) invalidatedClasses.push(apexClass.name);

                // push any apex class or test class who is dependent on the changed entity
                for (const dependsOn of apexClass.dependencies) {
                    if (changedComponent.fullName == dependsOn) invalidatedClasses.push(apexClass.name);
                }
            }
        }

        SFPLogger.log(`Impacted classes: ${COLOR_KEY_MESSAGE(invalidatedClasses)}`, LoggerLevel.INFO, this.logger);
        //Filter all apex classes by means of whats is detected in test classes list
        invalidatedTestClasses = _.intersection(invalidatedClasses, this.sfpPackage.apexTestClassses);
        SFPLogger.log(
            `Impacted test classes: ${COLOR_KEY_MESSAGE(invalidatedTestClasses)}`,
            LoggerLevel.INFO,
            this.logger
        );
        }catch(error)
        {
            SFPLogger.log(
                `Unable to compute impacted test classes, defaulting to all test classes due to error ${error}`,
                LoggerLevel.ERROR,
                this.logger
            );
            invalidatedClasses = this.sfpPackage.apexTestClassses;
        }
        return invalidatedTestClasses;
    }
}
