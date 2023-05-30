import { retrieveMetadata } from '@utils/retrieveMetadata';
import { Logger, Org } from '@salesforce/core';
import * as path from 'path';
import * as fs from 'fs';
import { METADATA_INFO, MetadataInfo } from '@impl/metadata/metadataInfo';
import ProfileRetriever from '@impl/metadata/retriever/profileRetriever';
import ProfileWriter from '@impl/metadata/writer/profileWriter';
import Profile from '@impl/metadata/schema';
import { Sfpowerkit } from '@utils/sfpowerkit';
import MetadataFiles from '@impl/metadata/metadataFiles';
import SFPLogger, {LoggerLevel } from '@dxatscale/sfp-logger';

import { diff_match_patch } from 'diff-match-patch';
import 'diff-match-patch-line-and-word'; // import globally to  enhanse the class
import FileUtils from '@utils/fileutils';
import rimraf from 'rimraf';
// import { ProgressBar } from '../../../ui/progressBar';

// const dmp = new diff_match_patch();

// https://github.com/google/diff-match-patch/wiki/Line-or-Word-Diffs#line-mode
function diff_lineMode(text1, text2) {
  const dmp = new diff_match_patch();
  const a = dmp.diff_linesToChars_(text1, text2);
  const lineText1 = a.chars1;
  const lineText2 = a.chars2;
  const lineArray = a.lineArray;
  const diffs = dmp.diff_main(lineText1, lineText2, false);
  dmp.diff_charsToLines_(diffs, lineArray);
  return diffs;
}
const CRLF_REGEX = /\r\n/;
const LF_REGEX = /\n/;

export default class ProfileDiffImpl {
    private sourceOrg: Org = null;
    public output = [];
    private sourceLabel = 'Local';
    private targetLabel = 'Remote';
    public constructor(
        private profileList: string[],
        private sourceOrgStr: string,
        private targetOrg: Org,
        private outputFolder: string
    ) {
        this.targetLabel = this.targetOrg.getConnection().getUsername();
    }
    public async diff() {
        SFPLogger.log('Profile diff start. ', LoggerLevel.INFO);
        if (this.outputFolder) {
            rimraf.sync(this.outputFolder);
        }
        let profileSource: Promise<string[]> = null;
        //let profileXmlMapPromise: Promise<string[]> = null;
        if (this.sourceOrgStr) {
            SFPLogger.log('Creating source org ', LoggerLevel.INFO);
            this.sourceOrg = await Org.create({
                aliasOrUsername: this.sourceOrgStr,
                isDevHub: false,
            });
        }
        if ((!this.profileList || this.profileList.length === 0) && this.sourceOrgStr) {
            this.sourceLabel = this.sourceOrg.getConnection().getUsername();
            SFPLogger.log('No profile provided, loading all profiles from source org. ', LoggerLevel.INFO);
            const conn = this.sourceOrg.getConnection();

            let profileNamesPromise = retrieveMetadata([{ type: 'Profile', folder: null }], conn);
            profileSource = profileNamesPromise.then((profileNames) => {
                return this.retrieveProfiles(profileNames, this.sourceOrg);
            });
        } else {
            SFPLogger.log('Reading profiles from file system. ', LoggerLevel.INFO);

            const srcFolders = await Sfpowerkit.getProjectDirectories();

            const metadataFiles = new MetadataFiles();

            SFPLogger.log('Source Folders are', LoggerLevel.DEBUG);
            for (let i = 0; i < srcFolders.length; i++) {
                const srcFolder = srcFolders[i];
                const normalizedPath = path.join(process.cwd(), srcFolder);
                metadataFiles.loadComponents(normalizedPath);
            }
            if (!this.profileList || this.profileList.length === 0) {
                this.profileList = METADATA_INFO.Profile.files;
            } else {
                this.profileList = this.profileList.map((profilename) => {
                    const foundFile = METADATA_INFO.Profile.files.find((file) => {
                        const apiName = MetadataFiles.getFullApiName(file);
                        return apiName === profilename;
                    });
                    if (!foundFile) {
                        SFPLogger.log('No profile found with name  ' + profilename, LoggerLevel.INFO);
                    }
                    return foundFile;
                });

                this.profileList = this.profileList.filter((file) => {
                    return file !== undefined;
                });
            }

            if (!this.profileList || this.profileList.length === 0) {
                SFPLogger.log('No profile to process ', LoggerLevel.INFO);
                return null;
            }

            if (!this.outputFolder) {
                this.outputFolder = path.dirname(this.profileList[0]);
            }

            const profilesMap = [];

            // const progressBar: ProgressBar = new ProgressBar();
            SFPLogger.log(`Reading ${this.profileList.length} Profiles from File System `, LoggerLevel.INFO);

            // progressBar.start(this.profileList.length);

            for (let i = 0; i < this.profileList.length; i++) {
                const profilepath = this.profileList[i];
                SFPLogger.log('Reading profile from path ' + profilepath, LoggerLevel.DEBUG);
                const profileXml = fs.readFileSync(profilepath);
                const profileName = path.basename(profilepath, METADATA_INFO.Profile.sourceExtension);
                profilesMap.push({
                    [profileName]: profileXml.toString(),
                });
                // progressBar.increment(1);

                SFPLogger.log(`Profile ${profileName} read (${profilesMap.length} of ${this.profileList.length})`, LoggerLevel.TRACE);
            }
            profileSource = new Promise((resolve, _reject) => {
                resolve(profilesMap);
            });
            // progressBar.stop();
            SFPLogger.log(`Finished reading profiles from filesystem`);
        }

        if (!fs.existsSync(this.outputFolder)) {
            SFPLogger.log('Creattin output diff ' + this.outputFolder);
            FileUtils.mkDirByPathSync(this.outputFolder);
        }

        //REtrieve profiles from target
        return profileSource.then((profilesSourceMap) => {
            const profileNames = [];
            profilesSourceMap.forEach((profileXml) => {
                profileNames.push(...Object.keys(profileXml));
            });
            const targetConn = this.targetOrg.getConnection();
            let profileNamesPromise = retrieveMetadata([{ type: 'Profile', folder: null }], targetConn);
            const profileTarget = profileNamesPromise
                .then((targetProfileNames) => {
                    let profileToRetrieveinTarget = profileNames.filter((oneProfile) => {
                        return targetProfileNames.includes(oneProfile);
                    });
                    return this.retrieveProfiles(profileToRetrieveinTarget, this.targetOrg);
                })
                .catch((error) => {
                    console.log(error.message);
                    return [];
                });

            return profileTarget
                .then((profilesTargetMap) => {
                    // SFPLogger.log('Handling diff ', LoggerLevel.INFO);
                    SFPLogger.log(`Beginning diff of ${profilesSourceMap.length} profiles.`, LoggerLevel.INFO);


                    for (let i = 0; i < profilesSourceMap.length; i++) {
                        let sourceProfileXml = profilesSourceMap[i];
                        let sourceKeys = Object.keys(sourceProfileXml);
                        let sourceProfileName = sourceKeys[0];
                        let targetProfileXml = profilesTargetMap.find((targetProfile) => {
                            let targetKeys = Object.keys(targetProfile);
                            let targetProfileName = targetKeys[0];
                            return targetProfileName === sourceProfileName;
                        });
                        SFPLogger.log('Processing profile ' + sourceProfileName, LoggerLevel.DEBUG);
                        let sourceContent = sourceProfileXml[sourceProfileName];
                        let targetContent = '';
                        if (targetProfileXml) {
                            targetContent = targetProfileXml[sourceProfileName];
                        }
                        let filePath =
                            this.outputFolder + path.sep + sourceProfileName + METADATA_INFO.Profile.sourceExtension;
                        SFPLogger.log('Processing diff for profile ' + sourceProfileName, LoggerLevel.DEBUG);
                        this.processDiff(filePath, sourceContent, targetContent);
                        SFPLogger.log(`Processed profile ${i} of ${profilesSourceMap.length}`, LoggerLevel.INFO);
                    }
                    /*
          profilesSourceMap.forEach(sourceProfileXml => {

          });
          */
                    // progressBar.stop();
                    SFPLogger.log(`Completed diff of ${profilesSourceMap.length} profiles`, LoggerLevel.INFO);
                    return this.output;
                })
                .catch((error) => {
                    SFPLogger.log(error.message);
                });
        });
    }

    public async retrieveProfiles(profileNames: string[], retrieveOrg) {
        let i: number,
            j: number,
            chunk = 10,
            temparray: string[];
        let profileRetriever = new ProfileRetriever(retrieveOrg);
        let retrievePromises = [];
        let connection = retrieveOrg.getConnection();

        SFPLogger.log(
            `Retrieving ${profileNames.length} Profiles From ${connection.getUsername()}`,
            LoggerLevel.INFO
        );

        // progressBar.start(profileNames.length);

        for (i = 0, j = profileNames.length; i < j; i += chunk) {
            temparray = profileNames.slice(i, i + chunk);

            let metadataListPromise = profileRetriever.loadProfiles(temparray);
            retrievePromises.push(
                metadataListPromise
                    .then((metadataList) => {
                        let profileWriter = new ProfileWriter();
                        let profilesXmls = [];
                        for (let count = 0; count < metadataList.length; count++) {
                            //console.log(metadataList[count]);
                            let profileObj = metadataList[count] as Profile;

                            let profileXml = profileWriter.toXml(profileObj);
                            profilesXmls.push({
                                [profileObj.fullName]: profileXml,
                            });

                            SFPLogger.log(`Profile ${profileObj.fullName} retrieved (${profilesXmls.length} of ${profileNames.length})`, LoggerLevel.INFO);

                        }
                        return profilesXmls;
                    })
                    .catch((error) => {
                        console.error(error.message);
                        SFPLogger.log(`An error occurred when retrieving profiles. Details: ${error.message}`, LoggerLevel.ERROR);
                        return [];
                    })
            );
        }
        return Promise.all(retrievePromises)
            .then((metadataList) => {
                let profiles = [];
                metadataList.forEach((elem) => {
                    profiles.push(...elem);
                });
                SFPLogger.log(`Successfully retrieved ${profiles.length} profiles.`, LoggerLevel.INFO);
                return profiles;
            })
            .catch((error) => {
                SFPLogger.log(`An error occurred when retrieving profiles. Details: ${error.message}`, LoggerLevel.ERROR);
                return [];
            });
    }

    private processDiff(filePath, contentSource, contentTarget) {
        let lineEnd = '\n';

        let content = '';
        let changedLocaly = false;
        let changedRemote = false;
        let conflict = false;

        //Normalise line ending on windows
        let matcherLocal = contentSource.match(CRLF_REGEX);
        let matcherFetched = contentTarget.match(CRLF_REGEX);
        if (matcherLocal && !matcherFetched) {
            lineEnd = matcherLocal[0];
            contentTarget = contentTarget.split(LF_REGEX).join(lineEnd);
        }

        if (!contentSource.endsWith(lineEnd) && contentTarget.endsWith(lineEnd)) {
            contentTarget = contentTarget.substr(0, contentTarget.lastIndexOf(lineEnd));
        }

        if (contentSource.endsWith(lineEnd) && !contentTarget.endsWith(lineEnd)) {
            contentTarget = contentTarget + lineEnd;
        }

        SFPLogger.log('Running diff', LoggerLevel.DEBUG);
        //let diffResult = jsdiff.diffLines(contentSource, contentTarget);
        const diffResult = diff_lineMode(contentSource, contentTarget);
        SFPLogger.log('Diff run completed. Processing result', LoggerLevel.DEBUG);
        for (let i = 0; i < diffResult.length; i++) {
            let result = diffResult[i];
            let index = i;
            let originalArray = diffResult;

            let nextIndex = index + 1;
            let nextElem = undefined;
            if (originalArray.length >= nextIndex) {
                nextElem = originalArray[nextIndex];
            }
            let value = result[1];
            let status = result[0];

            if (status === -1) {
                if (!value.endsWith(lineEnd)) {
                    value = value + lineEnd;
                }
                if (nextElem !== undefined) {
                    if (nextElem[0] === 0) {
                        content =
                            content +
                            `<<<<<<< ${this.sourceLabel}:${filePath}\n${value}=======\n>>>>>>> ${this.targetLabel}:${filePath}\n`;
                        changedLocaly = true;
                    } else if (nextElem[0] === 1) {
                        content = content + `<<<<<<< ${this.sourceLabel}:${filePath}\n${value}=======\n`;
                        conflict = true;
                    }
                } else {
                    content =
                        content +
                        `<<<<<<< ${this.sourceLabel}:${filePath}\n${value}=======\n>>>>>>> ${this.targetLabel}:${filePath}\n`;
                    changedLocaly = true;
                }
            } else if (status === 1) {
                if (conflict) {
                    content = content + `${value}>>>>>>> ${this.targetLabel}:${filePath}\n`;
                    conflict = true;
                } else {
                    content =
                        content +
                        `<<<<<<< ${this.sourceLabel}:${filePath}\n=======\n${value}>>>>>>> ${this.targetLabel}:${filePath}\n`;
                    changedRemote = true;
                }
            } else {
                content = content + value;
            }
        }
        SFPLogger.log('Result processed', LoggerLevel.DEBUG);

        fs.writeFileSync(filePath, content);

        let status = 'No Change';
        if (conflict || (changedLocaly && changedRemote)) {
            status = 'Conflict';
        } else if (changedRemote) {
            status = 'Remote Change';
        } else if (changedLocaly) {
            status = 'Local Change';
        }

        let metaType = MetadataInfo.getMetadataName(filePath, false);
        let member = MetadataFiles.getMemberNameFromFilepath(filePath, metaType);
        if (conflict || changedLocaly || changedRemote) {
            this.output.push({
                status: status,
                metadataType: metaType,
                componentName: member,
                path: filePath,
            });
        }
    }
}
