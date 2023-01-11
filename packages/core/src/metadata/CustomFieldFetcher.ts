import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import SFPOrg from '../org/SFPOrg';
const fs = require('fs-extra');
import { XMLParser } from 'fast-xml-parser';
import MetadataFetcher from './MetadataFetcher';
import {
    ComponentSet,
    MetadataConverter,
    MetadataResolver,
    ZipTreeContainer,
} from '@salesforce/source-deploy-retrieve';
import path from 'path';
import { makeRandomId } from '../utils/RandomId';

export default class CustomFieldFetcher extends MetadataFetcher {
    constructor(logger: Logger) {
        super(logger);
    }

    public async getCustomFields(org: SFPOrg, fields: string[]) {
        SFPLogger.log(`Fetching Custom Fields from Org`, LoggerLevel.INFO, this.logger);
        let retriveLocation = await this.fetchPackageFromOrg(org, {
            types: { name: 'CustomField', members: fields.length > 1 ? fields : fields[0] },
        });

        const zipTree = await ZipTreeContainer.create(fs.readFileSync(retriveLocation.zipLocation));
        const zipResolver = new MetadataResolver(undefined, zipTree);
        const zipComponents = zipResolver.getComponentsFromPath('.');
        let packageName = makeRandomId(6);
        await new MetadataConverter().convert(zipComponents, 'source', {
            type: 'directory',
            outputDirectory: path.join(retriveLocation.unzippedLocation, 'source'),
            packageName: packageName
        });

        //Write a force ignore file as its required for component set resolution
        fs.writeFileSync(path.resolve(retriveLocation.unzippedLocation, 'source', '.forceignore'), '# .forceignore v2');

        let sourceBackedComponents = ComponentSet.fromSource(path.resolve(retriveLocation.unzippedLocation, 'source'));

        return {components:sourceBackedComponents,location:path.join(retriveLocation.unzippedLocation, 'source',packageName)}
    }

  
}
