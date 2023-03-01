@IsTest(IsParallel=true)
private class CustomPermissionEnabledFeatureTest {
    @IsTest
    private static void shouldThrowExceptionIfBlank() {
        String permissionName = '';
        Feature disabledFeature = new CustomPermissionEnabledFeature();

        try {
            disabledFeature.isEnabled(permissionName);
        } catch (Exception ex) {
            System.assert(ex != null, 'An exception should have been thrown');

            System.assert(
                ex.getMessage().contains('feature cannot be blank'),
                'Unexpected Error Message'
            );
        }
    }

    @IsTest
    private static void shouldThrowExceptionIfContainsWhiteSpaces() {
        // This would cause FeatureManagement.checkPermission() to throw
        // a System.UnexpectedException - this cannot be caught
        String permissionName = 'bad permission name';
        Feature disabledFeature = new CustomPermissionEnabledFeature();

        try {
            disabledFeature.isEnabled(permissionName);
        } catch (Exception ex) {
            System.assert(ex != null, 'An exception should have been thrown');

            System.assert(
                ex.getMessage().contains('feature cannot contain white spaces'),
                'Unexpected Error Message'
            );
        }
    }

    @IsTest
    private static void shouldReturnFalseWithoutPermission() {
        String permissionName = 'doesntExist';
        Feature disabledFeature = new CustomPermissionEnabledFeature();

        System.assert(
            !disabledFeature.isEnabled(permissionName),
            'Event should be disabled'
        );
    }
}
