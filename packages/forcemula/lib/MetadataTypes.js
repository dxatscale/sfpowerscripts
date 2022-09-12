module.exports = class MetadataType {

    static CUSTOM_FIELD = new MetadataType("customFields")
    static STANDARD_FIELD = new MetadataType("standardFields")
    static CUSTOM_OBJECT = new MetadataType("customObjects")
    static STANDARD_OBJECT = new MetadataType("standardObjects")
    static CUSTOM_LABEL = new MetadataType("customLabels")
    static CUSTOM_SETTING = new MetadataType("customSettings")
    static CUSTOM_METADATA_TYPE_RECORD = new MetadataType("customMetadataTypeRecords")
    static CUSTOM_METADATA_TYPE = new MetadataType("customMetadataTypes")
    static UNKNOWN_RELATIONSHIP = new MetadataType("unknownRelationships")

    constructor(name) {
        this.name = name
    }

}