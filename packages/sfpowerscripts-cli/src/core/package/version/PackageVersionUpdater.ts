import SfpPackage from '../SfpPackage';

export default class PackageVersionUpdater {
    public constructor() {}

    public substituteBuildNumber(sfpPackage: SfpPackage, buildNumber: string):string {
        if (!sfpPackage.versionNumber) {
            throw new Error('The package doesnt have a version attribute, Please check your definition');
        } else {
            let segments = sfpPackage.versionNumber.split('.');
            let numberToBeAppended = parseInt(buildNumber);

            if (isNaN(numberToBeAppended)) throw new Error('BuildNumber should be a number');
            else segments[3] = buildNumber;
            return `${segments[0]}.${segments[1]}.${segments[2]}.${segments[3]}`;
        }
    }
}
