import { ComponentSet, MetadataConverter, ConvertResult } from '@salesforce/source-deploy-retrieve';
import path = require('path');
import * as fs from 'fs-extra';
import inquirer = require('inquirer');
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import * as metadataRegistry from '../../metadataRegistry.json';

import SFPLogger, {
    COLOR_KEY_MESSAGE,
    COLOR_KEY_VALUE,
    COLOR_SUCCESS,
} from '@dxatscale/sfp-logger/lib/SFPLogger';

import CreatePackageWorkflow, { SFDXPackage } from '../package/CreatePackageWorkflow';
import SourcePull from '../../impl/sfdxwrappers/SourcePull';
import SelectPackageWorkflow from '../package/SelectPackageWorkflow';
import { isEmpty } from 'lodash';
import cli from 'cli-ux';
import CreateUnlockedPackage from '../../impl/sfdxwrappers/CreateUnlockedPackage';

export default class PullSourceWorkflow {
    private unlockedPackagesToBeCreated: Array<SFDXPackage>;
    public constructor(private devOrg: string, private sourceStatusResult: any, private devHub: string) {
        this.unlockedPackagesToBeCreated = [];
    }

    async execute(): Promise<void> {
        if (this.sourceStatusResult.length === 0) {
            SFPLogger.log(COLOR_SUCCESS('  No changes found'));
            return;
        }

        const remoteAdditions = this.sourceStatusResult.filter((elem) => {
            //We only have to ask for files that have -meta.xml, all else changes let cli auto merge when doing pull
            if (elem.state === 'Remote Add') {
                if (elem.parentFolder == null) return elem;
                else if (elem.parentFolder && elem.fullName.includes('-meta.xml')) return elem;
                else if (elem.parentFolder && (elem.fullName.includes('.cmp') || elem.fullName.includes('.evt')))
                    return elem;
            }
        });

        let folderMoveInstructions: {
            parentFolder: string;
            instruction: Instruction;
        }[] = [];

        SFPLogger.log(
            COLOR_KEY_MESSAGE(`  Found ${remoteAdditions.length} new metadata components, which require a new home`)
        );

        const projectConfig = ProjectConfig.getSFDXProjectConfig(null);
        const newPackagesDirectories: string[] = [];

        let mergePlan: Instruction[] = [];
        for (let remoteAddition of remoteAdditions) {
            let isToBeSkipped: boolean = false;
            const instruction: Instruction = {
                fullName: remoteAddition.fullName,
                type: remoteAddition.type,
                destination: [],
            };

            for (let folderMoveInstruction of folderMoveInstructions) {
                if (remoteAddition.parentFolder == folderMoveInstruction.parentFolder) {
                    instruction.destination = folderMoveInstruction.instruction.destination;
                    isToBeSkipped = true;
                    break;
                }
            }

            if (isToBeSkipped) {
                SFPLogger.log(`  Skipping ${remoteAddition.fullName} as instruction is already set`);
                mergePlan.push(instruction);
                continue;
            }

            let moveAction = await this.getMoveAction(instruction);

            if (moveAction === MoveAction.RECOMMENDED) {
                if (metadataRegistry.types[instruction.type].strategy === Strategy.PLUS_ONE) {
                    instruction.destination.push(...metadataRegistry.types[instruction.type].recommended);

                    const plusOneMoveAction = await this.getPlusOneMoveAction();
                    if (plusOneMoveAction === MoveAction.EXISTING) {
                        let existingPackage = await new SelectPackageWorkflow(projectConfig).pickAnExistingPackage();
                        instruction.destination.push({ package: existingPackage.path });
                    } else if (plusOneMoveAction === MoveAction.NEW) {
                        const newPackage = await new CreatePackageWorkflow(projectConfig).stageANewPackage();
                        this.addNewPackageToProjectConfig(
                            newPackage.descriptor,
                            newPackage.indexOfPackage,
                            projectConfig
                        );
                        newPackagesDirectories.push(newPackage.descriptor.path);
                        instruction.destination.push({
                            package: newPackage.descriptor.path,
                        });

                        //For Unlocked Push to array, others push  to type
                        if (newPackage.type === 'unlocked' || newPackage.type === 'org-unlocked')
                            this.unlockedPackagesToBeCreated.push(newPackage);
                        else newPackage.descriptor['type'] = newPackage.type;

                        newPackagesDirectories.push(newPackage.descriptor.path);
                    } else {
                        throw new Error(`Unrecognised MoveAction ${moveAction}`);
                    }
                } else if (metadataRegistry.types[instruction.type].strategy === Strategy.DUPLICATE) {
                    instruction.destination.push(...metadataRegistry.types[instruction.type].recommended);
                } else if (metadataRegistry.types[instruction.type].strategy === Strategy.SINGLE) {
                    const singleRecommendedPackage = await this.getSingleRecommendedPackage(
                        metadataRegistry.types[instruction.type].recommended
                    );
                    instruction.destination.push(
                        metadataRegistry.types[instruction.type].recommended.find(
                            (elem) => elem.package === singleRecommendedPackage
                        )
                    );
                } else if (metadataRegistry.types[instruction.type].strategy === Strategy.DELETE) {
                    // do nothing
                } else {
                    throw new Error('Strategy not defined or unknown');
                }
            } else if (moveAction === MoveAction.NEW) {
                const newPackage = await new CreatePackageWorkflow(projectConfig).stageANewPackage();
                this.addNewPackageToProjectConfig(newPackage.descriptor, newPackage.indexOfPackage, projectConfig);

                //For Unlocked Push to array, others push  to type
                if (newPackage.type === 'unlocked' || newPackage.type === 'org-unlocked')
                    this.unlockedPackagesToBeCreated.push(newPackage);
                else newPackage.descriptor['type'] = newPackage.type;

                newPackagesDirectories.push(newPackage.descriptor.path);

                instruction.destination.push({ package: newPackage.descriptor.path });
            } else if (moveAction === MoveAction.EXISTING) {
                let existingPackage = await new SelectPackageWorkflow(projectConfig).pickAnExistingPackage();
                instruction.destination.push({ package: existingPackage.path });
            } else if (moveAction === MoveAction.NOTHING) {
                continue;
            } else {
                throw new Error(`Unrecognised MoveAction ${moveAction}`);
            }
            mergePlan.push(instruction);
            if (remoteAddition.parentFolder) {
                folderMoveInstructions.push({
                    parentFolder: remoteAddition.parentFolder,
                    instruction,
                });
            }
            console.log();
            console.log();
        }

        newPackagesDirectories.forEach((dir) => fs.mkdirpSync(dir));
        this.writeProjectConfigToFile(projectConfig);

        cli.action.start(`  Pulling source components from dev org... ${COLOR_KEY_VALUE(this.devOrg)}..`);
        let pullResult = await new SourcePull(this.devOrg, true).exec(true);
        cli.action.stop();
        SFPLogger.log(COLOR_SUCCESS('  Successfully pulled source components'));

        cli.action.start('  Moving source components...');

        try {
            // rename .forceignore temporarily during merge, which prevents it from ignoring target directory of a merge
            fs.renameSync('.forceignore', '.forceignore.bak');

            for (let instruction of mergePlan) {
                let isDeleteComponents: boolean = true;

                let components = pullResult.pulledSource.filter((component) => {
                    //Handle Bundles
                    if (component.fullName.includes('/')) {
                        if (
                            component.fullName.split('/')[0] == instruction.fullName.split('/')[0] &&
                            component.type === instruction.type
                        )
                            return component;
                    } else if (
                        component.fullName === this.encodeData(instruction.fullName) &&
                        component.type === instruction.type
                    )
                        return component;
                });

                if (isEmpty(components)) continue;

                const converter = new MetadataConverter();

                let filePath = components.find((component) => path.extname(component.filePath) === '.xml')?.filePath;

                //We dont want non xml files to the merger
                if (filePath == null) continue;

                const componentSet = ComponentSet.fromSource(filePath);

                for (let dest of instruction.destination) {
                    let convertResult: ConvertResult;

                    if (dest.aliasfy) {
                        let files = fs.readdirSync(dest.package);
                        let aliases = files.filter((file) => {
                            let filepath = path.join(dest.package, file);
                            return fs.lstatSync(filepath).isDirectory();
                        });

                        for (let alias of aliases) {
                            convertResult = await converter.convert(componentSet, 'source', {
                                type: 'merge',
                                mergeWith: ComponentSet.fromSource(
                                    path.resolve(dest.package, alias)
                                ).getSourceComponents(),
                                defaultDirectory: path.join(dest.package, alias),
                                forceIgnoredPaths: componentSet.forceIgnoredPaths ?? new Set<string>(),
                            });
                        }
                    } else {
                        convertResult = await converter.convert(componentSet, 'source', {
                            type: 'merge',
                            mergeWith: ComponentSet.fromSource(path.resolve(dest.package)).getSourceComponents(),
                            defaultDirectory: dest.package,
                            forceIgnoredPaths: componentSet.forceIgnoredPaths ?? new Set<string>(),
                        });
                    }

                    let mergedXmlFilePath: string = convertResult.converted[0].xml;

                    if (this.isXmlFileSuffixDuped(convertResult.converted[0].xml)) {
                        mergedXmlFilePath = this.dedupeXmlFileSuffix(convertResult.converted[0].xml);
                    }

                    if (mergedXmlFilePath === filePath) {
                        // If the merged xml filepath and pulled xml filepath is the same, do not delete the original components
                        isDeleteComponents = false;
                    }
                }

                if (isDeleteComponents) {
                    for (let component of components) {
                        fs.unlinkSync(component.filePath);
                    }
                }

                //Clean up src-temp of empty directories
                this.removeEmptyDirectories('src-temp/main/default');
            }
        } finally {
            // restore .forceignore, after merge finishes
            fs.renameSync('.forceignore.bak', '.forceignore');
        }

        cli.action.stop();

        for (const unlockedPackage of this.unlockedPackagesToBeCreated) {
            cli.action.start(` Creating unlocked package ${unlockedPackage.descriptor.package}...`);
            await this.createNewPackage({
                type: unlockedPackage.type,
                description: unlockedPackage.description,
                name: unlockedPackage.descriptor.package,
                path: unlockedPackage.descriptor.path,
            });
            cli.action.stop();
        }
    }

    async createNewPackage(unlockedPackage: { type: string; description: string; path: string; name: string }) {
        try {
            let createUnlockedPackage = new CreateUnlockedPackage(this.devHub, unlockedPackage);
            await createUnlockedPackage.exec(true);
        } catch (error) {}
    }

    private isXmlFileSuffixDuped(xmlFile: string): boolean {
        return xmlFile.match(/-meta\.xml/g)?.length === 2;
    }

    private dedupeXmlFileSuffix(xmlFile: string): string {
        let deduped = xmlFile.replace(/-meta\.xml/, '');
        fs.renameSync(xmlFile, deduped);

        return deduped;
    }

    private async getMoveAction(instruction: Instruction) {
        let moveAction = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: `Select a package for ${COLOR_KEY_MESSAGE(instruction.type)} ${COLOR_KEY_MESSAGE(
                instruction.fullName
            )}`,
            choices: this.getChoicesForMovingMetadata(instruction),
        });
        return moveAction.action;
    }

    private async removeEmptyDirectories(directory) {
        // lstat does not follow symlinks (in contrast to stat)
        try {
            const fileStats = await fs.lstat(directory);
            if (!fileStats.isDirectory()) {
                return;
            }
            let fileNames = await fs.readdir(directory);
            if (fileNames.length > 0) {
                const recursiveRemovalPromises = fileNames.map((fileName) =>
                    this.removeEmptyDirectories(path.join(directory, fileName))
                );
                await Promise.all(recursiveRemovalPromises);

                // re-evaluate fileNames; after deleting subdirectory
                // we may have parent directory empty now
                fileNames = await fs.readdir(directory);
            }

            if (fileNames.length === 0) {
                await fs.rmdir(directory);
            }
        } catch (error) {
            return;
        }
    }

    private getChoicesForMovingMetadata(metadata) {
        if (metadataRegistry.types[metadata.type]?.strategy) {
            let recommendedPackages = metadataRegistry.types[metadata.type].recommended?.map((elem) => elem.package);
            return [
                {
                    name: `Recommended (Strategy: ${metadataRegistry.types[metadata.type].strategy}) ${
                        recommendedPackages ? recommendedPackages : ''
                    }`,
                    value: MoveAction.RECOMMENDED,
                },
                { name: 'Existing', value: MoveAction.EXISTING },
                { name: 'New', value: MoveAction.NEW },
                { name: 'Do nothing', value: MoveAction.NOTHING },
            ];
        } else {
            return [
                { name: 'Existing', value: MoveAction.EXISTING },
                { name: 'New', value: MoveAction.NEW },
                { name: 'Do nothing', value: MoveAction.NOTHING },
            ];
        }
    }

    private async getPlusOneMoveAction() {
        let plusOneMoveAction = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: `Select additional package`,
            choices: [
                { name: 'Existing', value: MoveAction.EXISTING },
                { name: 'New', value: MoveAction.NEW },
            ],
        });

        return plusOneMoveAction.action;
    }

    private async getSingleRecommendedPackage(recommended: { package: string; aliasfy: boolean }[]) {
        let singleRecommendedPackage = await inquirer.prompt({
            type: 'list',
            name: 'package',
            message: 'Select recommended package',
            choices: recommended.map((elem) => elem.package),
        });

        return singleRecommendedPackage.package;
    }

    private addNewPackageToProjectConfig(packageDescriptor, indexOfPackage: number, projectConfig) {
        projectConfig.packageDirectories.forEach((dir) => {
            if (dir.package === packageDescriptor.package)
                throw new Error(`Package with name ${packageDescriptor.package} already exists`);
        });

        projectConfig.packageDirectories.splice(indexOfPackage, 0, packageDescriptor);
    }

    private writeProjectConfigToFile(projectConfig: any) {
        fs.writeJSONSync('sfdx-project.json', projectConfig, { spaces: 2 });
    }

    private encodeData(s: String): String {
        return s.replace(/\(/g, '%28').replace(/\)/g, '%29');
    }
}

enum MoveAction {
    RECOMMENDED = 'recommended',
    NEW = 'new',
    EXISTING = 'existing',
    NOTHING = 'nothing',
}

enum Strategy {
    SINGLE = 'single',
    DUPLICATE = 'duplicate',
    PLUS_ONE = 'plus-one',
    DELETE = 'delete',
}

interface Instruction {
    fullName: string;
    type: string;
    destination: { package: string; aliasfy?: boolean }[];
}
