import Git from "@dxatscale/sfpowerscripts.core/lib/git/Git";
import IgnoreFiles from "@dxatscale/sfpowerscripts.core/lib/ignore/IgnoreFiles";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import MetadataFiles from "@dxatscale/sfpowerscripts.core/lib/metadata/MetadataFiles";
const sfdcSoup = require("sfdc-soup");
const Handlebars = require("handlebars");
const puppeteer = require("puppeteer");
import * as fs from "fs-extra";
import path = require("path");
import { Connection } from "@salesforce/core";
import CyclicalDependencyAnalyzer from "./CyclicalDependencyAnalyzer";

export default class DependencyAnalysis {
  constructor(
    private baseBranch: string,
    private connection: Connection
  ){}

  public async exec() {
    let git: Git = new Git();

    let projectConfig = ProjectConfig.getSFDXPackageManifest(null);

    let diff: string[] = await git.diff([
      this.baseBranch,
      `HEAD`,
      `--no-renames`,
      `--name-only`
    ]);

    // Filter diff to package directories
    diff = diff.filter((filepath) =>
      projectConfig.packageDirectories.find((pkg) =>
        // TODO: make comparison more robust
          filepath.includes(pkg.path)
      )
    );

    // Apply root forceignore to the diff
    let ignoreFiles: IgnoreFiles = new IgnoreFiles(
      fs.readFileSync(".forceignore", "utf8")
    );
    diff = ignoreFiles.filter(diff);

    let componentSuccesses = this.getComponentSuccessesFromReports();

    // Get api name of components that have changed
    const components: Component[] = [];
    if (diff.length > 0) {
      for (const filepath of diff) {
        // componentApiNames.push(MetadataFiles.getFullApiName(filepath));
        const fullApiName = MetadataFiles.getFullApiName(filepath);

        // find package that file belongs to
        const indexOfPackage = projectConfig.packageDirectories.findIndex(pkg =>
          filepath.includes(pkg.path)
        );

        const componentSuccess = componentSuccesses
          .find(component =>
            component.fullName === fullApiName && component.id
          );

        if (componentSuccess) {
          const component: Component = {
            id: componentSuccess.id,
            fullName: componentSuccess.fullName,
            type: componentSuccess.componentType,
            file: filepath,
            package: projectConfig.packageDirectories[indexOfPackage].package,
            indexOfPackage: indexOfPackage
          }

          components.push(component);
        } else {
          // Ignore file if it's not an identifiable component
          continue;
        }
      }
    } else throw new Error("No changed components to analyse");


    let entrypoints = this.getEntrypoints(components);

    // let connection = {
    //   token: this.authDetails.accessToken,
    //   url: this.authDetails.instanceUrl
    // };

    const cyclicalDependencyAnalyzer = new CyclicalDependencyAnalyzer(entrypoints, this.connection, components);
    await cyclicalDependencyAnalyzer.exec();

    // call Usage API once

    // // Register helper for stringifying JSON objects in hbs templates
    // Handlebars.registerHelper('stringify', function(object) {
    //   return JSON.stringify(object, null, 4);
    // });

    // const impactAnalysisResultsDir = ".sfpowerscripts/impactAnalysis"
    // fs.mkdirpSync(impactAnalysisResultsDir);

    // const screenshotDir = path.join(
    //   impactAnalysisResultsDir,
    //   "screenshots"
    // );
    // fs.mkdirpSync(screenshotDir);

    // let resourcesDir: string = path.join(
    //   __dirname,
    //   "..",
    //   "..",
    //   "..",
    //   "resources"
    // );

    // this.copyDependencies(resourcesDir, impactAnalysisResultsDir);

    // let browser;
    // try{
    //   browser = await puppeteer.launch({
    //     defaultViewport: {width: 1920, height: 1080},
    //     args: ["--no-sandbox"]
    //   });

    //   for (let entrypoint of entrypoints) {
    //     let { nodes, edges } = await this.createGraphElements(entrypoint, connection);

    //     // skip graphs with single node
    //     if (nodes.length === 1) continue;

    //     await this.generateGraphFilesForEntrypoint(
    //       nodes,
    //       edges,
    //       resourcesDir,
    //       impactAnalysisResultsDir,
    //       entrypoint.name
    //     );

    //     const page = await browser.newPage();

    //     await page.goto(
    //       `file://` +
    //       path.resolve(impactAnalysisResultsDir, `${entrypoint.name}.html`) +
    //       `?depth=2`
    //     );

    //     await page.screenshot({
    //       path: path.join(
    //         screenshotDir,
    //         entrypoint.name + '.png'
    //       ),
    //       fullPage: true
    //     });
    //   }
    // } finally {
    //   if (browser)  await browser.close();
    // }
  }

  private async generateGraphFilesForEntrypoint(
    nodes: any[],
    edges: any[],
    resourcesDir: string,
    impactAnalysisResultsDir: string,
    componentName: string
  ): Promise<void> {

    let data = {
      elements: nodes.concat(edges)
    };

    let source = fs.readFileSync(
      path.join(
        resourcesDir,
        "script.hbs"
      ),
      'utf8'
    );
    let scriptTemplate = Handlebars.compile(source);

    fs.writeFileSync(
      path.join(
        impactAnalysisResultsDir,
        `${componentName}.js`
      ),
      scriptTemplate(data)
    );

    let markupSource = fs.readFileSync(
      path.join(
        resourcesDir,
        "markup.hbs"
      ),
      'utf8'
    );
    let markupTemplate = Handlebars.compile(markupSource);

    fs.writeFileSync(
      path.join(
        impactAnalysisResultsDir,
        `${componentName}.html`
      ),
      markupTemplate({
        componentName: componentName,
        script: `${componentName}.js`
      })
    );
  }

  /**
   * Aggregates component successes from MDAPI deploy reports
   */
  private getComponentSuccessesFromReports(): any[] {
    let componentSuccesses: any[] = [];

    const reportsDir: string = ".sfpowerscripts/mdapiDeployReports";
    let reports = fs.readdirSync(reportsDir);
    reports.forEach((report) => {
      let data = JSON.parse(
        fs.readFileSync(path.join(reportsDir, report), "utf8")
      );
      componentSuccesses = componentSuccesses.concat(data.result.details.componentSuccesses);
    });
    return componentSuccesses;
  }

  /**
   * Entrypoint ID's are found by filtering componentSuccesses against componentApiNames
   * @param componentApiNames
   * @param componentSuccesses
   */
  private getEntrypoints(
    components: Component[]
  ): Entrypoint[] {
    // component names that cannot be ID'ed are excluded / undetected
    // components.forEach((component) => {
    //   entrypoints = entrypoints.concat(
    //     componentSuccesses
    //       .filter((component) => {
    //         return component.fullName === name && component.id
    //       })
    //       .map((component) => {
    //         return {
    //           name: component.fullName,
    //           type: component.componentType,
    //           id: component.id
    //         };
    //       })
    //   );
    // });

    // if (entrypoints.length === 0)
    //   throw new Error("Unable to retrieve ID of the changed components");

    return components.map(component => {
      return {
        name: component.fullName,
        type: component.type,
        id: component.id
      } as Entrypoint
    });
  }

  /**
   * Create graph elements for entrypoint and child components that are dependent on it
   * @param entrypoint
   * @param connection
   */
  private async createGraphElements(
    entrypoint: { name: string; type: string; id: string},
    connection: { token: string, url: string}
  ) {
    let nodes = [];
    let edges = [];

      // create new node
      nodes.push({
        data: {
          id: "root",
          type: entrypoint.type,
          label: entrypoint.name
        },
        group: "nodes",
        removed: false,
        selected: false,
        selectable: true,
        locked: false,
        grabbable: true,
        pannable: false,
        classes: "changed"
      });

      let childNodeNum: number = 0;
      await (async function createChildNodes(
        entrypoint: {name: string, type: string, id: string},
        connection: {token:string; url: string;},
        parentNodeId
        ) {
        let usageApi = sfdcSoup.usageApi(connection, entrypoint);
        let usageResponse = await usageApi.getUsage();
        for (let metadataType of Object.values<any>(usageResponse.usageTree)) {
          for (let component of metadataType) {
            let childNodeId;

            let existingNode = nodes.find((node) => node.data.label === component.name);

            if (!existingNode) {
              childNodeId = "N" + childNodeNum;

              nodes.push({
                data: {
                  id: childNodeId,
                  type: component.type,
                  label: component.name
                },
                group: "nodes",
                removed: false,
                selected: false,
                selectable: true,
                locked: false,
                grabbable: true,
                pannable: false,
                classes: "impacted"
              });
            } else childNodeId = existingNode.data.id;

            edges.push({
              data: {
                id: parentNodeId + "-" + childNodeId,
                source: parentNodeId,
                target: childNodeId,
              },
              group: "edges",
              removed: false,
              selected: false,
              selectable: true,
              locked: false,
              grabbable: true,
              pannable: true,
              classes: ""
            });

            childNodeNum++;

            // Recursively create child nodes for new node
            if (!existingNode) {
              if (component.id.length === 18 && component.id.startsWith("0"))
                await createChildNodes(
                  {name: component.name, type: component.type, id: component.id},
                  connection,
                  childNodeId
                );
            }
          }
        }
      })(entrypoint, connection, "root");
    return { nodes, edges };
  }

  private copyDependencies(resourcesDir: string, impactAnalysisResultsDir: string) {
    fs.copySync(
      path.join(
        resourcesDir,
        "styles.css"
      ),
      path.join(
        impactAnalysisResultsDir,
        "styles.css"
      )
    );

    fs.copySync(
      path.join(
        resourcesDir,
        "cytoscape.min.js"
      ),
      path.join(
        impactAnalysisResultsDir,
        "cytoscape.min.js"
      )
    );

    fs.copySync(
      path.join(
        resourcesDir,
        "dagre.js"
      ),
      path.join(
        impactAnalysisResultsDir,
        "dagre.js"
      )
    );

    fs.copySync(
      path.join(
        resourcesDir,
        "cytoscape-dagre.js"
      ),
      path.join(
        impactAnalysisResultsDir,
        "cytoscape-dagre.js"
      )
    );
  }
}

export interface Component {
  id: string,
  fullName: string,
  type: string,
  file: string,
  package: string,
  indexOfPackage: number
}

export interface Entrypoint {
  name: string,
  type: string,
  id: string
}