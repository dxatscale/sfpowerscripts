# Troubleshooting

{% hint style="info" %}
**Error:** InvalidPackageDirectory during validation and deployment tasks
{% endhint %}

<br>
**Stage:** Validation, Build<br>
**Build Task:** Deploy a Source Directory (Source Format) to an Org<br>
**Error Message:** 

```
sfpowerscripts... Deploy Source to Org
Converting source to mdapi
Converting to MDAPI Format force-app in project directory
ERROR running force:source:convert:  InvalidPackageDirectory
Unable to convert source for directory force-app
##[error]Command failed: npx sfdx force:source:convert -r force-app  -d QTcO4_mdapi
ERROR running force:source:convert:  InvalidPackageDirectory

```

**Possible Resolution:** <br>
Check that all your defined packages in `sfdx-project.json` has at least 1 file in the package directory so that the ``sfdx cli`` detects that the package exists and is valid.  During the mdapi conversion process, it will reference the `sfdx-project.json` file before starting to convert the specified package.  

---
