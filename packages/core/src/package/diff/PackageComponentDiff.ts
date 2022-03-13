
import * as xml2js from 'xml2js';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as rimraf from 'rimraf';
import * as _ from 'lodash';
import DiffUtil, { DiffFile, DiffFileStatus } from './MetdataDiffUtil';
import simplegit from 'simple-git';
import SFPLogger, { Logger, LoggerLevel } from '../../logger/SFPLogger';
import FileUtils from '../../utils/Fileutils';
import ProjectConfig from '../../project/ProjectConfig';
import MetadataFiles from '../../metadata/MetadataFiles';
import { SOURCE_EXTENSION_REGEX, MetadataInfo, METADATA_INFO } from '../../metadata/metadataInfo';


const deleteNotSupported = ['RecordType'];
const git = simplegit();
const SEP = /\/|\\/;
let sfdxManifest;

export default class PackageComponentDiff {
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
        private isDestructive?: boolean,
        private pathToIgnore?: any[]
    ) {
        if (this.revisionTo == null || this.revisionTo.trim() === '') {
            this.revisionTo = 'HEAD';
        }
        if (this.revisionFrom == null) {
            this.revisionFrom = '';
        }
        this.destructivePackageObjPost = new Array();
        this.destructivePackageObjPre = new Array();
        this.resultOutput = [];

        sfdxManifest = ProjectConfig.getSFDXPackageManifest(null);
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
        let diffFile: DiffFile = await DiffUtil.parseContent(content);
        await DiffUtil.fetchFileListRevisionTo(this.revisionTo, this.logger);

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

        SFPLogger.log('Files to be copied', LoggerLevel.DEBUG, this.logger);
        SFPLogger.log(filesToCopy.toString(), LoggerLevel.DEBUG, this.logger);

        if (filesToCopy && filesToCopy.length > 0) {
            for (let i = 0; i < filesToCopy.length; i++) {
                let filePath = filesToCopy[i].path;
                try {
                    if (this.checkForIngore(this.pathToIgnore, filePath)) {
                        let matcher = filePath.match(SOURCE_EXTENSION_REGEX);
                        let extension = '';
                        if (matcher) {
                            extension = matcher[0];
                        } else {
                            extension = path.parse(filePath).ext;
                        }

                        await DiffUtil.copyFile(filePath, outputFolder, this.logger);

                        SFPLogger.log(`Copied file ${filePath} to ${outputFolder}`, LoggerLevel.TRACE, this.logger);
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
        }

        if (this.isDestructive) {
            SFPLogger.log('Creating Destructive Manifest..', LoggerLevel.TRACE, this.logger);
            await this.createDestructiveChanges(deletedFiles, outputFolder);
        }

        SFPLogger.log(`Generating output summary`, LoggerLevel.TRACE, this.logger);

        try {
            await DiffUtil.copyFile('.forceignore', outputFolder, this.logger);
        } catch (e) {
            SFPLogger.log(`.forceignore not found, skipping..`, LoggerLevel.DEBUG, this.logger);
        }
        try {
            let cleanedUpProjectManifest = ProjectConfig.cleanupMPDFromManifest(null, this.sfdxPackage);
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

    private buildOutput(outputFolder) {
        // let metadataFiles = new MetadataFiles();
        // metadataFiles.loadComponents(outputFolder, false);

        let keys = Object.keys(MetadataInfo.loadMetadataInfo());

        keys.forEach((key) => {
            if (METADATA_INFO[key].files && METADATA_INFO[key].files.length > 0) {
                METADATA_INFO[key].files.forEach((filePath) => {
                    let matcher = filePath.match(SOURCE_EXTENSION_REGEX);

                    let extension = '';
                    if (matcher) {
                        extension = matcher[0];
                    } else {
                        extension = path.parse(filePath).ext;
                    }

                    let name = FileUtils.getFileNameWithoutExtension(filePath, METADATA_INFO[key].sourceExtension);

                    if (METADATA_INFO[key].isChildComponent) {
                        let fileParts = filePath.split(SEP);
                        let parentName = fileParts[fileParts.length - 3];
                        name = parentName + '.' + name;
                    }

                    this.resultOutput.push({
                        action: 'Deploy',
                        metadataType: METADATA_INFO[key].xmlName,
                        componentName: name,
                        message: '',
                        path: filePath,
                    });
                });
            }
        });
        return this.resultOutput;
    }

    private async createDestructiveChanges(filePaths: DiffFileStatus[], outputFolder: string) {
        if (_.isNil(this.destructivePackageObjPost)) {
            this.destructivePackageObjPost = new Array();
        } else {
            this.destructivePackageObjPost = this.destructivePackageObjPost.filter((metaType) => {
                return !_.isNil(metaType.members) && metaType.members.length > 0;
            });
        }
        this.destructivePackageObjPre = new Array();
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

                let parsedPath = path.parse(filePath);
                let filename = parsedPath.base;
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
                        let isFormular = await DiffUtil.isFileIncludesContent(filePaths[i], '<formula>');
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
}
