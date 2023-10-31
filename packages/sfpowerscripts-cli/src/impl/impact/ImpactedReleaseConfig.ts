import * as fs from 'fs-extra';
const yaml = require('js-yaml');
import path from 'path';

export default class ImpactedRelaseConfigResolver {

    public getImpactedReleaseConfigs(impactedPackages, configDir, filterBy?: string) {
        const impactedReleaseDefs = [];

        fs.readdirSync(configDir).forEach((file) => {
            const filePath = path.join(configDir, file);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const releaseConfig = yaml.load(fileContent);

            if (releaseConfig.releaseName) {
                let releaseImpactedPackages = [];
                //Its a releasedefn,
                if (releaseConfig.includeOnlyArtifacts) {
                    releaseImpactedPackages = releaseConfig.includeOnlyArtifacts.filter((artifact) =>
                        impactedPackages.includes(artifact)
                    );
                } else if (releaseConfig.excludeArtifacts) {
                    releaseImpactedPackages = impactedPackages.filter(
                        (artifact) => !releaseConfig.excludeArtifacts.includes(artifact)
                    );
                }

                if (releaseImpactedPackages.length > 0) {
                    if (filterBy) {
                        if (releaseConfig.releaseName.includes(filterBy)) {
                            impactedReleaseDefs.push({
                                releaseName: releaseConfig.releaseName,
                                pool: releaseConfig.pool
                                    ? releaseConfig.pool
                                    : releaseConfig.releaseName,
                                filePath: filePath,
                                impactedPackages: releaseImpactedPackages, // Including the impacted packages
                            });
                        }
                    } else {
                        impactedReleaseDefs.push({
                            releaseName: releaseConfig.releaseName,
                            pool: releaseConfig.pool
                                ? releaseConfig.pool
                                : releaseConfig.releaseName,
                            filePath: filePath,
                            impactedPackages: releaseImpactedPackages, // Including the impacted packages
                        });
                    }
                }
            }
        });

        const sortedImpactedReleaseDefs = impactedReleaseDefs.sort((a, b) => {
            if (!a.impactedPackages.length && !b.impactedPackages.length) return 0;
            if (!a.impactedPackages.length) return 1; // Move releases with no impacted packages to the end
            if (!b.impactedPackages.length) return -1; // Same as above

            const indexA = impactedPackages.indexOf(a.impactedPackages[0]);
            const indexB = impactedPackages.indexOf(b.impactedPackages[0]);

            if (indexA === -1 && indexB === -1) return 0; // Neither package is in impactedPackages
            if (indexA === -1) return 1; // Move releases with unknown impacted packages to the end
            if (indexB === -1) return -1; // Same as above

            return indexA - indexB; // Sort based on index in impactedPackages
        });

        const output = {
            include: sortedImpactedReleaseDefs,
        };
        return output;
    }
}
