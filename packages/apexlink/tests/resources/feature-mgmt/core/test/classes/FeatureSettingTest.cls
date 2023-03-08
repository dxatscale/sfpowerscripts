@IsTest(IsParallel=true)
private class FeatureSettingTest {
    @IsTest
    private static void testConstruction() {
        String featureName = 'myFeature';
        FeatureSetting setting = new FeatureSetting(
            featureName,
            TestFeature.class.getName()
        );

        System.assert(setting != null, 'Setting should not have been null');

        System.assertEquals(
            setting.featureName,
            featureName,
            'Unexpected Feature Name'
        );
    }

    @IsTest
    private static void shouldThrowExceptionWithNullName() {
        String featureName = 'myFeature';
        try {
            new FeatureSetting(featureName, null);
            System.assert(false, 'An exception should have been thrown');
        } catch (Exception ex) {
            System.assert(ex != null, 'An exception should have been thrown');
            System.assert(
                ex.getMessage().contains('Implementation cannot be blank'),
                'Unexpected Error Message'
            );
        }
    }

    @IsTest
    private static void shouldThrowExceptionWithNameThatisNotaType() {
        String featureName = 'myFeature';
        try {
            new FeatureSetting(featureName, 'SomeClassName');
            System.assert(false, 'An exception should have been thrown');
        } catch (Exception ex) {
            System.assert(ex != null, 'An exception should have been thrown');
            System.assert(
                ex.getMessage().contains('Implementation is not a Type'),
                'Unexpected Error Message'
            );
        }
    }

    @IsTest
    private static void shouldThrowExceptionWithNameThatisOfWrongType() {
        String featureName = 'myFeature';
        try {
            new FeatureSetting(featureName, FeatureSetting.class.getName());
            System.assert(false, 'An exception should have been thrown');
        } catch (Exception ex) {
            System.assert(ex != null, 'An exception should have been thrown');
            System.assert(
                ex.getMessage()
                    .contains(
                        'Implementation cannot be instantiated or is not a feature'
                    ),
                'Unexpected Error Message'
            );
        }
    }

    /**
     * @description Mock Feature implementations
     */
    public class TestFeature implements Feature {
        /**
         * @description always returns true
         * @param featureName
         * @return true
         */
        public Boolean isEnabled(String featureName) {
            return true;
        }
    }
}
