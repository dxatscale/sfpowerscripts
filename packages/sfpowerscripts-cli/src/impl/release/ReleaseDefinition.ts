import ReleaseDefinitionSchema from "./ReleaseDefinitionSchema";
import Ajv from "ajv"
const yaml = require('js-yaml');
import lodash = require("lodash");
import get18DigitSalesforceId from "../../utils/Get18DigitSalesforceId";
import * as fs from "fs-extra";
const path = require("path");

export default class ReleaseDefinition {
  private _releaseDefinition: ReleaseDefinitionSchema;

  get releaseDefinition() {
    // Return clone of releaseDefinition for immutability
    return lodash.cloneDeep(this._releaseDefinition);
  }
  constructor(
    pathToReleaseDefinition: string
  ) {
    this._releaseDefinition = yaml.load(
      fs.readFileSync(pathToReleaseDefinition, 'utf8')
    );
    this.validateReleaseDefinition(this._releaseDefinition);

    // Workaround for jsonschema not supporting validation based on dependency value
    if (this._releaseDefinition.baselineOrg && !this._releaseDefinition.skipIfAlreadyInstalled)
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
    releaseDefinition: ReleaseDefinitionSchema
  ): void {

    let schema = fs.readJSONSync(
      path.join(__dirname, "..", "..", "..", "resources", "schemas", "releasedefinition.schema.json"),
      {encoding: "UTF-8"}
    );

    let validator = new Ajv({allErrors: true}).compile(schema);
    let validationResult = validator(releaseDefinition);

    if (!validationResult) {
      let errorMsg: string =
        `Release definition does not meet schema requirements, ` +
        `found ${validator.errors.length} validation errors:\n`;

      validator.errors.forEach((error,errorNum) => {
      errorMsg += `\n${errorNum+1}: ${error.instancePath}: ${error.message} ${JSON.stringify(error.params, null, 4)}`;
      });

      throw new Error(errorMsg);
    }
  }
}
