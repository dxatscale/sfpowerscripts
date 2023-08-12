import fs from 'fs';
import { PROCESSNAME, PrepareFile, Poolinfo, OrgInfo, ExternalDependency, PoolDefinition, PrepareHookSchema } from './types';
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
            events: [],
        };
        PrepareLoggerBuilder.getInstance().buildPoolinfo(poolInfo);
    }

    public static buildPoolError(success: number, failed: number, message: string, errorCode: string): void {
        PrepareLoggerBuilder.getInstance().buildPoolError(success, failed, message, errorCode).build();
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

    public static startServer(): void {
        EventService.getInstance();
    }

    public static closeServer(): void {
        const file = PrepareLoggerBuilder.getInstance().build();
        HookService.getInstance().logEvent(file);
        EventService.getInstance().closeServer();
    }
}

class PrepareLoggerBuilder {
    private file: PrepareHookSchema;
    private static instance: PrepareLoggerBuilder;

    private constructor() {
        this.file = {payload: {
            processName: PROCESSNAME.PREPARE,
            success: 0,
            failed: 0,
            status: 'inprogress',
            message: '',
            errorCode: '',
            poolDefinition: {tag: '', maxAllocation: 0},
            poolInfo: { activeOrgs: 0, maxOrgs: 0, prepareDuration: 0, events: [] },
            externalDependencies: []
        },
        eventId: process.env.EVENT_STREAM_WEBHOOK_EVENTID,
        eventType: 'sfpowerscripts.prepare'
        };
    }

    public static getInstance(): PrepareLoggerBuilder {
        if (!PrepareLoggerBuilder.instance) {
            PrepareLoggerBuilder.instance = new PrepareLoggerBuilder();
        }

        return PrepareLoggerBuilder.instance;
    }

    buildPoolError(success: number, failed: number, message: string, errorCode: string): PrepareLoggerBuilder {
        this.file.payload.success = success;
        this.file.payload.failed = failed;
        this.file.payload.status = 'failed';
        this.file.payload.message = message;
        this.file.payload.errorCode = errorCode;
        return this;
    }

    buildPoolDefinition(poolDefinition: PoolDefinition): PrepareLoggerBuilder {
        this.file.payload.poolDefinition = poolDefinition;
        return this; 
    }

    buildPoolinfo(poolInfo: Poolinfo): PrepareLoggerBuilder {
        this.file.payload.poolInfo = poolInfo;
        return this;
    }

    buildOrgInfo(index: number, orgInfo: OrgInfo): PrepareLoggerBuilder {
        this.file.payload.poolInfo.events[index] = {
            event: orgInfo.status === 'failed' ? 'sfpowerscripts.prepare.failed' : 'sfpowerscripts.prepare.success',
            context: {
                command: 'sfpowerscripts:orchestrator:prepare',
                eventId: process.env.EVENT_STREAM_WEBHOOK_EVENTID,
                instanceUrl: '',
                timestamp: new Date(),
                jobId: '',
            },
            metadata: orgInfo,
            orgId: ''
        }
        EventService.getInstance().logEvent(this.file.payload.poolInfo.events[index]);
        return this;
    }

    buildExternalDependencies(externalDependency: ExternalDependency): PrepareLoggerBuilder {
        this.file.payload.externalDependencies.push(externalDependency);
        return this;
    }

    buildReleaseConfig(releaseConfig: string[]): PrepareLoggerBuilder {
        this.file.payload.releaseConfig = releaseConfig;
        return this;
    }

    build(): PrepareHookSchema {
        return this.file;
    }
}
