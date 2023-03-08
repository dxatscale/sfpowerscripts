/**
 * @description Default implementation of the Feature Checker
 * Uses a custom metadata table to fetch the a Feature implementation
 * to determin if the feature should be enabled
 */
public class FeatureCheckerImplementation implements FeatureChecker {
    private FeatureSettingsProvider featureSettingsProvider;

    /**
     * @description No Parameter Constructor
     * Sets the default FeatureSettings Provider
     */
    public FeatureCheckerImplementation() {
        this(new CustomMetadataFeatureSettingsProvider());
    }

    /**
     * @description Constructor
     * @param featureSettingsProvider
     */
    public FeatureCheckerImplementation(
        FeatureSettingsProvider featureSettingsProvider
    ) {
        this.featureSettingsProvider = featureSettingsProvider;
    }

    /**
     * @desription Returns true if the feature is enabled
     * Fetches and instantiates the feature implementation and checks if
     * that feature is enabled. If no feature is found or cannot be
     * instantiated the default return is false
     *
     * @param featureName name of the feature to be checked
     * @return true if enabled
     */
    public Boolean isEnabled(String featureName) {
        FeatureSetting featureSetting = this.featureSettingsProvider.getFeatureSettingByName(
            featureName
        );

        if (featureSetting == null) {
            return false;
        }

        return featureSetting.implementation.isEnabled(featureName);
    }
}
