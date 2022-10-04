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

let entryPoint = {
    name:'Account',
    id:'Account',
    type:'Object'
}

let soupApi = sfdcSoup(connection,entryPoint);

async function test(){
    let workflowInfo = await soupApi.getWorkflowInfo();
}

test();

    