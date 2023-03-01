/**
 * @description Apex Representation of a Feature Setting
 */
public class FeatureSetting {
    /** @description featureName */
    public String featureName;

    /** @description Feature Implementation */
    public Feature implementation;

    /**
     * @description Constructor
     *
     * @param featureName
     * @param implementation
     */
    public FeatureSetting(String featureName, String implementation) {
        this.featureName = featureName;
        this.implementation = this.getImplementation(implementation);
    }

    private Feature getImplementation(String implementationName) {
        if (String.isBlank(implementationName)) {
            throw new IllegalArgumentException(
                'Implementation cannot be blank'
            );
        }

        Type implementationType = Type.forName(implementationName);
        if (implementationType == null) {
            throw new IllegalArgumentException('Implementation is not a Type');
        }

        try {
            Object obj = implementationType.newInstance();
            return (Feature) obj;
        } catch (Exception ex) {
            throw new IllegalArgumentException(
                'Implementation cannot be instantiated or is not a feature',
                ex
            );
        }
    }
}
