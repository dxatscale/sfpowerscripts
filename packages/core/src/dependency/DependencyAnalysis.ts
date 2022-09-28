import Component from './Component';
import DependencyViolation from './DependencyViolation';
import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import PackageManifest from '../package/components/PackageManifest';
import ProjectConfig from '../project/ProjectConfig';
import * as fs from 'fs-extra';
import DependencyFetcher from './DependencyFetcher';
import SFPOrg from '../org/SFPOrg';
import { PackageType } from '../package/SfpPackage';

const REGISTRY_SUPPORTED_TYPES = Object.values(registry.types).map((type) => type.name);

export default class DependencyAnalysis {
    constructor(private org: SFPOrg, private components: Component[]) {}

    async exec(): Promise<DependencyViolation[]> {
        const violations: DependencyViolation[] = [];

        const projectConfig = ProjectConfig.getSFDXProjectConfig(null);

        const managedPackages = await this.org.getAllInstalledManagedPackages();
        const managedPackageNamespaces = managedPackages.map((pkg) => pkg.namespacePrefix);

        const componentsWithDependencies = await new DependencyFetcher(
            this.org.getConnection(),
            this.components
        ).fetch();
        for (const component of componentsWithDependencies) {
            component.dependencies = component.dependencies.filter((dependency) => {
                const isComponentInManagedPackage = managedPackageNamespaces.find(
                    (namespace) => namespace === dependency.namespace
                )
                    ? true
                    : false;
                // components belonging to managed package cannot be dependency violations
                // component type must be in registry otherwise ComponentSet will fail
                return REGISTRY_SUPPORTED_TYPES.includes(dependency.type) && !isComponentInManagedPackage;
            });

            if (component.dependencies.length > 0) {
                await this.populatePackageFieldsForDependencies(component.dependencies, projectConfig);

                // Filter out non-source-backed components
                const sourceBackedDependencies = component.dependencies.filter((cmp) => cmp.files.length > 0);

                // search for violations
                sourceBackedDependencies.forEach((cmp) => {
                    // check for misordered packages
                    if (component.indexOfPackage < cmp.indexOfPackage) {
                        violations.push({
                            component: component,
                            dependency: cmp,
                            description: `Invalid Dependency: ${component.fullName} is dependent on ${cmp.fullName} found in ${cmp.package}`,
                        });
                    }

                    // check for missing dependency for unlocked package
                    if (
                        component.packageType === PackageType.Unlocked &&
                        cmp.packageType === PackageType.Unlocked &&
                        component.package !== cmp.package
                    ) {
                        const isDependencyDefined = projectConfig.packageDirectories[
                            component.indexOfPackage
                        ].dependencies?.find((dependency) => {
                            const packageName: string = dependency.package.split('@')[0];
                            return packageName === cmp.package;
                        })
                            ? true
                            : false;

                        if (!isDependencyDefined) {
                            violations.push({
                                component: component,
                                dependency: cmp,
                                description: `Missing Dependency: ${component.package} unlocked package is dependent on ${cmp.package}`,
                            });
                        }
                    }
                });
            } else {
                // component has no dependencies
                continue;
            }
        }

        return violations;
    }

    /**
     * Determine the package that dependencies belong to and populate package fields
     * @param dependencies
     * @param projectConfig
     */
    private async populatePackageFieldsForDependencies(dependencies: Component[], projectConfig: any) {
        const cmps = dependencies.map((cmp) => {
            return {
                fullName: cmp.fullName,
                type: cmp.type,
            };
        });

        const packageManifest = PackageManifest.createFromScratch(cmps, '50.0');

        fs.writeFileSync(`.sfpowerscripts/package.xml`, packageManifest.manifestXml);

        const componentSet: ComponentSet = await ComponentSet.fromManifest({
            manifestPath: '.sfpowerscripts/package.xml',
            resolveSourcePaths: projectConfig.packageDirectories.map((pkg) => pkg.path),
        });

        dependencies.forEach((cmp) => {
            const componentFilenames = componentSet.getComponentFilenamesByNameAndType({
                fullName: cmp.fullName,
                type: cmp.type,
            });

            cmp.files = componentFilenames;

            const indexOfPackage = projectConfig.packageDirectories.findIndex((pkg) =>
                componentFilenames.find((file) => file.includes(pkg.path))
            );

            cmp.indexOfPackage = indexOfPackage;

            const packageName = projectConfig.packageDirectories[indexOfPackage]?.package;
            if (packageName) {
                cmp.package = packageName;
                cmp.packageType = ProjectConfig.getPackageType(projectConfig, packageName);
            }
        });
    }
}
