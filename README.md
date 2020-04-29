# sfpowerscripts

sfpowerscripts is a wrapper around sfdx-cli and open source sfdx plugin [sfpowerkit]( 
https://github.com/Accenture/sfpowerkit) aimed at elimiinating wasted efforts in writing boiler plate code (often written using bash scripts) while setting up a  CI/CD solution for Salesforce.

The project supports the following targets at the moment
- Azure Pipelines through a native extension. More details on the extension is available [here](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/azpipelines)
- For other CI/CD platforms, through a sfdx-plugin. Detaila on the command and usage available [here]()

The project intends to add native extension to other CI/CD platforms (which supports an extension based model) or provide sample pipelines to get started with minimal efforts.


sfpowerscripts initially began life in the form of a  Azure Pipelines Extension. available through the Visual Studio marketplace. The project was then expanded to support non extension CI/CDs such as Gitlab utilising the sfdx-plugin.
.
