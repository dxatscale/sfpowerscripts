@IsTest(IsParallel=true)
private class FeatureCheckerImplementationTest {
    @IsTest
    private static void shouldReturnFalseWithNoImplementation() {
        String featureName = 'myTestFeature';
        FeatureChecker featureManagement = new FeatureCheckerImplementation();

        System.assert(
            !featureManagement.isEnabled(featureName),
            'Feature should not be enabled'
        );
    }

    @IsTest
    private static void shouldReturnTrueWithMockImplementation() {
        String featureName = 'myTestFeature';
        FeatureChecker featureManagement = new FeatureCheckerImplementation(
            new MockFeatureSettingsProvider()
        );

        System.assert(
            featureManagement.isEnabled(featureName),
            'Feature should be enabled'
        );
    }

    /**
     * @description Mock Feature Settings Provider
     */
    public class MockFeatureSettingsProvider implements FeatureSettingsProvider {
        /**
         * @description Returns Feature Setting Object by Feature Name
         *  if not found should return null
         * @param featureName
         * @return Feature Setting Object null if not found
         */
        public FeatureSetting getFeatureSettingByName(String featureName) {
            return new FeatureSetting(featureName, MockFeature.class.getName());
        }
    }

    /**
     * @description Mock Feature
     */
    public class MockFeature implements Feature {
        /**
         * @description always enabled
         * @param featureName
         * @return true
         */
        public Boolean isEnabled(String featureName) {
            return true;
        }
    }
}
