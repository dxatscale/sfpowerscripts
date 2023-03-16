import SFPLogger, { LoggerLevel } from '@dxatscale/sfp-logger';
import * as fs from 'fs-extra';
import Profile from '@impl/metadata/schema';
import * as _ from 'lodash';
import ProfileActions, { ProfileStatus, ProfileSourceFile } from './profileActions';
import ProfileWriter from '@impl/metadata/writer/profileWriter';
import MetadataRetriever from '@impl/metadata/retriever/metadataRetriever';
import { registry } from '@salesforce/source-deploy-retrieve';
import * as path from 'path';
import { Logger } from '@salesforce/core';

export default class ProfileSync extends ProfileActions {
    public async sync(srcFolders: string[], profilesToSync?: string[], isdelete?: boolean): Promise<ProfileStatus> {
        SFPLogger.log('Retrieving profiles', LoggerLevel.DEBUG);

        //Display provided profiles if any
        if (!_.isNil(profilesToSync) && profilesToSync.length !== 0) {
            SFPLogger.log('Requested  profiles are..', LoggerLevel.DEBUG);
            profilesToSync.forEach((element) => {
                SFPLogger.log(element, LoggerLevel.DEBUG);
            });
        }

        //Fetch all profiles if source folders if not provided
        const isToFetchNewProfiles = _.isNil(srcFolders) || srcFolders.length === 0;

        SFPLogger.log('Source Folders are', LoggerLevel.DEBUG);
        srcFolders.forEach((element) => {
            SFPLogger.log(element, LoggerLevel.DEBUG);
        });

        //get local profiles when profile path is provided
        const profilesInProjectDir = await this.loadProfileFromPackageDirectories(srcFolders);

        //If dont fetch add those to profilesToSync
        if (!isToFetchNewProfiles && profilesToSync.length < 1) {
            profilesInProjectDir.forEach((element) => {
                profilesToSync.push(element.name);
            });
        }

        //Grab status of the profiles (Add, Update or Delete)
        const profileStatus = await this.getRemoteProfilesWithLocalStatus(profilesToSync, srcFolders);

        let profilesToRetrieve: ProfileSourceFile[] = [];
        if (isToFetchNewProfiles) {
            //Retriving local profiles and anything extra found in the org
            profilesToRetrieve = _.union(profileStatus.added, profileStatus.updated);
        } else {
            //Retriving only local profiles
            profilesToRetrieve = profileStatus.updated;
            profileStatus.added = [];
        }
        profilesToRetrieve.sort((a, b) => a.name.localeCompare(b.name));
        SFPLogger.log(`Number of profiles to retrieve ${profilesToRetrieve.length}`, LoggerLevel.INFO);

        if (profilesToRetrieve.length > 0) {
            let i: number,
            j: number;
            const chunk = 10;
            let profilesToRetrieveChunked: ProfileSourceFile[] = [];


            SFPLogger.log(`Beginning retrieval of ${profilesToRetrieve} profiles.`, LoggerLevel.DEBUG);
            for (i = 0, j = profilesToRetrieve.length; i < j; i += chunk) {
                const chunkSize = (j - i > chunk ? chunk : j - i);
                SFPLogger.log(`Reconciling ${chunkSize}`, LoggerLevel.DEBUG);
                //slice profilesToRetrieve in chunk
                profilesToRetrieveChunked = profilesToRetrieve.slice(i, i + chunk);
                const remoteProfiles = await this.profileRetriever.loadProfiles(
                    _.uniq(
                        profilesToRetrieveChunked.map((elem) => {
                            return elem.name;
                        })
                    )
                );

                const profileWriter = new ProfileWriter();
                for (let count = 0; count < remoteProfiles.length; count++) {
                    const profileObj = remoteProfiles[count] as Profile;
                    SFPLogger.log(`Reconciling profile ${profileObj.fullName} (${i + count} of ${profilesToRetrieve})`, LoggerLevel.DEBUG);
                    SFPLogger.log('Reconciling Tabs', LoggerLevel.DEBUG);
                    await this.reconcileTabs(profileObj);
                    //Find correct profile path, so that remote could be overlaid
                    const indices = _.keys(_.pickBy(profilesToRetrieveChunked, { name: profileObj.fullName }));
                    for (const index of indices) {
                        const filePath = profilesToRetrieveChunked[index].path;
                        if (filePath) {
                            profileWriter.writeProfile(
                                profileObj,
                                path.join(process.cwd(), profilesToRetrieveChunked[index].path)
                            );
                        } else {
                            SFPLogger.log('File path not found...', LoggerLevel.DEBUG);
                        }
                    }
                }
            }
            // progressBar.stop();
            SFPLogger.log('Profile retrieval completed.')
        } else {
            SFPLogger.log(`No Profiles found to retrieve`, LoggerLevel.INFO);
        }

        if (profileStatus.deleted && isdelete) {
            profileStatus.deleted.forEach((profile) => {
                if (fs.existsSync(path.join(process.cwd(), profile.path))) {
                    fs.unlinkSync(path.join(process.cwd(), profile.path));
                }
            });
        }
        //Return final status
        return profileStatus;
    }
}
