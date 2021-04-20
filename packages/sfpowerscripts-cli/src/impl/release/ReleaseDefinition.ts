import ReleaseDefinitionSchema from "./ReleaseDefinitionSchema";
import Ajv from "ajv"
const yaml = require('js-yaml');
import lodash = require("lodash");
import get18DigitSalesforceId from "../../utils/get18DigitSalesforceId";
import * as fs from "fs-extra";

export default class ReleaseDefinition {
  private _releaseDefinition: ReleaseDefinitionSchema;

  get releaseDefinition() {
    // Return clone of releaseDefinition for immutability
    return lodash.cloneDeep(this._releaseDefinition);
  }
  constructor(
    pathToReleaseDefinition: string,
    isNpm: boolean
  ) {
    this._releaseDefinition = yaml.load(
      fs.readFileSync(pathToReleaseDefinition, 'utf8')
    );
    this.validateReleaseDefinition(this._releaseDefinition, isNpm);

    // Workaround for jsonschema not supporting validation based on dependency value
    if (this._releaseDefinition.releaseOptions?.baselineOrg && !this._releaseDefinition.releaseOptions?.skipIfAlreadyInstalled)
      throw new Error("Release option 'skipIfAlreadyInstalled' must be true for 'baselineOrg'");

    if (this._releaseDefinition.packageDependencies) {
      this.convertPackageDependenciesIdTo18Digits(this._releaseDefinition.packageDependencies);
    }
  }

  private convertPackageDependenciesIdTo18Digits(packageDependencies: {[p: string]: string}) {
    for (let pkg in packageDependencies) {
      packageDependencies[pkg] = get18DigitSalesforceId(packageDependencies[pkg]);
    }
  }

  private validateReleaseDefinition(
    releaseDefinition: ReleaseDefinitionSchema,
    isNpm: boolean
  ): void {
    

    let versionPattern
    if (isNpm) {
      versionPattern = "(^[0-9]+\\.[0-9]+\\.[0-9]+(-.+)?$)|^LATEST_TAG$|^[a-zA-Z0-9]+$"
    } else {
      versionPattern = "(^[0-9]+\\.[0-9]+\\.[0-9]+(-.+)?$)|^LATEST_TAG$"
    }
  

    const schema = {
        "type": "object",
        "properties": {
            "release": {
                "type": "string"
            },
            "artifacts": {
                "type": "object",
                "patternProperties": {
                  ".+": {
                    "type": "string",
                    "pattern": versionPattern
                  }
                }
            },
            "packageDependencies": {
              "type": "object",
              "patternProperties": {
                ".+": {
                  "type": "string",
                  "pattern": "^04t([a-zA-Z0-9]{15}|[a-zA-Z0-9]{12})$"
                }
              }
            },
            "releaseOptions": {
              "type": "object",
              "properties": {
                "skipIfAlreadyInstalled": {
                  "type": "boolean"
                },
                "baselineOrg": {
                  "type": "string"
                }
              },
              "dependencies": {
                "baselineOrg": ["skipIfAlreadyInstalled"]
              },
              "additionalProperties": false
            }
        },
        "additionalProperties": false,
        "required": [
            "release",
            "artifacts",
        ]
    };

    let validator = new Ajv().compile(schema);
    let validationResult = validator(releaseDefinition)
    if (!validationResult) {
        let errorMsg: string =
            `Release definition does not meet schema requirements, ` +
            `found ${validator.errors.length} validation errors:\n`;

             validator.errors.forEach((error,errorNum) => {
              errorMsg += `\n${errorNum+1}: ${error.instancePath}:${error.message}`;
             });
        throw new Error(errorMsg);
    }
  }
}


