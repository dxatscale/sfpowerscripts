import fs = require("fs");
import path = require("path");

export default class FileSystem {

  /**
   * Lists files in directory and sub-directories
   * @param directory
   * @param includeDirectories
   * @returns
   */
  static readdirRecursive(directory: string, includeDirectories: boolean = false, isAbsolute: boolean = false): string[] {
    const result: string[] = [];

    if (!fs.lstatSync(directory).isDirectory())
      throw new Error(`${directory} is not a directory`);

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
          if (includeDirectories) result.push(filepath);
          readdirRecursiveHandler(filepath);
        }
        else {
          result.push(filepath);
        }
      });
    })(directory);

    return result;
  }
}
