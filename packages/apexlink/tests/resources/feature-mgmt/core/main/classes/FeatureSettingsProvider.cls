/**
 * @description Feature Settings Provider
 * Returns the feature settings
 */
public interface FeatureSettingsProvider {
    /**
     * @description Returns Feature Setting Object by Feature Name
     *  if not found should return null
     * @param featureName
     * @return Feature Setting Object null if not found
     */
    FeatureSetting getFeatureSettingByName(String featureName);
}
