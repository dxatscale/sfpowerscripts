
export async function mapInstalledArtifactstoPkgAndCommits(
	installedArtifacts: any,
) {
	let packagesMappedToLastKnownCommitId: { [p: string]: string } = {};
	if (installedArtifacts != null) {
		packagesMappedToLastKnownCommitId =
			getPackagesToCommits(installedArtifacts);
	}
	return packagesMappedToLastKnownCommitId;

	function getPackagesToCommits(installedArtifacts: any): {
		[p: string]: string;
	} {
		const packagesToCommits: { [p: string]: string } = {};

		// Construct map of artifact and associated commit Id
		installedArtifacts.forEach((artifact) => {
			packagesToCommits[artifact.Name] = artifact.CommitId__c;
			//Override for debugging purposes
			if (process.env.VALIDATE_OVERRIDE_PKG)
				packagesToCommits[process.env.VALIDATE_OVERRIDE_PKG] =
					process.env.VALIDATE_PKG_COMMIT_ID;
		});

		if (process.env.VALIDATE_REMOVE_PKG)
			delete packagesToCommits[process.env.VALIDATE_REMOVE_PKG];

		return packagesToCommits;
	}
}
