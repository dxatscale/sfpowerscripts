/**
 * @description Feature Checker Interface
 * Responsible for checking if a feature is enabled or not
 */
public interface FeatureChecker {
    /**
     * @description Returns true if feature is enabled
     * @param featureName feature to be checked
     * @return true if enabled
     */
    Boolean isEnabled(String featureName);
}
