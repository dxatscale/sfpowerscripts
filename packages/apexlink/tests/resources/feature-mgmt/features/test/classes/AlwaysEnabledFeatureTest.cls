@IsTest(IsParallel=true)
private class AlwaysEnabledFeatureTest {
    @IsTest
    private static void shouldAlwaysReturnTrue() {
        String featureName = 'myFeature';
        Feature enabledFeature = new AlwaysEnabledFeature();

        System.assert(
            enabledFeature.isEnabled(featureName),
            'Feature should be enabled'
        );
    }
}
