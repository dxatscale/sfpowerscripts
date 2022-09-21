let utils = require('../services/utils');

function format(entryPoint,metadata,type){

    function datatable(){

        let mtds = metadata.map(md => {
            return {...md};
        });

        source = {};

        source.columns = [
            {field: 'name', header: 'API Name'},
            {field: 'type', header: 'Metadata Type'},
            {field: 'id', header: 'Id'},
            {field: 'usage', header: type === 'deps' ? 'Used by' : 'Uses'},
            {field:'attributes',header:'Attributes'}
        ]
        
        source.data = mtds.map(md => {

            let attributes = '';

            if(md.pills){

                md.pills.forEach(pill => {
                    attributes += `${pill.label}; `
                })
            }

            md.attributes = attributes;

            if(type === 'deps'){
                md.usage = `${entryPoint.name} via ${md.referencedBy.name}`;
            }
            else if(type === 'usage'){
                md.usage =`${entryPoint.name}`;
            }

            return md;
        })

        return source;
    }

    function xml(){

        let mtds = metadata.map(md => {
            return {...md};
        });

        //installed packages cannot be retrieved via the metadata api so we remove them
        mtds = mtds.filter(md => md.type != 'Installed Package');

        let metadataByType = new Map();

        if(type === 'deps'){
            //when we look at what a metadata depends on, we don't need to include dynamic references
            //we do need them when the type is "usage"
            mtds = mtds.filter(dep => !utils.isDynamicReference(dep));
        }

        //for metadata retrieval and deployment, lookup filters are considered custom fields, so we "fix" the type here
        mtds.forEach(dep => {
            if(dep.type.toUpperCase() == 'LOOKUPFILTER'){
                dep.type  = 'CustomField';
            }
        })

        mtds.push(entryPoint);

        if(!entryPoint.options.includeManagedInPackageXml){
            mtds = mtds.filter(md => !md.namespace);
        }

        mtds.forEach(dep => {

            /*if(dep.namespace && !entryPoint.options.includeManagedInPackageXml){
                return;
            }*/

            if(metadataByType.has(dep.type)){
                metadataByType.get(dep.type).add(dep.name);
            }
            else{
                metadataByType.set(dep.type,new Set());
                metadataByType.get(dep.type).add(dep.name);
            }
        });

        return packageXML(metadataByType);

    }

    function excel(){

        let mtds = metadata.map(md => {
            return {...md};
        });

        return sheetFormat(mtds,'excel');

    }

    function csv(){

        let mtds = metadata.map(md => {
            return {...md};
        });

        return sheetFormat(mtds,'csv');

    }

    function sheetFormat(metadata,format){

        let headers = ['Name','Metadata Type','Id','Url'];
        headers.push(type === 'deps' ? 'Used by' : 'Uses')
        headers.push('Attributes');
    
        let dataDelimiter = (format === 'excel' ? '\t' : ',');
        let EOLDelimiter = (format === 'excel' ? '' : ',');
        let newLine = '\r\n';
    
        let file = headers.join(dataDelimiter);
        file += EOLDelimiter;
    
        file += newLine;
    
        metadata.forEach(dep => {
    
            let parts = [];
      
            parts.push(`"${dep.name}"`);
            parts.push(`"${dep.type}"`);
            parts.push(`"${dep.id}"`);
            parts.push(`"${dep.url}"`);
    
            if(type === 'deps'){
                parts.push(`"${entryPoint.name} via ${dep.referencedBy.name}"`);
            }
            else if(type === 'usage'){
                parts.push(`"${entryPoint.name}"`);
            }

            if(dep.pills){

                let attributes = '';

                dep.pills.forEach(pill => {
                    attributes += `${pill.label}; `
                })

                parts.push(`"${attributes}"`);
            }
    
            let row = parts.join(dataDelimiter);
            row += EOLDelimiter;
    
            file += row + newLine;
        });
    
        if(format === 'csv'){
            file = file.substring(0,file.length-3);//remove the last comma
        }
    
        return file;
    
    }

    function packageXML(metadataByType){

        let xmlTop = `<?xml version="1.0" encoding="UTF-8"?>
        <Package xmlns="http://soap.sforce.com/2006/04/metadata">`;

        let typesXml = '';

        for(let [type,members] of metadataByType){

            let xmlAllMembers = '';

            if(members.size > 0){

                let membersArray = Array.from(members);
                membersArray.sort();

                membersArray.forEach(m => {

                    let xmlMember = `<members>${m}</members>`
                    xmlAllMembers += xmlMember;
        
                });
        
                xmlAllMembers += `<name>${type}</name>`
        
                let xmlTypeMembers = `<types>${xmlAllMembers}</types>`;
                typesXml += xmlTypeMembers;
            } 
        }

        let xmlBotton = `<version>49.0</version>
        </Package>`

        let allXml = xmlTop+typesXml+xmlBotton;

        return allXml;
    }

    return {csv,excel,xml,datatable};

}

module.exports = format;