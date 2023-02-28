@IsTest(IsParallel=true)
private class CustMetadataFeatureSettingsProviderTest {
    @IsTest
    private static void shouldReturnNullWithMissingMetadata() {
        String featureName = 'myTestFeature';
        FeatureSettingsProvider settingsProvider = new CustomMetadataFeatureSettingsProvider();
        FeatureSetting setting = settingsProvider.getFeatureSettingByName(
            featureName
        );

        System.assert(setting == null, 'Setting Should be Null');
    }
}
