const fs = require('fs');
var semver = require("semver");
manifest_json = JSON.parse(fs.readFileSync('task.json'));
json = JSON.parse(fs.readFileSync('package.json', 'utf8'))
console.log("Package",json.name);
console.log("Version to be updated to ",json.version);
manifest_json.version["Major"]=semver.major(json.version);
manifest_json.version["Minor"]=semver.minor(json.version);
manifest_json.version["Patch"]=semver.patch(json.version);
fs.writeFileSync('task.json', JSON.stringify(manifest_json, null, 4));