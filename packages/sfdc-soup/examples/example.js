let sfdcSoup = require('../src/index');
let fs = require('fs');
require('dotenv');

/**
* @token A session id or oauth token with API access
* @url Your instance url i.e login.salesforce.com or mydomain.my.salesforce.com
* @apiVersion the version of the Salesforce API. If not specified or if it's lower than 49.0, we use 50.0 by default
*/
let connection = {
    token:process.env.TOKEN,
    url:process.env.URL,
    apiVersion:'49.0'
};

/**
* @name The API name of the metadata member
* @type The metadata type. It must match the Metadata API naming conventions
* @id The 18-digit id. The 15 digit one will NOT work
*/
let customField = {
    name:'Account.CustomerPriority__c',
    type:'CustomField',
    id:'00N3h00000DdZSIEA3',
}

/**
 * For standard fields, the name and id must be the same, with the format
 * [ObjectName][FieldApiName]
 * The type must be StandardField, even though this is NOT a real metadata type
 * recognised by salesforce.
 */
let standardField = {
    name:'Case.Reason',
    type:'StandardField',
    id:'Case.Reason',
}

let emailTemplate = {
    name:'Marketing: Product Inquiry Response',
    type:'EmailTemplate',
    id:'00X3h000001J53gEAC',
}

let workflowAlert = {
    name:'Account.account_alert',
    type:'WorkflowAlert',
    id:'01W3h000000lqaAEAQ'
}

let apexClass = {
    name:'ManagedClass',
    id:'01p8F0000008ZkWQAU',
    type:'ApexClass'

}

let apexClassBoundary = {
    name:'LeadTrigger',
    id:'01q3h000000l7quAAA',
    type:'ApexTrigger'
}

let flow = {
    name:'Flow_using_field',
    id:'3013Y000000VFB5QAO',
    type:'Flow'
}


async function test(){

    let soupApi = sfdcSoup(connection,customField);

    usageResponse = await soupApi.getUsage();
    //let dependencyResponse = await soupApi.getDependencies();

    //console.log(usageResponse.datatable)

    fs.writeFileSync('examples/usage.json',JSON.stringify(usageResponse.usageTree));
   //fs.writeFileSync('examples/usage.csv',usageResponse.csv);

    //fs.writeFileSync('examples/dependencies.json',JSON.stringify(dependencyResponse.dependencyTree));
    /*fs.writeFileSync('examples/dependencies.csv',dependencyResponse.excel);*/

}

test();

