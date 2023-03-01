/**
 * @description Feature Implementation that checks the running user for a custom permission
 */
public class CustomPermissionEnabledFeature implements Feature {
    /**
     * @description checks if the feature has been enabled via
     * a custom permission
     *
     * @param featureName
     * @return true if enabled
     */
    public Boolean isEnabled(String featureName) {
        if (String.isBlank(featureName)) {
            throw new IllegalArgumentException('feature cannot be blank');
        }

        if (featureName.containsWhitespace()) {
            throw new IllegalArgumentException(
                'feature cannot contain white spaces'
            );
        }

        return FeatureManagement.checkPermission(featureName);
    }
}
