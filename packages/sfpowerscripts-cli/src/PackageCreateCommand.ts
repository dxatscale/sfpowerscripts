import { COLOR_HEADER, COLOR_KEY_MESSAGE } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { EOL } from "os";
import SfpowerscriptsCommand from "./SfpowerscriptsCommand";

export default abstract class PackageCreateCommand extends SfpowerscriptsCommand {

  protected printPackageDetails(packageMetadata: PackageMetadata) {
    console.log(
      COLOR_HEADER(`${EOL}${
        packageMetadata.package_name
      } package created in ${this.getFormattedTime(
        packageMetadata.creation_details.creation_time
      )}`
    ));
    console.log(COLOR_HEADER(`-- Package Details:--`));
    console.log(
      COLOR_HEADER(`-- Package Version Number:        `),
      COLOR_KEY_MESSAGE(packageMetadata.package_version_number)
    );

    if (packageMetadata.package_type !== "data") {
      if (packageMetadata.package_type == "unlocked") {
        console.log(
          COLOR_HEADER(`-- Package Version Id:             `),
          COLOR_KEY_MESSAGE(packageMetadata.package_version_id)
        );
        console.log(
          COLOR_HEADER(`-- Package Test Coverage:          `),
          COLOR_KEY_MESSAGE(packageMetadata.test_coverage)
        );
        console.log(
          COLOR_HEADER(`-- Package Coverage Check Passed:  `),
          COLOR_KEY_MESSAGE(packageMetadata.has_passed_coverage_check)
        );
      }

      console.log(
        COLOR_HEADER(`-- Apex In Package:             `),
        COLOR_KEY_MESSAGE(packageMetadata.isApexFound ? "Yes" : "No")
      );
      console.log(
        COLOR_HEADER(`-- Profiles In Package:         `),
        COLOR_KEY_MESSAGE(packageMetadata.isProfilesFound ? "Yes" : "No")
      );
      console.log(
        COLOR_HEADER(`-- Metadata Count:         `),
        COLOR_KEY_MESSAGE(packageMetadata.metadataCount)
      );
    }
  }

  protected getFormattedTime(milliseconds: number): string {
    let date = new Date(0);
    date.setSeconds(milliseconds / 1000); // specify value for SECONDS here
    let timeString = date.toISOString().substr(11, 8);
    return timeString;
  }

}