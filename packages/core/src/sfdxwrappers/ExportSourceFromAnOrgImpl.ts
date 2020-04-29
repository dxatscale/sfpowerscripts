import child_process = require("child_process");

import { onExit } from "../OnExit";
import { extract } from "../Extract";

import path = require("path");
import fs = require("fs-extra");

export default class ExportSourceFromAnOrgImpl {
  public constructor(
    private target_org: string,
    private source_directory: string,
    private filter: string,
    private isManagedPackageToBeExclued: boolean,
    private isUnzipEnabled: boolean
  ) {}

  public async exec(): Promise<string> {
    //Create directory if not exists
    fs.ensureDirSync(this.source_directory);

    //Generate Package.xml
    let command = await this.buildManifestBuildCommand();
    let child = child_process.exec(command, { encoding: "utf8" });

    child.stdout.on("data", data => {
      console.log(data.toString());
    });
    child.stderr.on("data", data => {
      console.log(data.toString());
    });

    await onExit(child);

    //Retrive Package.xml
    command = await this.buildMDAPIRetrieveCommand();

    child = child_process.exec(command, { encoding: "utf8" });

    child.stdout.on("data", data => {
      console.log(data.toString());
    });
    child.stderr.on("data", data => {
      console.log(data.toString());
    });
    await onExit(child);

    //Unzip the downloaded unpackaged.zip
    if (this.isUnzipEnabled) {
      await extract(
        path.join(this.source_directory, "unpackaged.zip"),
        this.source_directory
      );
      fs.unlinkSync(path.join(this.source_directory, "unpackaged.zip"));

      fs.copySync(
        path.join(this.source_directory, "unpackaged"),
        this.source_directory,
        { overwrite: true }
      );

      fs.removeSync(path.join(this.source_directory, "unpackaged"));
      return this.source_directory;
    } else {
      return path.resolve(this.source_directory, "unpackaged.zip");
    }
  }

  private buildManifestBuildCommand(): string {
    let command = `npx sfdx sfpowerkit:org:manifest:build -u ${this.target_org}`;

    if (this.isManagedPackageToBeExclued) command += ` -x`;

    if (this.filter) command += ` -q ${this.filter}`;

    if (this.source_directory)
      command += ` -o ${path.join(this.source_directory, "package.xml")}`;

    console.log("Generated Command");
    console.log(command);

    return command;
  }

  private buildMDAPIRetrieveCommand(): string {
    let command = `sfdx force:mdapi:retrieve -u ${this.target_org}`;

    command += ` -k  ${path.join(this.source_directory, "package.xml")}`;

    command += ` -r  ${path.join(this.source_directory)}`;

    console.log("Generated Command");
    console.log(command);

    return command;
  }
}
