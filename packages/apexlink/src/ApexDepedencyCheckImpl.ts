import findJavaHome from 'find-java-home';
import ExecuteCommand from '@dxatscale/sfdx-process-wrapper/lib/commandExecutor/ExecuteCommand';
import { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import path from 'path';
import SFPLogger from '@dxatscale/sfp-logger';
import { ConsoleLogger } from '@dxatscale/sfp-logger';

const jarFile = path.join(__dirname,  '..', 'jars', 'apexlink-2.3.7.jar');
export default class ApexDepedencyCheckImpl {
    public constructor(private logger: Logger, private projectDirectory: string) {}

    public async execute() {

        let apexLinkProcessExecutor = new ExecuteCommand(this.logger, LoggerLevel.INFO, false);
        let generatedCommand =  await this.getGeneratedCommandWithParams();
        let result = await apexLinkProcessExecutor.execCommand(
           generatedCommand,
            process.cwd()
        );
        return JSON.parse(result);
    }

    private async getGeneratedCommandWithParams() {
        let javaHome = await this.getJavaHome();

        let command = `${path.join(javaHome, 'bin', 'java')}  -jar  ${jarFile} -depends  -json ${
            this.projectDirectory
        }`;
        return command;
    }

    /**
     *Finds java home
     *
     * @return the Java home path
     */
    private async getJavaHome(): Promise<string> {
        return new Promise<string>((resolve, reject): void => {
            findJavaHome({ allowJre: true }, (err, res) => {
                if (err) {
                    return reject(err);
                }
                SFPLogger.log(`Java HOME ${res}`,LoggerLevel.TRACE, new ConsoleLogger())
                resolve(res);
            });
        });
    }
}
