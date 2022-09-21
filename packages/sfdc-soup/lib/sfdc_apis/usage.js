let {restAPI,reportsAPI} = require('sfdc-happy-api')();
let utils = require('../services/utils');
let stats = require('../services/stats');
let format = require('../services/fileFormats');
const logError = require('../services/logging');
const strip = require('strip-comments');



function usageApi(connection,entryPoint,cache){


    let restApi = restAPI(connection,logError);
    let {options} = entryPoint;

    async function getUsage(){


        let query = usageQuery(entryPoint);
        await query.exec();
        let callers = query.getResults();

        if(lacksDependencyApiSupport(entryPoint)){
            let additionalReferences = await seachAdditionalReferences(connection,entryPoint,cache);
            callers.push(...additionalReferences);
        }
            
        callers = await enhanceData(callers);
        
        //some callers will have a specific sortOrder property 
        //defined by one of the private functions in enhanceData
        //this determines the order in which the items should be displayed
        //in the UI.
        //for those elements that don't have a specific sortOrder, we
        //just sort them alphabetically
        let unsortedCallers = [];
        let sortedCallers = [];

        callers.forEach(caller => {
            if(caller.sortOrder){
                sortedCallers.push(caller);
            }
            else{
                unsortedCallers.push(caller);
            }
        })

        //sort alphabetically
        unsortedCallers.sort((a,b) => (a.name > b.name) ? 1 : -1 );

        sortedCallers.push(...unsortedCallers);
        callers = sortedCallers;

        

        let files = format(entryPoint,callers,'usage');

        let csv = files.csv();
        let excel = files.excel();
        let packageXml = files.xml();
        let datatable = files.datatable();

        let usageTree = createUsageTree(callers);
        let statsInfo = stats(callers);

        return{
            packageXml,
            usageTree,
            stats:statsInfo,
            entryPoint,
            csv,
            excel,
            datatable
        }    

    }

    function usageQuery(entryPoint){

        let result = [];

        async function exec(){
            

            if(requiresCustomCode(entryPoint.type)){
                result = await findReferencesManually(entryPoint);
            }
            else{
                let soqlQuery = createUsageQuery(entryPoint.id);
                let rawResults = await restApi.query(soqlQuery);
                result = simplifyResults(rawResults);
            }
        }

        return {
            exec,
            getResults(){
                return result;
            }
        }

    }

    async function enhanceData(metadataArray){

        let validationRules = [];
        let customFields = [];
        let layouts = [];
        let lookupFilters = [];
        let apexClasses = [];
        let reports = [];
        let flows = [];
        let otherMetadata = [];

        metadataArray.forEach(metadata => {

            //make sure every metadata item has a pills property that we can add values
            //to later
            if(!metadata.pills){
                metadata.pills = [];
            }
            
            let {type} = metadata;

            type = type.toUpperCase();

            if(type == 'CUSTOMFIELD'){
                metadata.name += '__c';
                customFields.push(metadata);
            }
            else if(type == 'VALIDATIONRULE'){
                validationRules.push(metadata);
            }
            else if(type == 'LAYOUT'){ 
                layouts.push(metadata);
            }
            else if(type == 'LOOKUPFILTER'){ 
                lookupFilters.push(metadata);
            }
            else if(type == 'FLOW'){ 
                flows.push(metadata);
            }
            //for the following metadata types, we only need to enhance their data when the entry point is 
            //a custom field, this is because fields can be used by these metadata types in different ways
            //for example a field can be used in a report for its filter conditions or only for viewing 
            else if(['CUSTOMFIELD','STANDARDFIELD'].includes(entryPoint.type.toUpperCase()) && type == 'APEXCLASS'){
                    apexClasses.push(metadata);   
            }

            else if(entryPoint.type.toUpperCase() == 'CUSTOMFIELD' && type == 'REPORT'){
                reports.push(metadata);
            }

            else{
                otherMetadata.push(metadata);
            }
        });

        if(customFields.length){

            try {
                customFields = await addParentNamePrefix(customFields,'TableEnumOrId');
            } catch (error) {
                logError('Error while adding parentNamePrefix to custom fields',{error,customFields});
            }

        }
        if(validationRules.length && entryPoint.type.toUpperCase() != 'STANDARDFIELD' ){//for standard fields the custom code already populates the prefix
            /**
             * Only the version 33.0 of the tooling API supports the TableEnumOrId column on the ValidationRule object. On higher versions
             * only the EntityDefinitionId is available but this returns the 15 digit Id of the object, whereas everywhere else in the API
             * the 18 digit version is returned.
             * 
             * So here we force the API call to be made against the 33.0 version so that we can use the 18 digit TableEnumOrId
             */
            try {
                validationRules = await addParentNamePrefix(validationRules,'TableEnumOrId','33.0');
            } catch (error) {
                logError('Error while adding parentNamePrefix to validation rules',{error,validationRules});
            }
            
        }

        if(layouts.length){

            try {
                layouts = await addParentNamePrefix(layouts,'TableEnumOrId');
            } catch (error) {
                logError('Error while adding parentNamePrefix to page layouts',{error,layouts});
            }
        }

        if(lookupFilters.length){

            try {
                lookupFilters = await getLookupFilterDetails(lookupFilters);
            } catch (error) {
                logError('Error while getting lookup filter details',{error,lookupFilters});
            }
            
        }
        if(apexClasses.length){

            try {
                apexClasses = await getFieldInfoForClass(apexClasses);
            } catch (error) {
                logError('Error while getting field info for apex classes',{error,apexClasses});
            }
            
        }
        if(reports.length){

            try {
                reports = await getFieldInfoForReport(reports);
            } catch (error) {
                logError('Error while getting field info for reports',{error,reports});
            }
            
        }
        if(flows.length){

            try {
                flows = await getFlowVersionAndStatus(flows);
            } catch (error) {
                logError('Error while getting flow version info',{error,flows});
            }
            
        }

        otherMetadata.push(...customFields);
        otherMetadata.push(...validationRules);
        otherMetadata.push(...layouts);
        otherMetadata.push(...lookupFilters);
        otherMetadata.push(...apexClasses);
        otherMetadata.push(...reports);
        otherMetadata.push(...flows);

        return otherMetadata;

    }

    /**
     * 
     * When a field is used in a flow, the API returns all the flow versions.
     * It's difficult to tell which version is active and which version you are actually
     * looking at because the version number is not included in the name
     * Here we query the flow details so that we can display their version and status in the UI 
     */
    async function getFlowVersionAndStatus(flows){

        let ids = utils.filterableId(flows.map(f => f.id));
        let query = `SELECT Id, VersionNumber, Status,ProcessType FROM flow WHERE Id IN ('${ids}')`;
        let soql = {query,filterById:true,useToolingApi:true};

        let results = await restApi.query(soql);

        let flowInfoById = new Map();
    
        results.records.forEach(rec => {
            let flowInfo = {version:rec.VersionNumber,status:rec.Status,type:rec.ProcessType};
            flowInfoById.set(rec.Id,flowInfo);
        });

        flows.forEach(flow => {

            let flowInfo = flowInfoById.get(flow.id);

            if(flowInfo){

                flow.pills.push({
                    //flows that are actually process builders are known as 'workflows' but because
                    //this is confusing, we rename the type here to process builder
                    label:`Type: ${flowInfo.type == 'Workflow' ? 'Process Builder' : flowInfo.type}`,
                    type:'standard',
                    description:'The flow metadata type represents both processes and flows'
                });

                if(flowInfo.status == 'Active'){
                    flow.pills.push({
                        label:`version ${flowInfo.version} - Active`,
                        type:'success',
                        description:'Flows can have multiple versions, this is the active one and the one most likely impacted by any changes'
                    });
                }
                else{
                    flow.pills.push({
                        label:`version ${flowInfo.version} - ${flowInfo.status}`,
                        type:'standard',
                        description:'Flows can have multiple versions, this one is deactivated'
                    });
                }

                
            }
        });

        return flows;
    }

    /**
     * We know that the field is referenced in these reports, but is it
     * used for filtering conditions or just for visualization? We determine that here by 
     * checking the report metadata against the analytics API 
     */
    async function getFieldInfoForReport(reports){

        //exist early and return the original report objects if the
        //client side did not enable this option
        if(!options.enhancedReportData) return reports;

        //because the report API only allows for querying one report
        //at a time, we need to limit the amount of reports we can query 
        //in a single transaction to protect performance for both the app
        //server and the salesforce instance (i.e too many api calls
        //result in ECONNREFUSED ERRORS)
        //so the enhanced report data is only available on the first 100 reports
        const MAX_REPORT_COUNT = 100;

        let includedReports = [];
        let excludedReports = [];

        for (let index = 0; index < reports.length; index++) {
            if(index < MAX_REPORT_COUNT){
                includedReports.push(reports[index]);
            }
            else{
                excludedReports.push(reports[index]);
            }
        }

        let reportsApi = reportsAPI(connection,logError);

        let ids = includedReports.map(r => r.id);
        let reportsMetadata = await reportsApi.getReportsMetadata(ids);

        let reportsMetadataById = new Map();
    
        reportsMetadata.records.forEach(rep => {

            //when the data is accessible to the running user, the response comes 
            //as a single json object
            //if the report is in a private folder, the response comes in an array format
            if(!Array.isArray(rep)){
                if(rep) reportsMetadataById.set(rep.attributes.reportId,rep);
            }
        });

        let fullFieldName = entryPoint.name;

        includedReports.forEach(report => {

            let reportMetadata = reportsMetadataById.get(report.id);

            if(reportMetadata){
                //if the report has groupings and one of the groupings uses the field in question
                if(reportMetadata.reportExtendedMetadata.groupingColumnInfo && reportMetadata.reportExtendedMetadata.groupingColumnInfo[fullFieldName]){
                    report.pills.push({
                        label:'Grouping',
                        type:'warning',
                        description:'This report is using this field to group rows. Changes to this field could impact the report grouping'
                    });
                    report.sortOrder = 2;
                }

                //if the report has filters and uses the field as a filter criteria
                if(reportMetadata.reportMetadata.reportFilters){
                    reportMetadata.reportMetadata.reportFilters.forEach(filter => {
                        if(filter.column == fullFieldName){
                            report.pills.push({
                                label:`Filter: ${filter.operator} ${filter.value}`,
                                type:'warning',
                                description:'This report is using this field to filter the records shown. If you make changes to the value of this field, the data set in the report will be impacted'
                            });
                            report.sortOrder = 1;
                        }
                    })
                }
            }
            else{
                //if there isn't a match here is because the response for this report
                //came in an array format, which means that the report is in a private folder
                //and its metadata is not available to the running user
                report.pills.push({
                    label:'Unavailable - Report is in private folder',
                    type:'info',
                    description:'This report is in a users private folder so we are unable to inspect its metadata'
                });
                report.sortOrder = 4;
            }

            //if we reach this point and there are no pills on this report, it means that the report
            //is accessible, but the field in question is not used for filtering or grouping
            //it is only used for view
            if(report.pills.length < 1){
                report.pills.push({
                    label:'View only',
                    type:'success',
                    description:'The field is being used as a report column. Changes to the field will have little impact on the report'
                });
                report.sortOrder = 3;
            }
        });

        excludedReports.forEach(report => {
            report.pills.push({
                label:'Not Calculated - Too many reports',
                type:'standard',
                description:'There more than 100 reports using this field so we are unable to analyze this report'
            });
            report.sortOrder = 5;
        });

        let allReports = [...includedReports,...excludedReports];
        allReports.sort((a,b) => (a.sortOrder > b.sortOrder) ? 1 : -1 );

        return allReports;

    }

    /**
     * We know that the field is referenced in this class, but is it
     * used for reading or assignment? We determine that here by checking
     * if the field is used in an assignment expression in the body of the class
     */
    async function getFieldInfoForClass(apexClasses){

        //i.e field_name__c without the object prefix
        let refCustomField = entryPoint.name.split('.')[1];

        /**
         * This matches on custom_field__c = but it does NOT match
         * on custom_field__c == because the latter is a boolean exp
         * and we are searching for assignment expressions
         * gi means global and case insensitive search
         */
        let assignmentExp = new RegExp(`${refCustomField}=(?!=)`,'gi');

        let ids = apexClasses.map(ac => ac.id);
        ids = utils.filterableId(ids);

        let query = `SELECT Id,Name,Body FROM ApexClass WHERE Id IN ('${ids}')`;
        let soqlQuery = {query,filterById:true,useToolingApi:true};
    
        let results = await restApi.query(soqlQuery);

        let classBodyById = new Map();
    
        results.records.forEach(rec => {
            classBodyById.set(rec.Id,rec.Body);
        });

        
        apexClasses.forEach(ac => {

            let body = classBodyById.get(ac.id);
            if(body){
               
                //remove comments to prevent false positives
                //try/catch because this being a 3rd party library
                //we don't know when it can throw errors
                //so if there's an error we just proceed
                //to read the class with its comments
                //which is better than throwing an error
                //to the user
                try {
                    body = strip(body);
                } catch (error) {
                    //move on
                }

                //remove all white space/new lines
                body = body.replace(/\s/g,'');

                if(body.match(assignmentExp)){
                    ac.pills.push({
                        label:'write',
                        type:'warning',
                        description:'The apex classes writes data into the field. Changes to the field may not impact the class but the value on records is influenced by this class'
                    });
                    ac.sortOrder = 1;
                }
                else{
                    ac.pills.push({
                        label:'read',
                        type:'success',
                        description:'The apex classes uses the field only for reading. Changes to the field value can impact branching/decision making logic in the class'
                    })
                    ac.sortOrder = 2;
                }
            }
        });

        apexClasses.sort((a,b) => (a.sortOrder > b.sortOrder) ? 1 : -1 );

        return apexClasses;
    }

    async function getLookupFilterDetails(lookupFilters){

        let metadataRecordToEntityMap = new Map();

        lookupFilters.forEach(lf => {

            /**lookup filters in the metadata component dependency are returned as nf_01I0O000000bSwQUAU_00N3Y00000GcJePUAV, where the first
            id is the object Id and the last one is the lookup field id.

            For standard objects, the format is Account_00N3Y00000GcJePUAV (i.e a 2 part string, as opposed to 3 parts for custom objects)
            */
            let parts = lf.name.split('_');

            let fieldId = parts[parts.length -1];
            let objectId = parts[parts.length -2];

            metadataRecordToEntityMap.set(fieldId,objectId);
            lf.id = fieldId;//point the id to the actual field id, as opposed to the internal lookup filter id
            lf.url = `${connection.url}/${fieldId}`;
        });

        let soqlQuery = createParentIdQuery(Array.from(metadataRecordToEntityMap.keys()),'CustomField','DeveloperName');
        let results = await restApi.query(soqlQuery);

        let developerNamesByFieldId = new Map();
    
        results.records.forEach(rec => {
            developerNamesByFieldId.set(rec.Id,rec.DeveloperName);
        });

        let objectNamesById = await utils.getObjectNamesById(connection,cache);

        lookupFilters.forEach(lf => {

            let fullName;

            let entityId = metadataRecordToEntityMap.get(lf.id);         
            let objectName = objectNamesById.get(entityId);
            let fieldName = developerNamesByFieldId.get(lf.id);
            fieldName += '__c';
        
            //object name is truthy only if the entityId corresponds to a custom object
            //for standard objects, the entityId is the actual object name i.e "Account"
            if(objectName){
                fullName = `${objectName}.${fieldName}`;
            }else{
                fullName = `${entityId}.${fieldName}`;
            }    

            lf.name = fullName;

        });

        return lookupFilters;

    }

    async function addParentNamePrefix(metadataArray,parentIdField,apiVersionOverride){

        let {type} = metadataArray[0];
        let objectPrefixSeparator = (type.toUpperCase() == 'LAYOUT' ? '-' : '.');
        let ids = metadataArray.map(metadata => metadata.id);

        let soqlQuery = createParentIdQuery(ids,type,parentIdField);

        if(apiVersionOverride) soqlQuery.apiVersionOverride = apiVersionOverride;
        let results = await restApi.query(soqlQuery);

        let metadataRecordToEntityMap = new Map();
    
        results.records.forEach(rec => {
            metadataRecordToEntityMap.set(rec.Id,rec[parentIdField]);
        });

        let objectNamesById = await utils.getObjectNamesById(connection,cache);

        metadataArray.forEach(metadata => {

            let fullName;

            let entityId = metadataRecordToEntityMap.get(metadata.id);         
            let objectName = objectNamesById.get(entityId);
        
            //object name is truthy only if the entityId corresponds to a custom object
            //for standard objects, the entityId is the actual object name i.e "Account"
            if(objectName){
                fullName = `${objectName}${objectPrefixSeparator}${metadata.name}`;
            }else{
                fullName = `${entityId}${objectPrefixSeparator}${metadata.name}`;
            }    

            metadata.name = fullName;

            //page layouts have a unique url that requires both the entitiy id and the layout id, so we take advantage
            //that we have already queried this data in this method and build the URL here
            //not the cleanest way but we save a whole roundtrip to the server
            if(type.toUpperCase() == 'LAYOUT'){
                metadata.url = `${connection.url}/layouteditor/layoutEditor.apexp?type=${entityId}&lid=${metadata.id}`;
            }

        });

        return metadataArray;
    }

    function createUsageTree(callers){

        let tree = callers.reduce((result,caller) => {

            if(result[caller.type]){
                result[caller.type].push(caller);
            }
            else{
                result[caller.type] = [caller];
            }

            return result;

        },{});

        return tree;

    }

    /**
     * Some metadata types are not fully supported by the MetadataComponentDependency API
     * so we need to manually query related objects to find dependencies. An example of this is the
     * EmailTemplate object, which is when queried, does not return WorkflowAlerts that reference the template
     */
    function lacksDependencyApiSupport(entryPoint){
        return ['Flow','EmailTemplate','CustomField','ApexClass','CustomObject'].includes(entryPoint.type);
    }

    async function seachAdditionalReferences(connection,entryPoint){

        let additionalReferences = [];

        try {
            //we dynamically import the required module, matching on the metadata type name
            let findReferencesFunction =  require(`./metadata-types/${entryPoint.type}`);
            if(findReferencesFunction){
                additionalReferences = await findReferencesFunction(connection,entryPoint,cache,options);
            }
            
        } catch (error) {
            logError('Error when searching additional references',{entryPoint,error});
        }

        return additionalReferences;

    }


    function simplifyResults(rawResults){

        let callers = rawResults.records.map(caller => {
    
            let simplified = {
                name:caller.MetadataComponentName,
                type:caller.MetadataComponentType,
                id:caller.MetadataComponentId,
                url:`${connection.url}/${caller.MetadataComponentId}`,
                notes:null,
                namespace: caller.MetadataComponentNamespace,       
            }

            return simplified;          
        });

        return callers;
    }
    
    function createParentIdQuery(ids,type,selectFields){

        ids = utils.filterableId(ids);
    
        let query = `SELECT Id, ${selectFields}
        FROM ${type} 
        WHERE Id IN ('${ids}') `;

        return {query,filterById:true,useToolingApi:true};

    }

    
    
    function createUsageQuery(id){

        let query = `SELECT MetadataComponentId, MetadataComponentName,MetadataComponentType,MetadataComponentNamespace, RefMetadataComponentName, RefMetadataComponentType, RefMetadataComponentId,
        RefMetadataComponentNamespace 
        FROM MetadataComponentDependency 
        WHERE RefMetadataComponentId  = '${id}' ORDER BY MetadataComponentType`;

        return {query,filterById:true,useToolingApi:true};

    }

    async function findReferencesManually(entryPoint){

        let callers = [];

        //we dynamically import the required module, matching on the metadata type name
        let findReferencesFunction =  require(`./metadata-types/${entryPoint.type}`);
        if(findReferencesFunction){
            callers = await findReferencesFunction(connection,entryPoint,cache,options);
        }

        return callers;
    }

    return {getUsage}
}

function getColor(color){

    //default grey color
    let hex = '#7f766c';

    if(color == 'red'){
        hex = '#d63031';
    }
    else if(color == 'green'){
        hex = '#3c9662';
    }
    else if(color == 'brown'){
        hex = '#925202';
    }
    
    return hex;
}

/**
 * Some metadata types like standard fields are not supported by the MetadataComponentDependency API. For these types, we might
 * have "custom code" that searches for the references manually by inspecting the XML files of other metadata types.
 * Here we store the list of metadata types that require custom code.
 */
function requiresCustomCode(type){

    let types = ['StandardField'];
  
    return types.includes(type);
  
  }



module.exports = usageApi;