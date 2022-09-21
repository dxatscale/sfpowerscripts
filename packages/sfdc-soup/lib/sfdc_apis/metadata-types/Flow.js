let {restAPI,metadataAPI} = require('sfdc-happy-api')();
const logError = require('../../services/logging');
let utils = require('../../services/utils');

async function findReferences(connection,entryPoint,cache,options){

    let flowName = entryPoint.name;

    let references = [];
    let mdapi = metadataAPI(connection,logError);
    let restApi = restAPI(connection,logError);

    let allMetadata = [];

    try {
        let quickActions = await getQuickActions();
        allMetadata.push(...quickActions);
    } catch (error) {
        logError('Error while searching for quick actions that use flows',{entryPoint,error})
    }


    try {
        let buttons = await getButtons();
        allMetadata.push(...buttons);
    } catch (error) {
        logError('Error while searching for buttons that use flows',{entryPoint,error})
    }

    try {
        let flows = await getFlows();
        allMetadata.push(...flows);
    } catch (error) {
        logError('Error while searching for flows that use flows',{entryPoint,error})
    }


    let metadataByType = await restApi.readMetadata(allMetadata);

    metadataByType.forEach((members,type) => {

        if(type == 'QuickActionDefinition'){

            members.forEach(quickAction => {

                let {Metadata} = quickAction;
    
                if(Metadata.type == 'Flow' && Metadata.flowDefinition == flowName){
    
                    let simplified = {
                        name:quickAction.FullName,
                        type:type,
                        id:quickAction.Id,
                        url:`${connection.url}/${quickAction.Id}`,
                        notes:null,
                        namespace: quickAction.NamespacePrefix,       
                    }
    
                    references.push(simplified);
                }
            })
        }

        else if(type == 'Flow'){

            members.forEach(flow => {

                //If the flow is part of a managed package this field will be Null
                if(flow.Metadata){

                    let subFlows = utils.findAllValuesByKey(flow.Metadata,'flowName');

                    if(subFlows.includes(flowName)){
    
                        let simplified = {
                            name:flow.FullName,
                            type:type,
                            id:flow.Id,
                            url:`${connection.url}/${flow.Id}`,
                            notes:null,
                            namespace: null,       
                        }
        
                        references.push(simplified);    
                    }
                }
            })
        }

        else if(type == 'WebLink'){

            members.forEach(button => {

                if(button.Url.includes(flowName)){

                    let simplified = {
                        name:button.FullName,
                        type:type,
                        id:button.Id,
                        url:`${connection.url}/${button.Id}`,
                        notes:null,
                        namespace: null,       
                    }
    
                    references.push(simplified);

                }

            })

        }
    })

    return references;

    async function getQuickActions(){ 

        let query = `SELECT DeveloperName, Id FROM QuickActionDefinition WHERE Type = 'Flow'`;
        let soql = {query,filterById:false,useToolingApi:true};

        let rawResults = await restApi.query(soql);

        let quickActions = rawResults.records.map(record => {
            return {
                id:record.Id,
                type:'QuickActionDefinition'
            }
        });

        return quickActions;
    }

    async function getFlows(){

        let query = `SELECT  Id FROM Flow WHERE ProcessType = 'Flow' AND Status = 'Active'`;
        let soql = {query,filterById:false,useToolingApi:true};

        let rawResults = await restApi.query(soql);

        let flows = rawResults.records.map(record => {
            return {
                id:record.Id,
                type:'Flow'
            }
        });

        return flows;
    }

    async function getButtons(){

        let query = `SELECT Id FROM WebLink WHERE LinkType = 'url' `;
        let soql = {query,filterById:false,useToolingApi:true};

        let rawResults = await restApi.query(soql);

        let buttons = rawResults.records.map(record => {
            return {
                id:record.Id,
                type:'WebLink'
            }
        });

        return buttons;
    }

    /flow/
}

module.exports = findReferences;