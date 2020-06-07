// parse command line options 
var minimist = require("minimist");
var mopts = {
  string: ["version", "stage", "taskId", "organization", "buildNumber"],
  boolean: ["public"]
};

var options = minimist(process.argv, mopts);

// remove well-known parameters from argv before loading make
process.argv = options._;

// modules
var shell = require("shelljs");
var make = require("shelljs/make");
var path = require("path");
var os = require("os");
var cp = require("child_process");
var fs = require("fs");
var semver = require("semver");
var rimraf = require("rimraf");


// global paths
var sourcePath = path.join(__dirname, "BuildTasks");
var widgetsPath = path.join(__dirname, "Widgets");
var binariesPath = path.join(__dirname, "build");
var packagesPath = path.join(__dirname, "dist");



// make targets
target.clean = function() {
  console.log("clean: cleaning binaries");

  shell.rm("-Rf", binariesPath);
  shell.mkdir("-p", binariesPath);
};

target.copy = function() {
  target.clean();

  //copy directory
  var taskOutputPath = path.join(binariesPath, "BuildTasks");

  console.log("copy: copy task");
  copyRecursiveSync(sourcePath, taskOutputPath);



  console.log("copy: copy assets");


  // rimraf.sync(taskOutputPath + "/**/**/*.ts");

  // copy external modules
  console.log("build: copying externals modules");
  // getExternalModules(binariesPath);

  // copy resources
  console.log("build: copying resources");
  ["README.md", "LICENSE.txt", "tsconfig.json", "vss-extension.json","package.json"].forEach(
    function(file) {
      shell.cp("-Rf", path.join(__dirname, file), binariesPath);
      console.log("  " + file + " -> " + path.join(binariesPath, file));
    }
  );

  shell.cp("-Rf", path.join(__dirname, "*.png"), binariesPath);
  console.log("  images copied");
};

target.incrementversion = function() {
  //Reading current versions from manifest
  var manifestPath = path.join(__dirname, "vss-extension.json");
  var manifest = JSON.parse(fs.readFileSync(manifestPath));

  if (options.stage === "dev" || options.stage === "review") {
    var ref = new Date(2000, 1, 1);
    var now = new Date();
    var major = semver.major(manifest.version);
    var minor = Math.floor((now - ref) / 86400000);
    var patch = Math.floor(
      Math.floor(
        now.getSeconds() + 60 * (now.getMinutes() + 60 * now.getHours())
      ) * 0.5
    );
    options.version = major + "." + minor + "." + patch;
    options.public = false;
  } else {
    //Treat patch as the build number, let major and minor be developer controlled
    var major = semver.major(manifest.version);
    var minor = semver.minor(manifest.version);
    options.version = major + "." + minor + "." + options.buildNumber;
  }
  updateExtensionManifest(binariesPath, options);
  updateExtensionManifest(__dirname, options);
};

target.publish = function() {
  console.log("publish: publish task");

  var manifestPath = path.join(__dirname, "vss-extension.json");
  var manifest = JSON.parse(fs.readFileSync(manifestPath));


  console.log(options);

  if (options.stage == "prod") {
    shell.exec(
      'tfx extension publish --vsix "' +
        packagesPath +
        "/AzlamSalam.sfpowerscripts-" +
        manifest.version +
        '.vsix"' +
        " --token " +
        options.token
    );
  } else {
    shell.exec(
      'tfx extension publish --vsix "' +
        packagesPath +
        "/AzlamSalam.sfpowerscripts-" +
        options.stage +
        "-" +
        manifest.version +
        '.vsix"' +
        " --share-with " +
        options.organization +
        " --token " +
        options.token +
        " --trace-level debug"
    );
  }
};

updateExtensionManifest = function(dir, options) {
  var version = "";
  console.log(`Setting Version to  ${options.version}`);

  var manifestPath = path.join(dir, "vss-extension.json");
  var manifest = JSON.parse(fs.readFileSync(manifestPath));

  if (options.stage == "dev") {
    manifest.version = options.version;
    manifest.id = "sfpowerscripts" + "-" + "dev";
    manifest.name = "sfpowerscripts" + " (" + "dev" + ")";
    manifest.public = false;
    manifest.baseUri = "https://localhost:3000/build/";
    version = options.version;
  } else if (options.stage == "review") {
    manifest.version = options.version;
    manifest.id = "sfpowerscripts" + "-" + "review";
    manifest.name = "sfpowerscripts" + " (" + "review" + ")";
    manifest.public = false;
    version = options.version;
  } else if (options.stage == "alpha") {
    manifest.version = options.version;
    manifest.id = "sfpowerscripts" + "-" + "alpha";
    manifest.name = "sfpowerscripts" + " (" + "alpha" + ")";
    manifest.public = false;
    version = options.version;
  } 
   else if (options.stage == "beta") {
    manifest.version = options.version;
    manifest.id = "sfpowerscripts" + "-" + "beta";
    manifest.name = "sfpowerscripts" + " (" + "beta" + ")";
    manifest.public = false;
    version = options.version;
  } 
  else if (options.stage == "uat") {
    manifest.version = options.version;
    manifest.id = "sfpowerscripts" + "-" + "uat";
    manifest.name = "sfpowerscripts" + " (" + "uat" + ")";
    manifest.public = false;
    version = options.version;
  }
  else {
    manifest.id = "sfpowerscripts";
    manifest.name = "sfpowerscripts";
    manifest.public = true;
    version = options.version;
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));
  console.log("Calculated Version " + version);
  return version;
};


copyRecursiveSync = function(src, dest) {
  var exists = fs.existsSync(src);
  if (exists) {
    var stats = fs.statSync(src);
    var isDirectory = stats.isDirectory();
    if (isDirectory) {
      exists = fs.existsSync(dest);
      if (!exists) {
        fs.mkdirSync(dest);
      }
      fs.readdirSync(src).forEach(function(childItemName) {
        copyRecursiveSync(
          path.join(src, childItemName),
          path.join(dest, childItemName)
        );
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }
};
