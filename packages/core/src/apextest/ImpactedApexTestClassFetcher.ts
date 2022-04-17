import * as _ from 'lodash';
import ApexLinkCheckImpl from '../apexLinkWrapper/ApexLinkCheckImpl';
import Component from '../dependency/Component';
import SFPLogger, { Logger, LoggerLevel } from '../logger/SFPLogger';
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

        SFPLogger.log(`Computing impacted apex class and associated tests`,LoggerLevel.INFO,this.logger);
        
        let apexLinkImpl = new ApexLinkCheckImpl(this.sfpPackage.workingDirectory, this.logger, this.loglevel);
        let dependencies = (await apexLinkImpl.exec()).dependencies;

        SFPLogger.log(`Dependencies: ${JSON.stringify(dependencies)}`,LoggerLevel.TRACE);
        //invalidated apex class
        for (const changedComponent of validatedChangedComponents) {
            for (const apexClass of dependencies) {
                for (const dependsOn of apexClass.dependencies) {
                    if (changedComponent.fullName == dependsOn) invalidatedClasses.push(apexClass.name);
                }
            }
        }

        let invalidatedTestClasses = _.intersection(invalidatedClasses, this.sfpPackage.apexTestClassses);
        return invalidatedTestClasses;
    }
}
