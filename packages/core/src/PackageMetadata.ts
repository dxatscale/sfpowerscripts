export default interface PackageMetadata {
    id?: string;
    package_name: string;
    package_version_number?: string;
    package_version_id?:string;
    package_type?: string;
    test_coverage?:number;
    has_passed_coverage_check?:boolean;
    repository_url: string;
    sourceVersion?: string;
    sourceVersionFrom?:string;
    sourceVersionTo?:string;
    branch?:string;
    apextestsuite?: string;
    isApexFound?:boolean;
    isProfilesFound?:boolean;
    tag?:string;
    isDependencyValidated?:boolean;
    isDestructiveChangesFound?:boolean;
    destructiveChanges?:any;
    payload?:any;
    sourceDir?:string;
    dependencies?:any;
    creation_details?:{creation_time?:number,timestamp?:number}
    deployments?:{target_org:string,sub_directory?:string,installation_time?:number,timestamp?:number}[];
  }
  