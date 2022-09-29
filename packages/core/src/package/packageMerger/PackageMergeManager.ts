import SfpPackage, { PackageType } from '../SfpPackage';
import SfpPackageBuilder from '../../package/SfpPackageBuilder';
const tmp = require('tmp');
import * as fs from 'fs-extra';
const path = require('path');
import { ComponentSet, MetadataConverter } from '@salesforce/source-deploy-retrieve';
import { Logger } from '@dxatscale/sfp-logger';

export default class PackageMergeManager {
    public constructor(private sfpPackages: SfpPackage[], private logger?: Logger) {}

    public async mergePackages(targetOrAlias?: string): Promise<MergeResult> {
        let mergeResult: MergeResult = new MergeResult();
        mergeResult.skippedPackages = [];
        mergeResult.unlockedPackages = [];
        mergeResult.mergedPackages = [];

        mergeResult.requestedMergeOrder = this.sfpPackages;

        //Use the .sfpowerscripts directory
        let tmpDir = tmp.dirSync({ unsafeCleanup: true });
        let locationOfCopiedDirectory = tmpDir.name;
        //Create a  temporary folder
        let mergedProjectDir = path.join(locationOfCopiedDirectory, `${this.makefolderid(5)}_merged`);
        mergeResult.mergedProjectDirectory = mergedProjectDir;

        let mergedPackageDir = path.join(mergedProjectDir, 'force-app');
        fs.mkdirpSync(mergedPackageDir);

        //Create sfdx project.json
        fs.writeJSONSync(path.join(mergedProjectDir, 'sfdx-project.json'), this.getMergedProjectManifest(), {
            spaces: 4,
        });

        const converter = new MetadataConverter();

        for (const sfpPackage of this.sfpPackages) {
            let componentSet: ComponentSet;

            if (sfpPackage.packageType == PackageType.Data) {
                mergeResult.skippedPackages.push(sfpPackage);
                continue;
            } else if (sfpPackage.packageType == PackageType.Unlocked) {
                //Push for now
                mergeResult.skippedPackages.push(sfpPackage);
                mergeResult.unlockedPackages.push(sfpPackage);
                continue;
            } else {
                //handle alaisfy directory
                if (sfpPackage.packageDescriptor.aliasfy) {
                    let aliasFolder = path.join(
                        process.cwd(),
                        sfpPackage.projectDirectory,
                        sfpPackage.packageDirectory,
                        targetOrAlias ? targetOrAlias : 'default'
                    );
                    if (fs.existsSync(aliasFolder)) {
                        componentSet = ComponentSet.fromSource(aliasFolder);
                    } else {
                        continue;
                    }
                } else {
                    componentSet = ComponentSet.fromSource(
                        path.join(process.cwd(), sfpPackage.projectDirectory, sfpPackage.packageDirectory)
                    );
                }

                fs.copyFileSync(
                    path.join(sfpPackage.projectDirectory, 'forceignores', '.buildignore'),
                    path.join(mergedProjectDir, '.forceignore')
                );
                console.log('copied file');

                //Merge
                let results = await converter.convert(componentSet, 'source', {
                    type: 'merge',
                    mergeWith: ComponentSet.fromSource(mergedPackageDir).getSourceComponents(),
                    defaultDirectory: mergedPackageDir,

                    forceIgnoredPaths: new Set([
                        path.join(process.cwd(), sfpPackage.projectDirectory, 'forceignores', '.buildignore'),
                    ]),
                });

                for (const component of results.converted) {
                    if (this.isXmlFileSuffixDuped(component.xml)) {
                        this.dedupeXmlFileSuffix(component.xml);
                    }
                }
                mergeResult.mergedPackages.push(sfpPackage);
            }
        }

        //Build SfpPackage
        if (mergeResult.mergedPackages.length > 0) {
            let mergedSfPPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(
                this.logger,
                mergeResult.mergedProjectDirectory,
                'merged',
                {
                    branch: 'temp',
                    packageVersionNumber: '1.0.0.0',
                    sourceVersion: '00000000',
                },
                null
            );
            mergeResult.mergedPackage = mergedSfPPackage;
        }

        tmpDir.removeCallback();
        return mergeResult;
    }

    private isXmlFileSuffixDuped(xmlFile: string): boolean {
        return xmlFile.match(/-meta\.xml/g)?.length === 2;
    }

    private dedupeXmlFileSuffix(xmlFile: string): string {
        let deduped = xmlFile.replace(/-meta\.xml/, '');
        fs.renameSync(xmlFile, deduped);

        return deduped;
    }

    private getMergedProjectManifest() {
        let projectManifest = {
            packageDirectories: [
                {
                    path: 'force-app',
                    package: 'merged',
                    versionNumber: '2.0.0.0',
                    default: true,
                },
            ],
            namespace: '',
            sourceApiVersion: '53.0',
        };
        return projectManifest;
    }

    private makefolderid(length): string {
        var result = '';
        var characters =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }
}

export class MergeResult {
    mergedProjectDirectory: string;
    mergedPackage: SfpPackage;
    mergedPackages: SfpPackage[];
    skippedPackages?: SfpPackage[];
    unlockedPackages?: SfpPackage[];
    requestedMergeOrder: SfpPackage[];
}
