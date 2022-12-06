import SFPLogger from '@dxatscale/sfp-logger';
import { SfProject } from '@salesforce/core';
import { PackageSaveResult, PackageVersion } from '@salesforce/packaging';
import SFPOrg from '../../org/SFPOrg';

export default class PromoteUnlockedPackageImpl {
    public constructor(
        private project_directory: string,
        private package_version_id: string,
        private devhub_alias: string
    ) {}

    public async promote(): Promise<void> {
        let hubOrg = await SFPOrg.create({ aliasOrUsername: this.devhub_alias });
        let project = await SfProject.resolve(this.project_directory);

        const packageVersion = new PackageVersion({
            connection: hubOrg.getConnection(),
            project: project,
            idOrAlias: this.package_version_id,
        });
        const packageVersionData = await packageVersion.getData();

        let result: PackageSaveResult;
        try {
            result = await packageVersion.promote();
            result.id = packageVersionData.SubscriberPackageVersionId;
        } catch (e) {
            if (e.message.includes('previously released')) {
                SFPLogger.log(`Package ${this.package_version_id} is already promoted, Ignoring`);
            } else throw e;
        }
    }
}
