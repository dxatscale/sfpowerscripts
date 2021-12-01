import { Connection } from "@salesforce/core";
const sfdcSoup = require("sfdc-soup");
import Component from "./Component";
import Entrypoint from "./Entrypoint";
import SFPLogger, { LoggerLevel } from "../logger/SFPLogger";

export default class DependencyFetcher {

  constructor(private conn: Connection, private components: Component[]) {}

  async fetch(): Promise<Component[]> {

    const soupApiConnection = {
      token: this.conn.accessToken,
      url: this.conn.instanceUrl,
      apiVersion: '50.0'
    };

    for (const component of this.components) {
      if (!component.dependencies || component.dependencies.length === 0) {
        const entrypoint: Entrypoint = {name: component.fullName, type: component.type, id: component.id};
        const soupApi = sfdcSoup(soupApiConnection, entrypoint);

        let dependencyResponse;
        try {
          dependencyResponse = await soupApi.getDependencies();
        } catch (error) {
          SFPLogger.log(error.message, LoggerLevel.DEBUG);
        }

        const dependenciesOfEntrypoint = [];
        const entrypointKey = Object.keys(dependencyResponse.dependencyTree)[0];
        // flatten dependency tree
        for (const cmps of Object.values<any>(dependencyResponse.dependencyTree[entrypointKey]?.references ?? [])) {
          cmps.forEach(cmp => {
            const pattern = new RegExp(`:::${cmp.id}$`);
            cmp.name = cmp.name.replace(pattern, ""); // strip id from api name

            dependenciesOfEntrypoint.push(cmp);
          });
        }

        // Map dependency response to Component type
        const componentDependencies = dependenciesOfEntrypoint.map<Component>(dependency => {
          return {
            id: dependency.id,
            fullName: dependency.name,
            type: dependency.type,
            namespace: dependency.namespace
          };
        });

        component.dependencies = componentDependencies;
      } else {
        // Skip component if dependencies is already defined
        continue;
      }
    }

    return this.components;
  }
}