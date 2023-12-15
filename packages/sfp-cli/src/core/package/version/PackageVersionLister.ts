import { SfProject } from '@salesforce/core';
import { Package } from '@salesforce/packaging';
import SFPOrg from '../../org/SFPOrg';

export default class PackageVersionLister {

    constructor(private hubOrg:SFPOrg)
    {

    }

    public async listAllReleasedVersions(projectDir: string) {
        
        const sfProject = await SfProject.resolve(projectDir);

        const records = await Package.listVersions(this.hubOrg.getConnection(), sfProject, {
            createdLastDays: undefined,
            concise: true,
            modifiedLastDays: undefined,
            packages: [],
            isReleased: true,
            orderBy: undefined,
            verbose: false,
        });

        const results: any[] = [];

        if (records?.length > 0) {
            records.forEach((record) => {
                results.push({
                    Package2Id: record.Package2Id,
                    Branch: record.Branch,
                    Tag: record.Tag,
                    MajorVersion: record.MajorVersion,
                    MinorVersion: record.MinorVersion,
                    PatchVersion: record.PatchVersion,
                    BuildNumber: record.BuildNumber,
                    Id: record.Id,
                    SubscriberPackageVersionId: record.SubscriberPackageVersionId,
                    ConvertedFromVersionId: record.ConvertedFromVersionId,
                    Name: record.Name,
                    NamespacePrefix: record.Package2.NamespacePrefix,
                    Package2Name: record.Package2.Name,
                    Version: [record.MajorVersion, record.MinorVersion, record.PatchVersion, record.BuildNumber].join(
                        '.'
                    ),
                    IsReleased: record.IsReleased,
                    CreatedDate: new Date(record.CreatedDate).toISOString().replace('T', ' ').substring(0, 16),
                    LastModifiedDate: new Date(record.LastModifiedDate)
                        .toISOString()
                        .replace('T', ' ')
                        .substring(0, 16),
                    ReleaseVersion:
                        record.ReleaseVersion == null ? '' : Number.parseFloat(record.ReleaseVersion).toFixed(1),
                    BuildDurationInSeconds: record.BuildDurationInSeconds == null ? '' : record.BuildDurationInSeconds,
                });
            });
        }

        return results;
    }
}
