import * as _ from 'lodash';
import ApexLinkCheckImpl from '../apexLinkWrapper/ApexLinkCheckImpl';
import Component from '../dependency/Component';
import SFPLogger, { COLOR_KEY_MESSAGE, COLOR_WARNING, Logger, LoggerLevel } from '../logger/SFPLogger';
import SFPPackage from '../package/SFPPackage';

export default class ImpactedApexTestClassFetcher {
    public constructor(
        private sfpPackage: SFPPackage,
        private changedComponents: Component[],
        private logger: Logger,
        private loglevel?: LoggerLevel
    ) {}

    public async getImpactedTestClasses(): Promise<string[]> {
        let invalidatedClasses = [];

        let validatedChangedComponents = this.changedComponents.filter(
            (component) => component.package == this.sfpPackage.package_name
        );

        SFPLogger.log(`Computing impacted apex class and associated tests`, LoggerLevel.INFO, this.logger);

        let apexLinkImpl = new ApexLinkCheckImpl(this.sfpPackage.workingDirectory, this.logger, this.loglevel);
        let dependencies = (await apexLinkImpl.exec()).dependencies;

        SFPLogger.log(`Dependencies: ${JSON.stringify(dependencies)}`, LoggerLevel.TRACE);

       

        //compute invalidated apex classes
        for (const changedComponent of validatedChangedComponents) {

            //If the component is a permset or profile, add every test class
            //There is a change in security model, add all test classes as invalidated
            if (_.includes(['Profile','PermissionSet','SharingRules'],changedComponent.type)) {
                SFPLogger.log(
                    COLOR_WARNING(`Change in Security Model, pushing all test classes through`),
                    LoggerLevel.INFO,
                    this.logger
                );
                invalidatedClasses=invalidatedClasses.concat(this.sfpPackage.apexTestClassses);
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
        let invalidatedTestClasses = _.intersection(invalidatedClasses, this.sfpPackage.apexTestClassses);
        SFPLogger.log(`Impacted test classes: ${COLOR_KEY_MESSAGE(invalidatedTestClasses)}`, LoggerLevel.INFO, this.logger);
        return invalidatedTestClasses;
    }
}
