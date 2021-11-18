import { Connection } from "@salesforce/core";
const sfdcSoup = require("sfdc-soup");
import { Component, Entrypoint } from "./DependencyAnalysis";
import { ComponentSet, MetadataResolver } from '@salesforce/source-deploy-retrieve';
import PackageManifest from "@dxatscale/sfpowerscripts.core/lib/package/PackageManifest";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import * as fs from "fs-extra";
const Table = require("cli-table");
import SFPLogger from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";

export default class CyclicalDependencyAnalyzer {
  constructor(private entrypoints: Entrypoint[], private conn: Connection, private components: Component[]) {

  }

  async exec() {
    const violations: {
      package: string,
      indexOfPackage: number,
      files: string[],
      fullName: string
      type: string,
      dependency: Component,
      description: string
    }[] = [];

    let connection = {
      token: this.conn.accessToken,
      url: this.conn.instanceUrl,
      apiVersion: '50.0'
    };

    const projectConfig = ProjectConfig.getSFDXPackageManifest(null);

    for (const entrypoint of this.entrypoints) {
      console.log(entrypoint);
      let soupApi = sfdcSoup(connection, entrypoint);
      let usageResponse;
      try {
        usageResponse = await soupApi.getUsage();
      } catch (error) {
        console.log(error.message);
      }

      console.log(JSON.stringify(usageResponse, null, 4));

      const componentsDependentOnEntrypoint = [];
      for (let cmps of Object.values<any>(usageResponse.usageTree)) {
        cmps.forEach(cmp => {
          componentsDependentOnEntrypoint.push(cmp);
        });
      }

      if (componentsDependentOnEntrypoint.length > 0) {
        console.log("componentsDependentOnEntrypoint", componentsDependentOnEntrypoint);

        const cmps = componentsDependentOnEntrypoint.map(cmp => {
          return {
            fullName: cmp.name,
            type: cmp.type
          }
        });

        // Generate manifest
        const packageManifest = PackageManifest.createFromScratch(
          cmps,
          "50.0"
        );

        fs.writeFileSync(`.sfpowerscripts/package.xml`, packageManifest.manifestXml);

        const componentSet = await ComponentSet.fromManifest(
          {
            manifestPath: '.sfpowerscripts/package.xml',
            resolveSourcePaths: projectConfig.packageDirectories.map(pkg => pkg.path)
          }
        );


        componentsDependentOnEntrypoint.forEach(cmp => {
          const componentFilenames = componentSet.getComponentFilenamesByNameAndType({fullName: cmp.name, type: cmp.type});
          cmp.files = componentFilenames;

          // Determine package
          const indexOfPackage = projectConfig.packageDirectories.findIndex(pkg =>
            componentFilenames.find(file => file.includes(pkg.path))
          );

          cmp.indexOfPackage = indexOfPackage;
          cmp.package = projectConfig.packageDirectories[indexOfPackage].package;
        })

        // packages dependent on entrypoint
        console.log(JSON.stringify(componentsDependentOnEntrypoint, null, 4));

        // search for violations
        const component = this.components.find(cmp => cmp.fullName === entrypoint.name && cmp.type === entrypoint.type);

        componentsDependentOnEntrypoint.forEach(cmp => {
          if (cmp.indexOfPackage < component.indexOfPackage) {
            violations.push({
              package: cmp.package,
              indexOfPackage: cmp.indexOfPackagge,
              files: cmp.files,
              fullName: cmp.name,
              type: cmp.type,
              dependency: component,
              description: `Missing Dependency: ${cmp.name} is dependent on ${component.fullName}`
            });
          }
        })
      } else {
        continue;
      }
    }

    const table = new Table({
      head: ["API Name", "Type", "Package", "Files", "Problem"],
    });

    violations.forEach(violation => {
      table.push([violation.fullName, violation.type, violation.package, violation.files.toString(), violation.description]);
    })

    SFPLogger.log(table.toString());

  }
}