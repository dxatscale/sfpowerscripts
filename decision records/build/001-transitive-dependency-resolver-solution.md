# Transitive dependency resolver resolution
•	Status: Approved
•	Issue: #855

## Context and Problem Statement
sfdx-project.json is the manifest which determines the packages in a particular project, dependencies of each packages and deployment order. There are some potential risks with the large sfdx-project.json.

-  As projects grow, the complexity of this manifest grows (3K+ lines in some projects) making it incomprehensible
-  Due to a lack of transitive dependency, there is considerable duplication of dependencies throughout the manifest file. 
-  Missing dependency is hard to be identified earlier, as scratch orgs in DX@Scale model (scratch orgs typically carry the entire org). Developers only get the feedback on missing package dependency declaration only during a build stage

This has a considerable impact on the developer experience and is one of the most commonly received pain points when operating at scale.

## Options considered

1. Use of multiple sfdx-project.json and merge using pre hooks before any sfdx operation
    
   While this solves the problem with large project manifest file, it  doesnt solve the issue with transitive dependency. Developers still need to identify the exact sequence of parent packages across multiple files.
   
 2. Use of YAML or a less verbose format and provide translator to sfdx-project.json
   
    This solution can reduce the verbosity  when coupled along with an automatic dependency resolver. However this solution improves the maintainability, at the expense of locking into the sfpowercripts plugin. Additional plugins and cli always would require a translated json to be available. sfpowerscripts will have to be constantly updated whenever the cli team updates the sfdx-project.json schema
    
 3. Fill in the gaps in existing sfdx-project.json
 
     An automated depenedency resolver can be used to address the missing dependencies by computing it from the  previous packages. This will be tied into a process enhancement in the build command where packages will be expanded with all the dependencies before being requested for build. In addition two addtional commands will provided such as 'shrink' and 'expand'. Shrink could be used by a developer to generate a concise form of sfdx-project.json with all the transitive dependencies removed. Expand as the name suggest exactly does the reverse. This will reduce the verbosity seen in many projects and allows to maintain fidelity with other tools/plugins
     
## Decision
 
sfpowerscripts will be utilizing option #3 
      
