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
import InstalledPackagesFetcher from "../package/packageQuery/InstalledPackagesFetcher";

const REGISTRY_SUPPORTED_TYPES = Object.values(registry.types).map(type => type.name);

export default class DependencyAnalysis {
  constructor(
    private conn: Connection,
    private components: Component[]
  ) {}

  async exec(): Promise<DependencyViolation[]> {
    const violations: DependencyViolation[] = [];

    // components belonging to managed package cannot be dependency violations
    const managedPackages = await new InstalledPackagesFetcher(this.conn).fetchManagedPackages();
    const managedPackageNamespaces = managedPackages.map(pkg => pkg.namespacePrefix);

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

      const dependenciesOfEntrypoint = [];
      const entrypointKey = Object.keys(dependencyResponse.dependencyTree)[0];
      for (let cmps of Object.values<any>(dependencyResponse.dependencyTree[entrypointKey]?.references ?? [])) {
        // flatten usage tree
        cmps.forEach(cmp => {
          const isComponentInManagedPackage = managedPackageNamespaces.find(namespace => cmp.name.startsWith(`${namespace}__`)) ? true : false;
          if (REGISTRY_SUPPORTED_TYPES.includes(cmp.type) && !isComponentInManagedPackage) {
            // add component if it is a supported type in the registry json
            const pattern = new RegExp(`:::${cmp.id}$`);
            cmp.name = cmp.name.replace(pattern, ""); // strip id from api name

            dependenciesOfEntrypoint.push(cmp);
          }
        });
      }

      if (dependenciesOfEntrypoint.length > 0) {
        const cmps = dependenciesOfEntrypoint.map(cmp => {
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


        dependenciesOfEntrypoint.forEach(cmp => {
          const componentFilenames = componentSet.getComponentFilenamesByNameAndType({fullName: cmp.name, type: cmp.type});

          cmp.files = componentFilenames;

          // Determine package
          const indexOfPackage = projectConfig.packageDirectories.findIndex(pkg =>
            componentFilenames.find(file => file.includes(pkg.path))
          );

          cmp.indexOfPackage = indexOfPackage;
          cmp.package = projectConfig.packageDirectories[indexOfPackage]?.package;
        });

        // Filter out non-source-backed components
        const sourceBackedDependencies  = dependenciesOfEntrypoint.filter(cmp => cmp.files.length > 0);

        // search for violations
        const component = this.components.find(cmp => cmp.fullName === entrypoint.name && cmp.type === entrypoint.type);

        sourceBackedDependencies.forEach(cmp => {
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