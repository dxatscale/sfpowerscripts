import { ComponentSet, MetadataConverter } from '@salesforce/source-deploy-retrieve';
import path from 'path';
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';

export default class SourceToMDAPIConvertor {
    public constructor(
        private projectDirectory: string,
        private sourceDirectory: string,
        private sourceApiVersion: string,
        private logger?: Logger
    ) {}

    public async convert() {
        let mdapiDir = `.sfpowerscripts/${this.makefolderid(5)}_mdapi`;
        //Create destination directory
        if (this.projectDirectory != null) mdapiDir = path.resolve(this.projectDirectory, mdapiDir);

        //Source Directory is nested inside project directory when used with artifacts
        //TODO: projectDirectory nomenclature is incorrect, should be parentDirectory perhaps?
        let resolvedSourceDirectory = this.sourceDirectory;
        if (this.projectDirectory != null)
            resolvedSourceDirectory = path.resolve(this.projectDirectory, this.sourceDirectory);

        //Build component set from provided source directory
        let componentSet = ComponentSet.fromSource({
            fsPaths: [resolvedSourceDirectory],
        });

        if (this.sourceApiVersion) componentSet.sourceApiVersion = this.sourceApiVersion;

        const converter = new MetadataConverter();
        let convertResult = await converter.convert(componentSet, 'metadata', {
            type: 'directory',
            outputDirectory: mdapiDir,
        });
        SFPLogger.log(`Source converted successfully to ${mdapiDir}`, LoggerLevel.TRACE, this.logger);
        SFPLogger.log(`ConvertResult:` + JSON.stringify(convertResult), LoggerLevel.TRACE, this.logger);

        return convertResult;
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
