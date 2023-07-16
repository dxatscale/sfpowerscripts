import fs from 'fs';
import { PATH, PROCESSNAME, PrepareFile, Poolinfo, OrgInfo, ExternalDependency, PoolDefinition } from './types';
import { EventService } from './event';
import { HookService } from './hooks';

export class PrepareStreamService {
    public static buildPoolDefinition(poolDefinition: PoolDefinition): void {
        PrepareLoggerBuilder.getInstance().buildPoolDefinition(poolDefinition);
    }

    public static buildPoolInfo(activeOrgs: number, maxOrgs: number): void {
        const poolInfo: Poolinfo = {
            activeOrgs: activeOrgs,
            maxOrgs: maxOrgs,
            prepareDuration: 0,
            orgInfos: [],
        };
        PrepareLoggerBuilder.getInstance().buildPoolinfo(poolInfo);
    }

    public static buildPoolError(success: number, failed: number, message: string, errorCode: string): void {
        const file = PrepareLoggerBuilder.getInstance().buildPoolError(success, failed, message, errorCode).build();
        HookService.getInstance().logEvent(file);
    }

    public static buildExternalDependency(
        order: number,
        pck: string,
        version: string,
        subscriberVersionId: string
    ): void {
        PrepareLoggerBuilder.getInstance()
            .buildExternalDependencies({
                order: order,
                pck: pck,
                version: version,
                subscriberVersionId: subscriberVersionId,
            });
    }

    public static buildReleaseConfig(releaseConfig: string[]): void {
        PrepareLoggerBuilder.getInstance().buildReleaseConfig(releaseConfig)
    }

    public static buildOrgInfo(index: number, orgInfo: OrgInfo): void {
        PrepareLoggerBuilder.getInstance().buildOrgInfo(index, orgInfo);
    }

    public static closeServer(): void {
        EventService.getInstance().closeServer();
    }
}

class PrepareLoggerBuilder {
    private file: PrepareFile;
    private static instance: PrepareLoggerBuilder;

    private constructor() {
        this.file = {
            processName: PROCESSNAME.PREPARE,
            success: 0,
            failed: 0,
            status: 'inprogress',
            message: '',
            errorCode: '',
            poolDefinition: {tag: '', maxAllocation: 0},
            poolInfo: { activeOrgs: 0, maxOrgs: 0, prepareDuration: 0, orgInfos: [] },
            externalDependencies: []
        };
    }

    public static getInstance(): PrepareLoggerBuilder {
        if (!PrepareLoggerBuilder.instance) {
            PrepareLoggerBuilder.instance = new PrepareLoggerBuilder();
            // Create .sfpowerscripts folder if not exist
            if (!fs.existsSync(PATH.DEFAULT)) {
                fs.mkdirSync(PATH.DEFAULT);
            }
            if (!fs.existsSync(PATH.PREPARE)) {
                // File doesn't exist, create it
                fs.writeFileSync(PATH.PREPARE, JSON.stringify(PrepareLoggerBuilder.instance.file), 'utf-8');
            }
        }

        return PrepareLoggerBuilder.instance;
    }

    buildPoolError(success: number, failed: number, message: string, errorCode: string): PrepareLoggerBuilder {
        this.file.success = success;
        this.file.failed = failed;
        this.file.status = 'failed';
        this.file.message = message;
        this.file.errorCode = errorCode;
        return this;
    }

    buildPoolDefinition(poolDefinition: PoolDefinition): PrepareLoggerBuilder {
        this.file.poolDefinition = poolDefinition;
        return this; 
    }

    buildPoolinfo(poolInfo: Poolinfo): PrepareLoggerBuilder {
        this.file.poolInfo = poolInfo;
        return this;
    }

    buildOrgInfo(index: number, orgInfo: OrgInfo): PrepareLoggerBuilder {
        this.file.poolInfo.orgInfos[index] = orgInfo;
        EventService.getInstance().logEvent(this.file.poolInfo.orgInfos[index]);
        return this;
    }

    buildExternalDependencies(externalDependency: ExternalDependency): PrepareLoggerBuilder {
        this.file.externalDependencies.push(externalDependency);
        return this;
    }

    buildReleaseConfig(releaseConfig: string[]): PrepareLoggerBuilder {
        this.file.releaseConfig = releaseConfig;
        return this;
    }

    build(): PrepareFile {
        return this.file;
    }
}
