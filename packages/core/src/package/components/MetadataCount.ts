const {
    glob
  } = require('glob')
import path from 'path';

export default class MetadataCount {
    public static async getMetadataCount(projectDirectory: string, sourceDirectory: string): Promise<number> {
        let metadataCount;
        try {
            let metadataFiles: string[] = await glob(`**/*-meta.xml`, {
                cwd: projectDirectory ? path.join(projectDirectory, sourceDirectory) : sourceDirectory,
                absolute: true,
            });
            metadataCount = metadataFiles.length;
        } catch (error) {
            metadataCount = -1;
        }
        return metadataCount;
    }
}
