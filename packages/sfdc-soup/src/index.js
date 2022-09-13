
let utils = require('../lib/services/utils');
let {initCache,cacheApi} = require('../lib/services/caching');

function sfdcSoup(connection,entryPoint,cache){

    let validatedParams = validateParams(connection,entryPoint,cache);

    connection = validatedParams.connection;
    entryPoint = validatedParams.entryPoint;
    cache = validatedParams.cache;

    let dependencyApi = require('../lib/sfdc_apis/dependencies');
    let usageApi = require('../lib/sfdc_apis/usage');
    let workflowApi = require('../lib/sfdc_apis/workflowToFlow');

    dependencyApi = dependencyApi(connection,entryPoint,cache);
    usageApi = usageApi(connection,entryPoint,cache);
    workflowApi = workflowApi(connection,entryPoint);

    let {getDependencies} = dependencyApi;
    let {getUsage} = usageApi;
    let {getWorkflowInfo} = workflowApi;

    return {getDependencies,getUsage,getWorkflowInfo};

}



function validateParams(connection,entryPoint,cache){

    //this option is expected by the API and always passed by the web app
    //if the module is being used on its own, the client may choose not to pass this
    //object, but we still instantiate it to avoid null pointer exceptions
    if(!entryPoint.hasOwnProperty('options')){
        entryPoint.options = {}
    }

    if(!entryPoint.id || !entryPoint.name || !entryPoint.type){
        throw new Error('id, name and type are required params on the entryPoint');
    }

    //the id must be 18 chars except if the id and the name are the same
    //which is the case for standard fields
    if((entryPoint.id != entryPoint.name ) && entryPoint.id.length < 18){
        throw new Error('You must use an 18-digit Salesforce id on the entryPoint');
    }

    if(!connection.token || !connection.url){
        throw new Error('Access token and URL are required on the connection object');
    }

    if(connection.apiVersion){

        let parts = connection.apiVersion.split('.');

        if(parts.length < 2){
            throw new Error('The apiVersion must use the following format major.minor, for example 49.0');
        }
        else{
            if(isNaN(parts[0]) || isNaN(parts[1])){
                throw new Error('The apiVersion must use the following format major.minor, for example 49.0');
            }
        }

        connection = validateApiVersion(connection);
    } else {
        // Set default API version
        connection.apiVersion = "50.0";
    }

     //the cache is only used by the sfdc-happy-soup webapp
     if(cache == null || cache == undefined){
        //so if the module is being used by another NPM package, we have
        //to create an in memory cache and validate the parameters
        //these operations would be taken care of by the web app but here
        //we need to perform them manually
        cache = initCache();
        cache = cacheApi(cache);
    }

    return {connection,entryPoint,cache};

}

function validateApiVersion(connection){

    let {apiVersion } = connection;

    if(parseInt(apiVersion) < 49){
        connection.apiVersion = '50.0';
    }

    return connection;
}

module.exports = sfdcSoup;