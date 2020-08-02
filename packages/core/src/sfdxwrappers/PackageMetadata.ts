export default interface PackageMetadata {
    id?: string;
    package_name: string;
    package_version_number: string;
    sourceVersion: string;
    repository_url: string;
    package_type: string;
    apextestsuite?: string;
    isApexFound?:boolean;
    isDestructiveChangesFound?:boolean;
    payload?:any;
    deployments?:{target_org:string,sub_directory?:string}[];
  }