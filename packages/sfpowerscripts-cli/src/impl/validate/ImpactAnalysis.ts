const sfdcSoup = require('@dxatscale/sfdc-soup');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
import Component from '@dxatscale/sfpowerscripts.core/lib/dependency/Component';
import { component2entrypoint } from '@dxatscale/sfpowerscripts.core/lib/dependency/Entrypoint';
import * as fs from 'fs-extra';
import path = require('path');
import { Connection } from '@salesforce/core';

export default class ImpactAnalysis {
    constructor(private conn: Connection, private components: Component[]) {}

    public async exec() {
        const soupApiConnection = {
            token: this.conn.getAuthInfoFields().accessToken,
            url: this.conn.getAuthInfoFields().instanceUrl,
            apiVersion: '50.0',
        };

        // Register helper for stringifying JSON objects in hbs templates
        Handlebars.registerHelper('stringify', function (object) {
            return JSON.stringify(object, null, 4);
        });

        const impactAnalysisResultsDir = '.sfpowerscripts/impactAnalysis';
        fs.mkdirpSync(impactAnalysisResultsDir);

        const screenshotDir = path.join(impactAnalysisResultsDir, 'screenshots');
        fs.mkdirpSync(screenshotDir);

        let resourcesDir: string = path.join(__dirname, '..', '..', '..', 'resources');

        this.copyDependencies(resourcesDir, impactAnalysisResultsDir);

        let browser;
        try {
            browser = await puppeteer.launch({
                defaultViewport: { width: 1920, height: 1080 },
                args: ['--no-sandbox'],
            });

            const entrypoints = component2entrypoint(this.components);
            for (let entrypoint of entrypoints) {
                let { nodes, edges } = await this.createGraphElements(entrypoint, soupApiConnection);

                // skip graphs with single node
                if (nodes.length === 1) continue;

                await this.generateGraphFilesForEntrypoint(
                    nodes,
                    edges,
                    resourcesDir,
                    impactAnalysisResultsDir,
                    entrypoint.name
                );

                const page = await browser.newPage();

                await page.goto(
                    `file://` + path.resolve(impactAnalysisResultsDir, `${entrypoint.name}.html`) + `?depth=2`
                );

                await page.screenshot({
                    path: path.join(screenshotDir, entrypoint.name + '.png'),
                    fullPage: true,
                });
            }
        } finally {
            if (browser) await browser.close();
        }
    }

    private async generateGraphFilesForEntrypoint(
        nodes: any[],
        edges: any[],
        resourcesDir: string,
        impactAnalysisResultsDir: string,
        componentName: string
    ): Promise<void> {
        let data = {
            elements: nodes.concat(edges),
        };

        let source = fs.readFileSync(path.join(resourcesDir, 'script.hbs'), 'utf8');
        let scriptTemplate = Handlebars.compile(source);

        fs.writeFileSync(path.join(impactAnalysisResultsDir, `${componentName}.js`), scriptTemplate(data));

        let markupSource = fs.readFileSync(path.join(resourcesDir, 'markup.hbs'), 'utf8');
        let markupTemplate = Handlebars.compile(markupSource);

        fs.writeFileSync(
            path.join(impactAnalysisResultsDir, `${componentName}.html`),
            markupTemplate({
                componentName: componentName,
                script: `${componentName}.js`,
            })
        );
    }

    /**
     * Create graph elements for entrypoint and child components that are dependent on it
     * @param entrypoint
     * @param connection
     */
    private async createGraphElements(
        entrypoint: { name: string; type: string; id: string },
        connection: { token: string; url: string }
    ) {
        let nodes = [];
        let edges = [];

        // create new node
        nodes.push({
            data: {
                id: 'root',
                type: entrypoint.type,
                label: entrypoint.name,
            },
            group: 'nodes',
            removed: false,
            selected: false,
            selectable: true,
            locked: false,
            grabbable: true,
            pannable: false,
            classes: 'changed',
        });

        let childNodeNum: number = 0;
        await (async function createChildNodes(
            entrypoint: { name: string; type: string; id: string },
            connection: { token: string; url: string },
            parentNodeId
        ) {
            const soupApi = sfdcSoup(connection, entrypoint);
            const usageResponse = await soupApi.getUsage();
            for (let metadataType of Object.values<any>(usageResponse.usageTree)) {
                for (let component of metadataType) {
                    let childNodeId;

                    let existingNode = nodes.find((node) => node.data.label === component.name);

                    if (!existingNode) {
                        childNodeId = 'N' + childNodeNum;

                        nodes.push({
                            data: {
                                id: childNodeId,
                                type: component.type,
                                label: component.name,
                            },
                            group: 'nodes',
                            removed: false,
                            selected: false,
                            selectable: true,
                            locked: false,
                            grabbable: true,
                            pannable: false,
                            classes: 'impacted',
                        });
                    } else childNodeId = existingNode.data.id;

                    edges.push({
                        data: {
                            id: parentNodeId + '-' + childNodeId,
                            source: parentNodeId,
                            target: childNodeId,
                        },
                        group: 'edges',
                        removed: false,
                        selected: false,
                        selectable: true,
                        locked: false,
                        grabbable: true,
                        pannable: true,
                        classes: '',
                    });

                    childNodeNum++;

                    // Recursively create child nodes for new node
                    if (!existingNode) {
                        if (component.id.length === 18 && component.id.startsWith('0'))
                            await createChildNodes(
                                { name: component.name, type: component.type, id: component.id },
                                connection,
                                childNodeId
                            );
                    }
                }
            }
        })(entrypoint, connection, 'root');
        return { nodes, edges };
    }

    private copyDependencies(resourcesDir: string, impactAnalysisResultsDir: string) {
        fs.copySync(path.join(resourcesDir, 'styles.css'), path.join(impactAnalysisResultsDir, 'styles.css'));

        fs.copySync(
            path.join(resourcesDir, 'cytoscape.min.js'),
            path.join(impactAnalysisResultsDir, 'cytoscape.min.js')
        );

        fs.copySync(path.join(resourcesDir, 'dagre.js'), path.join(impactAnalysisResultsDir, 'dagre.js'));

        fs.copySync(
            path.join(resourcesDir, 'cytoscape-dagre.js'),
            path.join(impactAnalysisResultsDir, 'cytoscape-dagre.js')
        );
    }
}
