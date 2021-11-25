import { Connection } from "@salesforce/core";
const sfdcSoup = require("sfdc-soup");
import { component2entrypoint } from "./Entrypoint";
import Component from "./Component";
import DependencyViolation from "./DependencyViolation";
import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import PackageManifest from "../package/PackageManifest";
import ProjectConfig from "../project/ProjectConfig";
import * as fs from "fs-extra";
import SFPLogger, { LoggerLevel } from "../logger/SFPLogger";

const REGISTRY_SUPPORTED_TYPES = Object.values(registry.types).map(type => type.name);

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
      let dependencyResponse;
      try {
        dependencyResponse = await soupApi.getDependencies();
      } catch (error) {
        SFPLogger.log(error.message, LoggerLevel.DEBUG);
      }

      const componentsDependentOnEntrypoint = [];
      const entrypointKey = Object.keys(dependencyResponse.dependencyTree)[0];
      for (let cmps of Object.values<any>(dependencyResponse.dependencyTree[entrypointKey]?.references ?? [])) {
        // flatten usage tree
        cmps.forEach(cmp => {
          if (REGISTRY_SUPPORTED_TYPES.includes(cmp.type)) {
            // add component if it is a supported type in the registry json
            const pattern = new RegExp(`:::${cmp.id}$`);
            cmp.name = cmp.name.replace(pattern, ""); // strip id from api name

            componentsDependentOnEntrypoint.push(cmp);
          }
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

        let componentSet: ComponentSet = await ComponentSet.fromManifest(
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
        });


        // search for violations
        const component = this.components.find(cmp => cmp.fullName === entrypoint.name && cmp.type === entrypoint.type);

        componentsDependentOnEntrypoint.forEach(cmp => {
          if (component.indexOfPackage < cmp.indexOfPackage) {
            violations.push({
              component: component,
              dependency: cmp,
              description: `Invalid Dependency: ${component.fullName} is dependent on ${cmp.name} found in ${cmp.package}`
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