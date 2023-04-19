@IsTest(IsParallel=true)
private class AlwaysDisabledFeatureTest {
    @IsTest
    private static void shouldAlwaysReturnFalse() {
        String featureName = 'feature';
        Feature disabledFeature = new AlwaysDisabledFeature();

        System.assert(
            !disabledFeature.isEnabled(featureName),
            'Feature should not be enabled'
        );
    }
}
