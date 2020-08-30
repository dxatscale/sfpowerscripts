import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import PackageDiffImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PackageDiffImpl';
import CreateSourcePackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateSourcePackageImpl";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PackageMetadata";
import { exec } from "shelljs";
const fs = require("fs-extra");
import {isNullOrUndefined} from "util"
const path = require("path");

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'create_source_package');

export default class CreateSourcePackage extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:CreateSourcePackage -n mypackage -v <version>`,
    `$ sfdx sfpowerscripts:CreateSourcePackage -n <mypackage> -v <version> --diffcheck --gittag`,
    `$ sfdx sfpowerscripts:CreateSourcePackage -n mypackage -v <version> --destructivemanifestfilepath=destructiveChanges.xml` +
    `--apextestsuite=<package>.testSuite-meta.xml\n`,
    `Output variable:`,
    `sfpowerscripts_artifact_metadata_directory`,
    `<refname>_sfpowerscripts_artifact_metadata_directory`,
    `sfpowerscripts_artifact_directory`,
    `<refname>_sfpowerscripts_artifact_directory`,
    `sfpowerscripts_package_version_number`,
    `<refname>_sfpowerscripts_package_version_number`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    package: flags.string({required: true, char: 'n', description: messages.getMessage('packageFlagDescription')}),
    versionnumber: flags.string({required: true, char: 'v', description: messages.getMessage('versionNumberFlagDescription')}),
    projectdir: flags.directory({char: 'd', description: messages.getMessage('projectDirectoryFlagDescription')}),
    apextestsuite: flags.filepath({description: messages.getMessage('apextestsuiteFlagDescription')}),
    destructivemanifestfilepath: flags.filepath({description: messages.getMessage('destructiveManiFestFilePathFlagDescription')}),
    artifactdir: flags.directory({description: messages.getMessage('artifactDirectoryFlagDescription'), default: 'artifacts'}),
    diffcheck: flags.boolean({description: messages.getMessage('diffCheckFlagDescription')}),
    gittag: flags.boolean({description: messages.getMessage('gitTagFlagDescription')}),
    repourl: flags.string({char: 'r', description: messages.getMessage('repoUrlFlagDescription')}),
    refname: flags.string({description: messages.getMessage('refNameFlagDescription')})
  };


  public async sfpowerscripts_run(){
    try {

      const sfdx_package: string = this.flags.package;
      const version_number: string = this.flags.versionnumber;
      const project_directory: string = this.flags.projectdir;
      const artifact_directory: string = this.flags.artifactdir;
      const refname: string = this.flags.refname;
      const destructiveManifestFilePath: string = this.flags.destructivemanifestfilepath;
      const apextestsuite: string=this.flags.apextestsuite;

      let runBuild: boolean;
      if (this.flags.diffcheck) {
        let packageDiffImpl = new PackageDiffImpl(sfdx_package, project_directory);

        runBuild = await packageDiffImpl.exec();

        if ( runBuild )
        console.log(`Detected changes to ${sfdx_package} package...proceeding\n`);
        else
        console.log(`No changes detected for ${sfdx_package} package...skipping\n`);

      } else runBuild = true;

      if (runBuild) {
        let commit_id = exec('git log --pretty=format:\'%H\' -n 1', {silent:true});

        let repository_url: string;
        if (isNullOrUndefined(this.flags.repourl)) {
          repository_url = exec('git config --get remote.origin.url', {silent:true});
          // Remove new line '\n' from end of url
          repository_url = repository_url.slice(0,repository_url.length - 1);
        } else repository_url = this.flags.repourl;



        let packageMetadata:PackageMetadata = {
          package_name: sfdx_package,
          package_version_number: version_number,
          sourceVersion: commit_id,
          repository_url:repository_url,
          package_type:"source",
          apextestsuite: apextestsuite,
        };

        //Convert to MDAPI
        let createSourcePackageImpl = new CreateSourcePackageImpl(
          project_directory,
          sfdx_package,
          destructiveManifestFilePath,
          packageMetadata
        );
        packageMetadata = await createSourcePackageImpl.exec();

        console.log(JSON.stringify(packageMetadata));

        if (packageMetadata.isApexFound && isNullOrUndefined(apextestsuite)) {
          this.ux.warn(
            "This package has apex classes/triggers and an apex test suite is not specified, You would not be able to deply to production if each class do not have coverage of 75% and above"
          );
        }


        let abs_artifact_directory: string;
        if (!isNullOrUndefined(project_directory)) {
            abs_artifact_directory = path.resolve(
              project_directory,
              artifact_directory
            );
        } else {
            abs_artifact_directory = path.resolve(artifact_directory);
        }


        let sfdx_package_artifact: string = path.join(
          abs_artifact_directory,
          `${sfdx_package}_artifact`
        );
        fs.mkdirpSync(sfdx_package_artifact);

        let sourcePackage: string = path.join(
          sfdx_package_artifact,
          `${sfdx_package}_sfpowerscripts_source_package`
        );
        fs.mkdirpSync(sourcePackage);
        fs.copySync(packageMetadata.sourceDir, sourcePackage);

        let artifactMetadataFilePath: string = path.join(
          sfdx_package_artifact,
          `${sfdx_package}_artifact_metadata`
        );

        fs.writeFileSync(
          artifactMetadataFilePath,
          JSON.stringify(packageMetadata)
        );

        console.log(`Created source package ${sfdx_package}_artifact`);

        if (this.flags.gittag) {
          exec(`git config --global user.email "sfpowerscripts@dxscale"`);
          exec(`git config --global user.name "sfpowerscripts"`);

          let tagname = `${sfdx_package}_v${version_number}`;
          console.log(`Creating tag ${tagname}`);
          exec(`git tag -a -m "${sfdx_package} Source Package ${version_number}" ${tagname} HEAD`, {silent:false});
        }

        console.log("\nOutput variables:");
        if (!isNullOrUndefined(refname)) {
          fs.writeFileSync('.env', `${refname}_sfpowerscripts_artifact_metadata_directory=${artifactMetadataFilePath}\n`, {flag:'a'});
          console.log(`${refname}_sfpowerscripts_artifact_metadata_directory=${artifactMetadataFilePath}`);
          fs.writeFileSync('.env', `${refname}_sfpowerscripts_artifact_directory=${sfdx_package_artifact}\n`, {flag:'a'});
          console.log(`${refname}_sfpowerscripts_artifact_directory=${sfdx_package_artifact}`);
          fs.writeFileSync('.env', `${refname}_sfpowerscripts_package_version_number=${version_number}\n`, {flag:'a'});
          console.log(`${refname}_sfpowerscripts_package_version_number=${version_number}`);
        } else {
          fs.writeFileSync('.env', `sfpowerscripts_artifact_metadata_directory=${artifactMetadataFilePath}\n`, {flag:'a'});
          console.log(`sfpowerscripts_artifact_metadata_directory=${artifactMetadataFilePath}`);
          fs.writeFileSync('.env', `sfpowerscripts_artifact_directory=${sfdx_package_artifact}\n`, {flag:'a'});
          console.log(`sfpowerscripts_artifact_directory=${sfdx_package_artifact}`);
          fs.writeFileSync('.env', `sfpowerscripts_package_version_number=${version_number}\n`, {flag:'a'});
          console.log(`sfpowerscripts_package_version_number=${version_number}`);
        }
      }
    } catch (err) {
      console.log(err);
      // Fail the task when an error occurs
      process.exit(1);
    }
  }
}
