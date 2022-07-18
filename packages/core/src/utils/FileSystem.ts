import fs = require('fs-extra');
import path = require('path');

export default class FileSystem {
    /**
     * List nested files within a directory
     * @param directory
     * @param includeDirectories
     * @returns
     */
    static readdirRecursive(
        searchDirectory: string,
        includeDirectories: boolean = false,
        isAbsolute: boolean = false
    ): string[] {
        const result: string[] = [];

        if (!fs.lstatSync(searchDirectory).isDirectory()) throw new Error(`${searchDirectory} is not a directory`);

        (function readdirRecursiveHandler(directory: string): void {
            const files: string[] = fs.readdirSync(directory);

            files.forEach((file) => {
                let filepath: string;
                if (isAbsolute) {
                    filepath = path.resolve(directory, file);
                } else {
                    filepath = path.join(directory, file);
                }

                if (fs.lstatSync(filepath).isDirectory()) {
                    if (includeDirectories) {
                        if (isAbsolute) {
                            result.push(path.resolve(filepath));
                        } else {
                            result.push(path.relative(searchDirectory, filepath));
                        }
                    }
                    readdirRecursiveHandler(filepath);
                } else {
                    if (isAbsolute) {
                        result.push(path.resolve(filepath));
                    } else {
                        result.push(path.relative(searchDirectory, filepath));
                    }
                }
            });
        })(searchDirectory);

        return result;
    }
}
