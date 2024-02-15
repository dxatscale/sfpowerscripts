import * as fs from 'fs-extra';
import { EOL } from 'os';
import path from 'path';

export default class FileOutputHandler {
  static instance: FileOutputHandler;

  public static getInstance() {
    if (!FileOutputHandler.instance)
      FileOutputHandler.instance = new FileOutputHandler('.sfpowerscripts/outputs');

    return FileOutputHandler.instance;
  }


  private constructor(private containerFolder: string) {
    fs.mkdirpSync(this.containerFolder);
  }

  public writeOutput(fileName: string, output: string ) {
    if (!fs.existsSync(path.join(this.containerFolder, fileName))) {
      fs.createFileSync(path.join(this.containerFolder, fileName));
    }
    fs.writeFileSync(path.join(this.containerFolder, fileName), output);
  };

  public appendOutput(fileName: string,output: string) {
    if (!fs.existsSync(path.join(this.containerFolder, fileName))) {
      fs.createFileSync(path.join(this.containerFolder, fileName));
    }
    fs.appendFileSync(path.join(this.containerFolder, fileName), EOL);
    fs.appendFileSync(path.join(this.containerFolder, fileName), output);
  }

  public deleteOutputFile(fileName: string) {
    if (fs.existsSync(path.join(this.containerFolder, fileName))) {
      fs.unlinkSync(path.join(this.containerFolder, fileName));
    }
  }

}