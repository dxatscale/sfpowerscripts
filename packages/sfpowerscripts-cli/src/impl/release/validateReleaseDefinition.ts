import ReleaseDefinition from "../release/ReleaseDefinitionInterface";
const Validator = require('jsonschema').Validator;

export default function validateReleaseDefinition(
  releaseDefinition: ReleaseDefinition,
  isNpm: boolean
): void {
  let v = new Validator();

  let versionPattern: RegExp;
  if (isNpm) {
    versionPattern = /(^[0-9]+\.[0-9]+\.[0-9]+(-.+)?)|^LATEST_TAG$|^[a-zA-Z0-9]+$/
  } else {
    versionPattern = /(^[0-9]+\.[0-9]+\.[0-9]+(-.+)?)|^LATEST_TAG$/
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
          }
      },
      "additionalProperties": false,
      "required": [
          "release",
          "artifacts",
      ]
  };

  let validationResult = v.validate(releaseDefinition, schema);
  if (validationResult.errors.length > 0) {
      let errorMsg: string =
          `Release definition does not meet schema requirements, ` +
          `found ${validationResult.errors.length} validation errors:\n`;

      validationResult.errors.forEach( (error, errorNum) => {
          errorMsg += `\n${errorNum+1}. ${error.stack}`;
          if (error.instance != null)
              errorMsg += `\nReceived: ${JSON.stringify(error.instance)}\n`;
      });
      throw new Error(errorMsg);
  }
}
