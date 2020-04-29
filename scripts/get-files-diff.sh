# Get all files that were changed after push/merge to the target branch

echo "detecting changes for this build"
files=`git diff HEAD HEAD~ --name-only | sort -u | uniq  | sed s/'\s'//g`
changed_files=$files


# Check each file that was changed on each folder to Build
    for dir in $changed_files
    do


      BASE_DIRECTORY=$(echo "$dir" | cut -d "/" -f2)

      echo $BASE_DIRECTORY

        case $BASE_DIRECTORY in	            
          "azpipelines")
              echo "Files changed in AzurePipelines"	 
              echo "##vso[task.setvariable variable=isAzurePipelinesUpdated;isOutput=true]true"
            ;;
          "core")	 
              echo "Files changed in Core"	 
              echo "##vso[task.setvariable variable=isCoreUpdated;isOutput=true]true"
            ;;	
         "sfpowerscripts-cli")	
              echo "Files changed in UI-components"	
              echo "##vso[task.setvariable variable=isCLIUpdated;isOutput=true]true"
            ;; 
        esac
    done