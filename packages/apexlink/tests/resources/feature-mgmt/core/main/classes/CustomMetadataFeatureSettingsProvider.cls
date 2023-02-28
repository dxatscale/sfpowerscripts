/**
 * @description Feature Settings Provider that returns Feature Settings
 * from the FeatureSetting__mdt Custom Metadata
 */
public class CustomMetadataFeatureSettingsProvider implements FeatureSettingsProvider {
    /**
     * @description Returns Feature Setting Object by Feature Name
     *  if not found should return null
     * @param featureName
     * @return Feature Setting Object null if not found
     */
    public FeatureSetting getFeatureSettingByName(String featureName) {
        FeatureSetting__mdt featureSettingMetadata = FeatureSetting__mdt.getInstance(
            featureName
        );

        if (featureSettingMetadata == null) {
            return null;
        }

        return new FeatureSetting(
            featureName,
            featureSettingMetadata?.Implementation__c
        );
    }
}
