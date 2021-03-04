import Git from "@dxatscale/sfpowerscripts.core/lib/utils/Git";
import IgnoreFiles from "@dxatscale/sfpowerscripts.core/lib/utils/IgnoreFiles";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import MetadataFiles from "@dxatscale/sfpowerscripts.core/lib/metadata/metadataFiles";
const sfdcSoup = require("sfdc-soup");
const Handlebars = require("handlebars");
const puppeteer = require("puppeteer");
import * as fs from "fs-extra";
import path = require("path");

export default class DependencyAnalysis {
  constructor(
    private baseBranch: string,
    private authDetails
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
          filepath.includes(pkg.path)
      )
    );

    // Apply root forceignore to the diff
    let ignoreFiles: IgnoreFiles = new IgnoreFiles(
      fs.readFileSync(".forceignore", "utf8")
    );
    diff = ignoreFiles.filter(diff);

    // Get api name of components that have changed
    let componentApiNames: string[] = [];
    if (diff.length > 0) {
      diff.forEach((filepath) => {
        componentApiNames.push(MetadataFiles.getFullApiName(filepath));
      })
    } else throw new Error("No changed components to analyse");

    let componentSuccesses = this.getComponentSuccessesFromReports();

    let entrypoints = this.getEntrypoints(componentApiNames, componentSuccesses);

    let connection = {
      token: this.authDetails.accessToken,
      url: this.authDetails.instanceUrl
    };

    // Register helper for stringifying JSON objects in hbs templates
    Handlebars.registerHelper('stringify', function(object) {
      return JSON.stringify(object, null, 4);
    });

    const impactAnalysisResultsDir = ".sfpowerscripts/impactAnalysis"
    fs.mkdirpSync(impactAnalysisResultsDir);

    const screenshotDir = path.join(
      impactAnalysisResultsDir,
      "screenshots"
    );
    fs.mkdirpSync(screenshotDir);

    let resourcesDir: string = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "resources"
    );

    this.copyDependencies(resourcesDir, impactAnalysisResultsDir);

    const browser = await puppeteer.launch({
      defaultViewport: {width: 1920, height: 1080},
      args: ["--no-sandbox"]
    });

    for (let entrypoint of entrypoints) {
      await this.generateGraphFilesForEntrypoint(
        entrypoint,
        connection,
        resourcesDir,
        impactAnalysisResultsDir
      );

      const page = await browser.newPage();

      await page.goto(
        `file://` +
        path.resolve(impactAnalysisResultsDir, `${entrypoint.name}.html`) +
        `?depth=2`
      );

      await page.screenshot({
        path: path.join(
          screenshotDir,
          entrypoint.name + '.png'
        ),
        fullPage: true
      });
    }

    await browser.close();
  }

  private async generateGraphFilesForEntrypoint(
    entrypoint: { name: string; type: string; id: string; },
    connection: { token: string; url: string; },
    resourcesDir: string,
    impactAnalysisResultsDir: string
  ) {
    let { nodes, edges } = await this.createGraph(entrypoint, connection);

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
        `${entrypoint.name}.js`
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
        `${entrypoint.name}.html`
      ),
      markupTemplate({
        componentName: entrypoint.name,
        script: `${entrypoint.name}.js`
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
    componentApiNames: string[],
    componentSuccesses: any[]
  ): {name: string, type: string, id: string}[] {
    let entrypoints: {name: string, type: string, id: string}[] = [];

    // component names that cannot be ID'ed are excluded / undetected
    componentApiNames.forEach((name) => {
      entrypoints = entrypoints.concat(
        componentSuccesses
          .filter((component) => {
            return component.fullName === name;
          })
          .map((component) => {
            return {
              name: component.fullName,
              type: component.componentType,
              id: component.id
            };
          })
      );
    });

    if (entrypoints.length === 0)
      throw new Error("Unable to retrieve ID of the changed components");

    return entrypoints;
  }

  /**
   * Create graph of entrypoint and child components that are dependent on it
   * @param entrypoint
   * @param connection
   */
  private async createGraph(
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
