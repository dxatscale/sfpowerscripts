import { Connection } from "@salesforce/core";
import Component from "./Component";
import DependencyViolation from "./DependencyViolation";
import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import PackageManifest from "../package/PackageManifest";
import ProjectConfig from "../project/ProjectConfig";
import * as fs from "fs-extra";
import InstalledPackagesFetcher from "../package/packageQuery/InstalledPackagesFetcher";
import DependencyFetcher from "./DependencyFetcher";

const REGISTRY_SUPPORTED_TYPES = Object.values(registry.types).map(type => type.name);

export default class DependencyAnalysis {
  constructor(
    private conn: Connection,
    private components: Component[],
  ) {}

  async exec(): Promise<DependencyViolation[]> {
    const violations: DependencyViolation[] = [];

    const projectConfig = ProjectConfig.getSFDXPackageManifest(null);

    const managedPackages = await new InstalledPackagesFetcher(this.conn).fetchManagedPackages();
    const managedPackageNamespaces = managedPackages.map(pkg => pkg.namespacePrefix);

    const componentsWithDependencies = await new DependencyFetcher(this.conn, this.components).fetch();
    for (const component of componentsWithDependencies) {

      component.dependencies = component.dependencies.filter(dependency => {
        const isComponentInManagedPackage = managedPackageNamespaces.find(namespace => namespace === dependency.namespace ) ? true : false;
        // components belonging to managed package cannot be dependency violations
        // component type must be in registry otherwise ComponentSet will fail
        return REGISTRY_SUPPORTED_TYPES.includes(dependency.type) && !isComponentInManagedPackage;
      });


      if (component.dependencies.length > 0) {
        const cmps = component.dependencies.map(cmp => {
          return {
            fullName: cmp.fullName,
            type: cmp.type
          }
        });

        // Generate manifest
        const packageManifest = PackageManifest.createFromScratch(
          cmps,
          "50.0"
        );

        fs.writeFileSync(`.sfpowerscripts/package.xml`, packageManifest.manifestXml);

        const componentSet: ComponentSet = await ComponentSet.fromManifest(
          {
            manifestPath: '.sfpowerscripts/package.xml',
            resolveSourcePaths: projectConfig.packageDirectories.map(pkg => pkg.path)
          }
        );


        component.dependencies.forEach(cmp => {
          const componentFilenames = componentSet.getComponentFilenamesByNameAndType({fullName: cmp.fullName, type: cmp.type});

          cmp.files = componentFilenames;

          // Determine package
          const indexOfPackage = projectConfig.packageDirectories.findIndex(pkg =>
            componentFilenames.find(file => file.includes(pkg.path))
          );

          cmp.indexOfPackage = indexOfPackage;
          cmp.package = projectConfig.packageDirectories[indexOfPackage]?.package;
        });

        // Filter out non-source-backed components
        const sourceBackedDependencies  = component.dependencies.filter(cmp => cmp.files.length > 0);

        // search for violations

        sourceBackedDependencies.forEach(cmp => {
          if (component.indexOfPackage < cmp.indexOfPackage) {
            violations.push({
              component: component,
              dependency: cmp,
              description: `Invalid Dependency: ${component.fullName} is dependent on ${cmp.fullName} found in ${cmp.package}`
            });
          }
        })
      } else {
        // entrypoint has no dependencies
        continue;
      }
    }

    return violations;
  }
}