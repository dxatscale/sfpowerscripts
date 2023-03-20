import BuildImpl, { BuildProps } from '../../../impl/parallelBuilder/BuildImpl';
import { Stage } from '../../../impl/Stage';
import BuildBase from '../../../BuildBase';
import { Messages } from '@salesforce/core';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'build');

export default class Build extends BuildBase {
    public static description = messages.getMessage('commandDescription');

    getStage() {
        return Stage.BUILD;
    }

    getBuildProps(): BuildProps {
        let buildProps: BuildProps = {
            configFilePath: this.flags.configfilepath,
            devhubAlias: this.flags.devhubalias,
            repourl: this.flags.repourl,
            waitTime: this.flags.waittime,
            isQuickBuild: false,
            isDiffCheckEnabled: this.flags.diffcheck,
            buildNumber: this.flags.buildnumber,
            executorcount: this.flags.executorcount,
            branch: this.flags.branch,
            currentStage: Stage.BUILD,
            isBuildAllAsSourcePackages: false,
            diffOptions: {
                useLatestGitTags: true,
                skipPackageDescriptorChange: false,
            },
        };
        return buildProps;
    }

    getBuildImplementer(buildProps: BuildProps): BuildImpl {
        let buildImpl = new BuildImpl(buildProps);
        return buildImpl;
    }
}
