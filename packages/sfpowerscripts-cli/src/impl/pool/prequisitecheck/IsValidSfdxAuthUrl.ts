export default function isValidSfdxAuthUrl(sfdxAuthUrl: string): boolean {
  if (sfdxAuthUrl.match(/force:\/\/(?<refreshToken>[a-zA-Z0-9._]+)@.+/)) {
    return true;
  } else {
    let match = sfdxAuthUrl.match(
      /force:\/\/(?<clientId>[a-zA-Z]+):(?<clientSecret>[a-zA-Z0-9]*):(?<refreshToken>[a-zA-Z0-9._]+)@.+/
    );

    if (match !== null) {
      if (match.groups.refreshToken === "undefined") {
        return false;
      } else {
        return true;
      }
    } else {
      return false;
    }
  }
}