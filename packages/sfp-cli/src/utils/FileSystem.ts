import fs = require('fs');
import path = require('path');

export default class FileSystem {
    static readdirRecursive(directory: string): string[] {
        const result: string[] = [];

        if (!fs.lstatSync(directory).isDirectory()) throw new Error(`${directory} is not a directory`);

        (function readdirRecursiveHandler(directory: string): void {
            const files: string[] = fs.readdirSync(directory);

            files.forEach((file) => {
                let filepath = path.join(directory, file);
                if (fs.lstatSync(filepath).isDirectory()) readdirRecursiveHandler(filepath);
                else result.push(filepath);
            });
        })(directory);

        return result;
    }
}
