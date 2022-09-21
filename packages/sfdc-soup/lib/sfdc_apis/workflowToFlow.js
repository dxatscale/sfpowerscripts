let {restAPI} = require('sfdc-happy-api')();
let utils = require('../services/utils');
const logError = require('../services/logging');
const parse = require('@dxatscale/forcemula');

function workflowApi(connection,entryPoint,cache){

    let restApi = restAPI(connection,logError);

    async function getWorkflowInfo(){

        let soql = {
            query : `SELECT Id,Name FROM WorkflowRule WHERE TableEnumOrId = '${entryPoint.name}'`,
            useToolingApi:true
        }

        let rawResults = await restApi.query(soql);

        let workflowRules = rawResults.records.map(record => {

            return {
                id:record.Id,
                type:'WorkflowRule'
            }
        });

        let metadataByType = await restApi.readMetadata(workflowRules);

        if(metadataByType.size == 0) return 'This object does not have any workflow rules'

        let workflowInfos = [];
        let allActions = [];

        metadataByType.forEach((members,type) => {

            members.forEach(workflow => {

                let {Metadata} = workflow;

                let workflowInfo = {
                    fieldsUsedInCriteria :[],
                    id: workflow.Id,
                    name: workflow.FullName,
                    active: Metadata.active,
                    type: Metadata.triggerType,
                    actions: [],
                    timeBasedActions : [],
                    criteria:''
                }

                if(Metadata.formula){

                        workflowInfo.criteria = Metadata.formula;
                    
                        let parseReq = {
                            object : entryPoint.id,
                            formula: Metadata.formula
                        }

                        let result = parse(parseReq);
                       
                        if(result.customFields) workflowInfo.fieldsUsedInCriteria.push(...result.customFields)  
                        if(result.standardFields) workflowInfo.fieldsUsedInCriteria.push(...result.standardFields)    
                }
            
                else if(Metadata.criteriaItems){

                    let allCriteriaText = [];
    
                    if(Array.isArray(Metadata.criteriaItems)){

                        Metadata.criteriaItems.forEach(criteria => {
                            
                            let singleCriteria = `${criteria.field} ${criteria.operation} ${criteria.value}`;
                            allCriteriaText.push(singleCriteria);

                            workflowInfo.fieldsUsedInCriteria.push(criteria.field)   
                        });

                       
                    }

                    else{
                        let singleCriteria = `${workflow.criteriaItems.field} ${workflow.criteriaItems.operation} ${workflow.criteriaItems.value}`;
                        allCriteriaText.push(singleCriteria);
                        workflowInfo.fieldsUsedInCriteria.push(workflow.criteriaItems.field)    
                    }

                    workflowInfo.criteria = allCriteriaText.join(' ; ');
                   
                }

                Metadata.actions?.forEach(action => {
                    allActions.push(action);
                    workflowInfo.actions.push(action)
                })

                Metadata.workflowTimeTriggers?.forEach(tt => {

                    tt.actions?.forEach(action => {
                        allActions.push(action);
                        workflowInfo.timeBasedActions.push(action);
                    })

                })

                workflowInfos.push(workflowInfo)
            })
        })

        let allFieldUpdates = await getRelatedMetadata('WorkflowFieldUpdate');
        let allEmailAlerts = await getRelatedMetadata('WorkflowAlert');
        let allOBmessages = await getRelatedMetadata('WorkflowOutboundMessage');

        for (let index = 0; index < workflowInfos.length; index++) {

            const wfInfo = workflowInfos[index];

            wfInfo.actions?.forEach(action => {
                getMetadata(action); 
            })

            wfInfo.timeBasedActions?.forEach(action => {
                getMetadata(action);  
            })
        }

        function getMetadata(action){

            if(action.type == 'Task') return;

            let metadataMap;

            if(action.type == 'FieldUpdate'){
                metadataMap = allFieldUpdates;
            }
            else if(action.type == 'Alert'){
                metadataMap = allEmailAlerts;
            }

            else if(action.type == 'OutboundMessage'){
                metadataMap = allOBmessages;
            }

            let actionMetadata = metadataMap.get(action.name);

            if(actionMetadata){
                action.metadata = actionMetadata;
            }
        }

        let outputs = workflowInfos.map(wf => {

            let {name,id,active,type,fieldsUsedInCriteria,criteria} = wf;

            let output = {
                name,
                id,
                active,
                type,
                criteria,
                hasFieldUpdates:false,
                hasEmailAlerts:false,
                hasTasks:false,
                hasOutboundMessages:false,
                hasTimeBasedActions: wf.timeBasedActions.length ? true : false,
                fieldsUsedInCriteria,
                fieldsUsedInAction: new Set(),
                fieldsBeingUpdated:[],
                emailTemplatesUsed: new Set(),
                emailsSentTo: new Set(),
                endpointUrls:new Set()
            }

            let allActions = [...wf.actions,...wf.timeBasedActions];

            allActions.forEach(action => {

                let {metadata} = action;

                if(action.type == 'Task'){
                    output.hasTasks = true;
                }
                else if(action.type == 'OutboundMessage'){
                    
                    output.hasOutboundMessages = true;
                    let fields = Array.isArray(metadata.fields) ? metadata.fields : [metadata.fields];
                    output.fieldsUsedInAction.add(...fields);
                    output.endpointUrls.add(metadata.endpointUrl);
                }
                else if(action.type == 'FieldUpdate'){

                    output.hasFieldUpdates = true;
                    output.fieldsUsedInAction.add(metadata.field);

                    let fieldUpdateText = `Updating ${metadata.field} to `;
                    let value;

                    if(metadata.operation == 'Null'){
                        value = 'a blank value';
                    }

                    if(metadata.formula){
                        value = `${metadata.formula} (formula)`;
                    }
                    else if(metadata.literalValue){
                        value = metadata.literalValue;
                    }
                    else if(metadata.lookupValue){
                        value = metadata.lookupValue;
                    }

                    fieldUpdateText += value;

                    output.fieldsBeingUpdated.push(fieldUpdateText);

                }
                else if(action.type == 'Alert'){
                    output.hasEmailAlerts = true;
                    output.emailTemplatesUsed.add(metadata.template);
                    
                    if(metadata.ccEmails.length){
                        output.emailsSentTo.add(...metadata.ccEmails);
                    }

                    metadata.recipients?.forEach(recipient => {

                        if(recipient.type == 'user'){
                            
                            output.emailsSentTo.add(recipient.recipient);
                        }
                        else if(recipient.type == 'email'){
                            output.fieldsUsedInAction.add(recipient.field);
                        }

                    })
                }


            })

        return output;

        })

        return sheetFormat(outputs,'csv');
    }

    async function getRelatedMetadata(type){

        let soql = {
            query : `SELECT Id FROM ${type}`,
            useToolingApi:true
        }

        let rawResults = await restApi.query(soql);

        let recordIDs = rawResults.records.map(record => {

            return {
                id:record.Id,
                type
            }
        });

        let metadataByType = await restApi.readMetadata(recordIDs);

        let metadataByName = new Map();

        metadataByType.forEach((members,type) => {

            members.forEach(m => {

                let indexName = m.FullName.split('.')[1];
                let simplified = {
                    ...m.Metadata,
                    id:m.Id,
                }

                metadataByName.set(indexName,simplified);
            })
        })

        return metadataByName;
    }

    

    return {getWorkflowInfo};

}

function sheetFormat(workflows,format){

    let headers = Object.keys(workflows[0]);

    let dataDelimiter = (format === 'excel' ? '\t' : ',');
    let EOLDelimiter = (format === 'excel' ? '' : ',');
    let newLine = '\r\n';

    let file = headers.join(dataDelimiter);
    file += EOLDelimiter;

    file += newLine;

    workflows.forEach(wf => {

        let keys = Object.keys(wf);

        let parts = [];

        keys.forEach(key => {

            let value = wf[key];

            if(typeof value == 'object' || Array.isArray(value)){
                value = Array.from(value).join(';');
            }
         
            parts.push(`"${value}"`);

        })

        let row = parts.join(dataDelimiter);
        row += EOLDelimiter;

        file += row + newLine;
    });

    if(format === 'csv'){
        file = file.substring(0,file.length-3);//remove the last comma
    }

    return file;
}

module.exports = workflowApi;