import * as path from 'path';
import * as fs from 'fs-extra';
import * as _ from 'lodash';

import { LoggerLevel } from '@salesforce/core';
import simplegit, { SimpleGit } from 'simple-git';
import SFPLogger, { Logger } from '@dxatscale/sfp-logger';
const SEP = /\/|\\/;

export interface DiffFileStatus {
    revisionFrom: string;
    revisionTo: string;
    path: string;
    renamedPath?: string;
}

export interface DiffFile {
    deleted: DiffFileStatus[];
    addedEdited: DiffFileStatus[];
}

const git: SimpleGit = simplegit();

export default class GitDiffUtils {
    private gitTreeRevisionTo: {
        revision: string;
        path: string;
    }[];

    public async isFileIncludesContent(diffFile: DiffFileStatus, content: string): Promise<boolean> {
        let fileAsString = await git.show(['--raw', diffFile.revisionFrom]);
        let result = fileAsString.includes(content);
        return result;
    }

    public async fetchFileListRevisionTo(revisionTo: string, logger: Logger) {
        SFPLogger.log('Fetching file list from target revision ' + revisionTo, LoggerLevel.TRACE, logger);
        this.gitTreeRevisionTo = [];
        let revisionTree = await git.raw(['ls-tree', '-r', revisionTo]);
        const sepRegex = /\n|\r/;
        let lines = revisionTree.split(sepRegex);
        for (let i = 0; i < lines.length; i++) {
            if (lines[i] === '') continue;
            let fields = lines[i].split(/\t/);
            let pathStr = fields[1];
            let revisionSha = fields[0].split(/\s/)[2];
            let fileMetadata = {
                revision: revisionSha,
                path: path.join('.', pathStr),
            };
            this.gitTreeRevisionTo.push(fileMetadata);
        }
        return this.gitTreeRevisionTo;
    }

    public async copyFile(filePath: string, outputFolder: string, logger: Logger) {
        SFPLogger.log(`Copying file ${filePath} from git to ${outputFolder}`, LoggerLevel.TRACE, logger);
        if (fs.existsSync(path.join(outputFolder, filePath))) {
            SFPLogger.log(`File ${filePath}  already in output folder. `, LoggerLevel.TRACE, logger);
            return;
        }

        let gitFiles: {
            revision: string;
            path: string;
        }[] = [];
        this.gitTreeRevisionTo.forEach((file) => {
            if (file.path === filePath) {
                gitFiles.push(file);
            }
        });

        let copyOutputFolder = outputFolder;
        for (let i = 0; i < gitFiles.length; i++) {
            outputFolder = copyOutputFolder;
            let gitFile = gitFiles[i];

            SFPLogger.log(
                `Associated file ${i}: ${gitFile.path}  Revision: ${gitFile.revision}`,
                LoggerLevel.TRACE,
                logger
            );

            let outputPath = path.join(outputFolder, gitFile.path);

            let filePathParts = gitFile.path.split(SEP);

            if (fs.existsSync(outputFolder) == false) {
                fs.mkdirSync(outputFolder);
            }
            // Create folder structure
            for (let i = 0; i < filePathParts.length - 1; i++) {
                let folder = filePathParts[i].replace('"', '');
                outputFolder = path.join(outputFolder, folder);
                if (fs.existsSync(outputFolder) == false) {
                    fs.mkdirSync(outputFolder);
                }
            }
            let fileContent = await git.binaryCatFile(['-p', gitFile.revision]);
            fs.writeFileSync(outputPath, fileContent);
        }
    }

    public async copyFolder(folderPath: string, outputFolder: string, logger: Logger) {
        SFPLogger.log(`Copying folder ${folderPath} from git to ${outputFolder}`, LoggerLevel.TRACE, logger);
        if (fs.existsSync(path.join(outputFolder, folderPath))) {
            SFPLogger.log(`Folder ${folderPath}  already in output folder. `, LoggerLevel.TRACE, logger);
            return;
        }

        this.gitTreeRevisionTo.forEach((file) => {
            let fileToCompare = file.path;
            if (fileToCompare.startsWith(folderPath)) {
                this.copyFile(fileToCompare, outputFolder, logger);
            }
        });
    }

    public getChangedOrAdded(list1: any[], list2: any[], key: string) {
        let result: any = {
            addedEdited: [],
            deleted: [],
        };

        //Ensure array
        if (!_.isNil(list1) && !Array.isArray(list1)) {
            list1 = [list1];
        }
        if (!_.isNil(list2) && !Array.isArray(list2)) {
            list2 = [list2];
        }

        if (_.isNil(list1) && !_.isNil(list2) && list2.length > 0) {
            result.addedEdited.push(...list2);
        }

        if (_.isNil(list2) && !_.isNil(list1) && list1.length > 0) {
            result.deleted.push(...list1);
        }

        if (!_.isNil(list1) && !_.isNil(list2)) {
            list1.forEach((elem1) => {
                let found = false;
                for (let i = 0; i < list2.length; i++) {
                    let elem2 = list2[i];
                    if (elem1[key] === elem2[key]) {
                        //check if edited
                        if (!_.isEqual(elem1, elem2)) {
                            result.addedEdited.push(elem2);
                        }
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    result.deleted.push(elem1);
                }
            });

            //Check for added elements

            let addedElement = _.differenceWith(list2, list1, function (element1: any, element2: any) {
                return element1[key] === element2[key];
            });

            if (!_.isNil(addedElement)) {
                result.addedEdited.push(...addedElement);
            }
        }
        return result;
    }
}
