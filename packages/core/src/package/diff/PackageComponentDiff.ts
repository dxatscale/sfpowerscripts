import * as xml2js from 'xml2js';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as rimraf from 'rimraf';
import * as _ from 'lodash';
import simplegit from 'simple-git';
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import ProjectConfig from '../../project/ProjectConfig';
import MetadataFiles from '../../metadata/MetadataFiles';
import { SOURCE_EXTENSION_REGEX, MetadataInfo, METADATA_INFO } from '../../metadata/MetadataInfo';
import { MetadataResolver } from '@salesforce/source-deploy-retrieve';
import GitDiffUtils, { DiffFile, DiffFileStatus } from '../../git/GitDiffUtil';

const deleteNotSupported = ['RecordType'];
const git = simplegit();
let sfdxManifest;

export default class PackageComponentDiff {
    private gitDiffUtils: GitDiffUtils;

    destructivePackageObjPre: any[];
    destructivePackageObjPost: any[];
    resultOutput: {
        action: string;
        metadataType: string;
        componentName: string;
        message: string;
        path: string;
    }[];
    public constructor(
        private logger: Logger,
        private sfdxPackage: string,
        private revisionFrom?: string,
        private revisionTo?: string,
        private isDestructive?: boolean
    ) {
        if (this.revisionTo == null || this.revisionTo.trim() === '') {
            this.revisionTo = 'HEAD';
        }
        if (this.revisionFrom == null) {
            this.revisionFrom = '';
        }
        this.destructivePackageObjPost = [];
        this.destructivePackageObjPre = [];
        this.resultOutput = [];

        sfdxManifest = ProjectConfig.getSFDXProjectConfig(null);
        this.gitDiffUtils = new GitDiffUtils();
    }

    public async build(outputFolder: string) {
        rimraf.sync(outputFolder);

        const sepRegex = /\n|\r/;
        let data = '';

        //check if same commit
        const commitFrom = await git.raw(['rev-list', '-n', '1', this.revisionFrom]);
        const commitTo = await git.raw(['rev-list', '-n', '1', this.revisionTo]);
        if (commitFrom === commitTo) {
            throw new Error(`Unable to compute diff, as both commits are same`);
        }
        //Make it relative to make the command works from a project created as a subfolder in a repository
        data = await git.diff([
            '--raw',
            this.revisionFrom,
            this.revisionTo,
            '--relative',
            ProjectConfig.getPackageDescriptorFromConfig(this.sfdxPackage, sfdxManifest).path,
        ]);

        let content = data.split(sepRegex);
        let diffFile: DiffFile = await this.parseContent(content);
        await this.gitDiffUtils.fetchFileListRevisionTo(this.revisionTo, this.logger);

        let filesToCopy = diffFile.addedEdited;
        let deletedFiles = diffFile.deleted;

        deletedFiles = deletedFiles.filter((deleted) => {
            let found = false;
            let deletedMetadata = MetadataFiles.getFullApiNameWithExtension(deleted.path);
            for (let i = 0; i < filesToCopy.length; i++) {
                let addedOrEdited = MetadataFiles.getFullApiNameWithExtension(filesToCopy[i].path);
                if (deletedMetadata === addedOrEdited) {
                    found = true;
                    break;
                }
            }
            return !found;
        });

        if (fs.existsSync(outputFolder) == false) {
            fs.mkdirSync(outputFolder);
        }

        const resolver = new MetadataResolver();

        if (filesToCopy && filesToCopy.length > 0) {
            for (let i = 0; i < filesToCopy.length; i++) {
                let filePath = filesToCopy[i].path;

                let sourceComponents = resolver.getComponentsFromPath(filePath);
                for (const sourceComponent of sourceComponents) {
                    if (sourceComponent.type.strategies?.adapter == AdapterId.MatchingContentFile) {
                        await this.gitDiffUtils.copyFile(sourceComponent.xml, outputFolder, this.logger);
                        await this.gitDiffUtils.copyFile(sourceComponent.content, outputFolder, this.logger);
                    } else if (sourceComponent.type.strategies?.adapter == AdapterId.MixedContent) {
                        await this.gitDiffUtils.copyFile(sourceComponent.xml, outputFolder, this.logger);
                        await this.gitDiffUtils.copyFolder(sourceComponent.content, outputFolder, this.logger);
                    } else if (sourceComponent.type.strategies?.adapter == AdapterId.Decomposed) {
                        await this.gitDiffUtils.copyFile(sourceComponent.xml, outputFolder, this.logger);
                    } else if (sourceComponent.type.strategies?.adapter == AdapterId.Bundle) {
                        await this.gitDiffUtils.copyFolder(sourceComponent.content, outputFolder, this.logger);
                    } else if (sourceComponent.type.strategies?.adapter == AdapterId.Default) {
                        await this.gitDiffUtils.copyFile(sourceComponent.xml, outputFolder, this.logger);
                    } else {
                        await this.gitDiffUtils.copyFile(sourceComponent.xml, outputFolder, this.logger);
                    }
                }
            }
        }

        if (this.isDestructive) {
            SFPLogger.log('Creating Destructive Manifest..', LoggerLevel.TRACE, this.logger);
            await this.createDestructiveChanges(deletedFiles, outputFolder);
        }

        //Folder is empty after all this operations, return without copying additional files
        if (fs.readdirSync(outputFolder).length === 0) {
            rimraf.sync(outputFolder);
            return null;
        }

        SFPLogger.log(`Generating output summary`, LoggerLevel.TRACE, this.logger);

        try {
            await this.gitDiffUtils.copyFile('.forceignore', outputFolder, this.logger);
        } catch (e) {
            SFPLogger.log(`.forceignore not found, skipping..`, LoggerLevel.DEBUG, this.logger);
        }
        try {
            let cleanedUpProjectManifest = ProjectConfig.cleanupMPDFromProjectDirectory(null, this.sfdxPackage);
            fs.writeJSONSync(path.join(outputFolder, 'sfdx-project.json'), cleanedUpProjectManifest, { spaces: 4 });
        } catch (error) {
            SFPLogger.log(`sfdx-project.json not found, skipping..`, LoggerLevel.DEBUG, this.logger);
        }

        return this.resultOutput;
    }

    //TODO: Refactor using proper ignore
    private checkForIngore(pathToIgnore: any[], filePath: string) {
        pathToIgnore = pathToIgnore || [];
        if (pathToIgnore.length === 0) {
            return true;
        }

        let returnVal = true;
        pathToIgnore.forEach((ignore) => {
            if (
                path.resolve(ignore) === path.resolve(filePath) ||
                path.resolve(filePath).includes(path.resolve(ignore))
            ) {
                returnVal = false;
            }
        });
        return returnVal;
    }

    private async createDestructiveChanges(filePaths: DiffFileStatus[], outputFolder: string) {
        if (_.isNil(this.destructivePackageObjPost)) {
            this.destructivePackageObjPost = [];
        } else {
            this.destructivePackageObjPost = this.destructivePackageObjPost.filter((metaType) => {
                return !_.isNil(metaType.members) && metaType.members.length > 0;
            });
        }
        this.destructivePackageObjPre = [];
        //returns root, dir, base and name
        for (let i = 0; i < filePaths.length; i++) {
            let filePath = filePaths[i].path;
            try {
                let matcher = filePath.match(SOURCE_EXTENSION_REGEX);
                let extension = '';
                if (matcher) {
                    extension = matcher[0];
                } else {
                    extension = path.parse(filePath).ext;
                }

                let name = MetadataInfo.getMetadataName(filePath);

                if (name) {
                    if (!MetadataFiles.isCustomMetadata(filePath, name)) {
                        // avoid to generate destructive for Standard Components
                        //Support on Custom Fields and Custom Objects for now

                        this.resultOutput.push({
                            action: 'Skip',
                            componentName: MetadataFiles.getMemberNameFromFilepath(filePath, name),
                            metadataType: 'StandardField/CustomMetadata',
                            message: '',
                            path: '--',
                        });

                        continue;
                    }
                    let member = MetadataFiles.getMemberNameFromFilepath(filePath, name);
                    if (name === METADATA_INFO.CustomField.xmlName) {
                        let isFormular = await this.gitDiffUtils.isFileIncludesContent(filePaths[i], '<formula>');
                        if (isFormular) {
                            this.destructivePackageObjPre = this.buildDestructiveTypeObj(
                                this.destructivePackageObjPre,
                                name,
                                member
                            );

                            SFPLogger.log(
                                `${filePath} ${MetadataFiles.isCustomMetadata(filePath, name)}`,
                                LoggerLevel.DEBUG,
                                this.logger
                            );

                            this.resultOutput.push({
                                action: 'Delete',
                                componentName: member,
                                metadataType: name,
                                message: '',
                                path: 'Manual Intervention Required',
                            });
                        } else {
                            this.destructivePackageObjPost = this.buildDestructiveTypeObj(
                                this.destructivePackageObjPost,
                                name,
                                member
                            );
                        }
                        SFPLogger.log(
                            `${filePath} ${MetadataFiles.isCustomMetadata(filePath, name)}`,
                            LoggerLevel.DEBUG,
                            this.logger
                        );

                        this.resultOutput.push({
                            action: 'Delete',
                            componentName: member,
                            metadataType: name,
                            message: '',
                            path: 'destructiveChanges.xml',
                        });
                    } else {
                        if (!deleteNotSupported.includes(name)) {
                            this.destructivePackageObjPost = this.buildDestructiveTypeObj(
                                this.destructivePackageObjPost,
                                name,
                                member
                            );
                            this.resultOutput.push({
                                action: 'Delete',
                                componentName: member,
                                metadataType: name,
                                message: '',
                                path: 'destructiveChanges.xml',
                            });
                        } else {
                            //add the component in the manual action list
                            // TODO
                        }
                    }
                }
            } catch (ex) {
                this.resultOutput.push({
                    action: 'ERROR',
                    componentName: '',
                    metadataType: '',
                    message: ex.message,
                    path: filePath,
                });
            }
        }

        this.writeDestructivechanges(this.destructivePackageObjPost, outputFolder, 'destructiveChanges.xml');
    }

    private writeDestructivechanges(destrucObj: Array<any>, outputFolder: string, fileName: string) {
        //ensure unique component per type
        for (let i = 0; i < destrucObj.length; i++) {
            destrucObj[i].members = _.uniq(destrucObj[i].members);
        }
        destrucObj = destrucObj.filter((metaType) => {
            return metaType.members && metaType.members.length > 0;
        });

        if (destrucObj.length > 0) {
            let dest = {
                Package: {
                    $: {
                        xmlns: 'http://soap.sforce.com/2006/04/metadata',
                    },
                    types: destrucObj,
                },
            };

            let destructivePackageName = fileName;
            let filepath = path.join(outputFolder, destructivePackageName);
            let builder = new xml2js.Builder();
            let xml = builder.buildObject(dest);
            fs.writeFileSync(filepath, xml);
        }
    }

    private buildDestructiveTypeObj(destructiveObj, name, member) {
        let typeIsPresent = false;
        for (let i = 0; i < destructiveObj.length; i++) {
            if (destructiveObj[i].name === name) {
                typeIsPresent = true;
                destructiveObj[i].members.push(member);
                break;
            }
        }
        let typeNode: any;
        if (typeIsPresent === false) {
            typeNode = {
                name: name,
                members: [member],
            };
            destructiveObj.push(typeNode);
        }
        return destructiveObj;
    }

    private async parseContent(fileContents): Promise<DiffFile> {
        const statusRegEx = /\sA\t|\sM\t|\sD\t/;
        const renamedRegEx = /\sR[0-9]{3}\t|\sC[0-9]{3}\t/;
        const tabRegEx = /\t/;
        const deletedFileRegEx = new RegExp(/\sD\t/);
        const lineBreakRegEx = /\r?\n|\r|( $)/;

        let metadataFiles = new MetadataFiles();

        let diffFile: DiffFile = {
            deleted: [],
            addedEdited: [],
        };

        for (let i = 0; i < fileContents.length; i++) {
            if (statusRegEx.test(fileContents[i])) {
                let lineParts = fileContents[i].split(statusRegEx);

                let finalPath = path.join('.', lineParts[1].replace(lineBreakRegEx, ''));
                finalPath = finalPath.trim();
                finalPath = finalPath.replace('\\303\\251', 'é');

                if (!(await metadataFiles.isInModuleFolder(finalPath))) {
                    continue;
                }

                if (!metadataFiles.accepts(finalPath)) {
                    continue;
                }

                let revisionPart = lineParts[0].split(/\t|\s/);

                if (deletedFileRegEx.test(fileContents[i])) {
                    //Deleted
                    diffFile.deleted.push({
                        revisionFrom: revisionPart[2].substring(0, 9),
                        revisionTo: revisionPart[3].substring(0, 9),
                        path: finalPath,
                    });
                } else {
                    // Added or edited
                    diffFile.addedEdited.push({
                        revisionFrom: revisionPart[2].substring(0, 9),
                        revisionTo: revisionPart[3].substring(0, 9),
                        path: finalPath,
                    });
                }
            } else if (renamedRegEx.test(fileContents[i])) {
                let lineParts = fileContents[i].split(renamedRegEx);

                let paths = lineParts[1].trim().split(tabRegEx);

                let finalPath = path.join('.', paths[1].trim());
                finalPath = finalPath.replace('\\303\\251', 'é');
                let revisionPart = lineParts[0].split(/\t|\s/);

                if (!(await metadataFiles.isInModuleFolder(finalPath))) {
                    continue;
                }

                if (!metadataFiles.accepts(paths[0].trim())) {
                    continue;
                }

                diffFile.addedEdited.push({
                    revisionFrom: '0000000',
                    revisionTo: revisionPart[3],
                    renamedPath: path.join('.', paths[0].trim()),
                    path: finalPath,
                });

                //allow deletion of renamed components
                diffFile.deleted.push({
                    revisionFrom: revisionPart[2],
                    revisionTo: '0000000',
                    path: paths[0].trim(),
                });
            }
        }
        return diffFile;
    }
}
enum AdapterId {
    Bundle = 'bundle',
    Decomposed = 'decomposed',
    Default = 'default',
    MatchingContentFile = 'matchingContentFile',
    MixedContent = 'mixedContent',
}
