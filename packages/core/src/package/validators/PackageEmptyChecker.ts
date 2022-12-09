import path from 'path';
import { readFileSync, existsSync } from 'fs';
import FileSystem from '../../utils/FileSystem';
import ignore from 'ignore';

export default class PackageEmptyChecker {
    public static isToBreakBuildForEmptyDirectory(
        projectDir: string,
        sourceDirectory: string,
        isToBreakBuildIfEmpty: boolean
    ): {
        message: string;
        result: string;
    } {
        let directoryToCheck;
        let status: { message: string; result: string } = {
            message: '',
            result: '',
        };

        if (projectDir != null) {
            directoryToCheck = path.join(projectDir, sourceDirectory);
        } else directoryToCheck = sourceDirectory;

        try {
            if (!existsSync(directoryToCheck)) {
                //Folder do not exists, break build
                if (isToBreakBuildIfEmpty) {
                    status.message = `Folder not Found , Stopping build as isToBreakBuildIfEmpty is ${isToBreakBuildIfEmpty}`;
                    status.result = 'break';
                } else {
                    status.message = `Folder not Found , Skipping task as isToBreakBuildIfEmpty is ${isToBreakBuildIfEmpty}`;
                    status.result = 'skip';
                }
                return status;
            } else if (PackageEmptyChecker.isEmptyFolder(projectDir, sourceDirectory)) {
                if (isToBreakBuildIfEmpty) {
                    status.message = `Folder is Empty , Stopping build as isToBreakBuildIfEmpty is ${isToBreakBuildIfEmpty}`;
                    status.result = 'break';
                } else {
                    status.message = `Folder is Empty, Skipping task as isToBreakBuildIfEmpty is ${isToBreakBuildIfEmpty}`;
                    status.result = 'skip';
                }
                return status;
            } else {
                status.result = 'continue';
                return status;
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                throw new Error(`No such file or directory ${err.path}`); // Re-throw error if .forceignore does not exist
            } else if (!isToBreakBuildIfEmpty) {
                status.message = `Something wrong with the path provided ${directoryToCheck}, but skipping, The exception is ${err}`;
                status.result = 'skip';
                return status;
            } else throw err;
        }
    }

    public static isEmptyFolder(projectDirectory: string, sourceDirectory: string): boolean {
        let dirToCheck;

        if (projectDirectory != null) {
            dirToCheck = path.join(projectDirectory, sourceDirectory);
        } else {
            dirToCheck = sourceDirectory;
        }

        let files: string[] = FileSystem.readdirRecursive(dirToCheck, false, false);
        // Include source directory in filepaths, as it can be a pattern in forceignore
        files = files.map((file) => path.join(sourceDirectory, file));

        let forceignorePath;
        if (projectDirectory != null) forceignorePath = path.join(projectDirectory, '.forceignore');
        else forceignorePath = path.join(process.cwd(), '.forceignore');

        // Ignore files that are listed in .forceignore
        files = ignore()
            .add(readFileSync(forceignorePath).toString()) // Add ignore patterns from '.forceignore'.
            .filter(files);

        if (files == null || files.length === 0) return true;
        else return false;
    }
}
