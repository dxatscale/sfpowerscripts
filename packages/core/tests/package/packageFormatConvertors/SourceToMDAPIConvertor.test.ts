import { jest, expect } from "@jest/globals";
import SourceToMDAPIConvertor from "../../../src/package/packageFormatConvertors/SourceToMDAPIConvertor";
import {
  ComponentSet,
  MetadataConverter,
} from "@salesforce/source-deploy-retrieve";


describe("Given a source directory, it should be able to convert to mdapi directory", () => {
  it("should provide the path to a mdapi directory", async () => {
    jest.spyOn(ComponentSet,"fromSource").mockReturnValueOnce(null);
    jest.spyOn(MetadataConverter.prototype, "convert").mockResolvedValue({packagePath:'mdapiDir'});
    let sourceToMDAPIConvertor: SourceToMDAPIConvertor = new SourceToMDAPIConvertor(
      null,
      "es-space-mgmt"
    );
    let result = await sourceToMDAPIConvertor.convert();
    expect(result.packagePath).toStrictEqual("mdapiDir");
  });

});
