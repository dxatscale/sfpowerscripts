/**
 * @description Feature Implementation that uses a global
 * custom metadata flag.
 */
public class CustomMetadataEnabledFeature implements Feature {
    /**
     * @description checks if the feature has been enabled via
     * a custom metadata flag
     *
     * @param featureName
     * @return true if enabled
     */
    public Boolean isEnabled(String featureName) {
        FeatureFlag__mdt feature = FeatureFlag__mdt.getInstance(featureName);

        if (feature == null) {
            return false;
        }

        return feature.Enabled__c;
    }
}
