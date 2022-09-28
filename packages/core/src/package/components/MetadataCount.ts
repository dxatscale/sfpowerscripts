import glob from 'glob';
import path from 'path';

export default class MetadataCount {
    public static getMetadataCount(projectDirectory: string, sourceDirectory: string): number {
        let metadataCount;
        try {
            let metadataFiles: string[] = glob.sync(`**/*-meta.xml`, {
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
