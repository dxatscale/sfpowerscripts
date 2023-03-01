/**
 * @description Feature Implementation that is always enabled
 */
public class AlwaysEnabledFeature implements Feature {
    /**
     * @description returns true for all features
     *
     * @param featureName
     * @return true
     */
    public Boolean isEnabled(String featureName) {
        return true;
    }
}
