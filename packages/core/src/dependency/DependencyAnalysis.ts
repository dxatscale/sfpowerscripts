import { Connection } from "@salesforce/core";
const sfdcSoup = require("sfdc-soup");
import { component2entrypoint } from "./Entrypoint";
import Component from "./Component";
import DependencyViolation from "./DependencyViolation";
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import PackageManifest from "../package/PackageManifest";
import ProjectConfig from "../project/ProjectConfig";
import * as fs from "fs-extra";

export default class DependencyAnalysis {
  constructor(
    private conn: Connection,
    private components: Component[]
  ) {}

  async exec(): Promise<DependencyViolation[]> {
    const violations: DependencyViolation[] = [];

    const soupApiConnection = {
      token: this.conn.accessToken,
      url: this.conn.instanceUrl,
      apiVersion: '50.0'
    };

    const projectConfig = ProjectConfig.getSFDXPackageManifest(null);

    const entrypoints = component2entrypoint(this.components);
    for (const entrypoint of entrypoints) {
      const soupApi = sfdcSoup(soupApiConnection, entrypoint);
      let usageResponse;
      try {
        usageResponse = await soupApi.getUsage();
      } catch (error) {
        console.log(error.message);
      }

      const componentsDependentOnEntrypoint = [];
      for (let cmps of Object.values<any>(usageResponse.usageTree)) {
        // flatten usage tree
        cmps.forEach(cmp => {
          componentsDependentOnEntrypoint.push(cmp);
        });
      }

      if (componentsDependentOnEntrypoint.length > 0) {
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

        let componentSet: ComponentSet;
        try {
          componentSet = await ComponentSet.fromManifest(
            {
              manifestPath: '.sfpowerscripts/package.xml',
              resolveSourcePaths: projectConfig.packageDirectories.map(pkg => pkg.path)
            }
          );
        } catch (err) {
          console.log(err.message);
          continue;
        }



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

        // search for violations
        const component = this.components.find(cmp => cmp.fullName === entrypoint.name && cmp.type === entrypoint.type);

        componentsDependentOnEntrypoint.forEach(cmp => {
          if (cmp.indexOfPackage < component.indexOfPackage) {
            violations.push({
              package: cmp.package,
              indexOfPackage: cmp.indexOfPackage,
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

    return violations;
  }
}