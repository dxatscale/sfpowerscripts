let {metadataAPI} = require('sfdc-happy-api')();
let logError = require('../services/logging');

/**
 * The metadata component dependency API also returns references to objects that are only known at run time, for example
 * a test class that queries the Profile object to create a test user. The profile object is returned as a dependency
 * but we don't know what profile is actually being used, again, this is only known at run time.
 * 
 * At the time of this writing, you can tell that a reference is dynamic if the id is exactly the same as the name, for example
 * name: 'SlaProcess',
 * type: 'EntitlementProcess',
 * id: 'SlaProcess',
 */
function isDynamicReference(dep){

    let {name,id} = dep;

    if(name && id){
        name = name.toLowerCase();
        id = id.toLowerCase();
        if(id === name){
            return true;
        }
    }

    return false;
}

 /**
 * Uses the Metadata API to get a map of object Ids to object names
 */
async function getObjectNamesById(connection,cache){
    
    let objectsData = await getCustomObjectData(connection,cache);

    let objectsById = new Map();
    
    objectsData.forEach(obj => {
        if(obj.id != ''){
            objectsById.set(obj.id,obj.fullName);
        }
    })

    return objectsById;

}

 /**
     * The reverse of the above
     */
    async function getObjectIdsByName(connection,cache){
        
        let objectsData = await getCustomObjectData(connection,cache);
    
        let objectsByName = new Map();
        
        objectsData.forEach(obj => {
            if(obj.id != ''){
                objectsByName.set(obj.fullName,obj.id);
            }
        })
    
        return objectsByName;
    
    }

async function getCustomObjectData(connection,cache){

    let objectsData = [];

    //used the data in cache if it already exists
    if(cache.getCustomObjects().length){
        objectsData = [...cache.getCustomObjects()];
    }
    else{

        //call the api and cache the data for later use
        let mdapi = metadataAPI(connection,logError);
        objectsData = await mdapi.listMetadata('CustomObject');

        objectsData = objectsData.map(obj => {
            let simplified = {
                id:obj.id,
                fullName:obj.fullName
            };
            return simplified;
        })
        cache.cacheCustomObjects(objectsData);
    }

    return objectsData;
}

/**
 * Takes a list of ids or a single id as a string and formats them in a way that can be used in 
 * SOQL query filters
 */
function filterableId(metadataId){

    let ids = '';

    //allows for the query to filter by either a single id or multiple ids
    if(Array.isArray(metadataId)){

        metadataId.forEach(id => {
            ids += "'"+id+"',"
        })
        //remove the first and last ' (and the last comma) as these are included in the query string 
        ids = ids.substring(1,ids.length-2);
    }else{
        ids = metadataId;
    }

    return ids;

}

function splitInBatchesOf(items,batchSize){

    let remainingItems = items.length;
    let indexSoFar = 0;
    let batches = [];

    while (remainingItems > batchSize) {
        
        let batch = [];

        for (let x = 0; x < batchSize; x++,indexSoFar++) {
            batch.push(items[indexSoFar]);       
        }

        batches.push(batch);
        remainingItems -= batchSize;
    }

    if(remainingItems > 0) batches.push(items.slice(indexSoFar));

    return batches;

}

function findAllValuesByKey(obj,keyToFind){
	
	function reducer(valuesSoFar,[key,value]){

		if(key == keyToFind){
			return valuesSoFar.concat(value);
		}
		else if(typeof value === 'object' && value){
			return valuesSoFar.concat(findAllValuesByKey(value,keyToFind))
		}
		else{
			return valuesSoFar;
		}
	}
	
	return Object.entries(obj).reduce(reducer,[]);
}

module.exports = {isDynamicReference,filterableId,findAllValuesByKey,getObjectNamesById,getObjectIdsByName,splitInBatchesOf}


