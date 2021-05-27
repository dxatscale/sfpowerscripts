# Deployment Plan

| Package                 | Incoming Version | Version in org | To be installed? |
|-------------------------|------------------|----------------|------------------|
| ESObjects               | 50.0.6.16        | 50.0.6.16      | No               |
| ESBaseStylesLWC         | 50.0.6.16        | 50.0.6.16      | No               |
| ESBaseCodeLWC           | 50.0.6.16        | 50.0.5.1       | Yes              |
| ESSpaceMgmtLWC          | 50.0.5.17        | 50.0.5.16      | Yes              |


Dependencies

| Package         | Incoming Version | Version in org | To be installed? | Parent        |
|-----------------|------------------|----------------|------------------|---------------|
| Marketing Cloud | 231.0.0.1        | 230.0.0.0      | Yes              | ESBaseCodeLWC |
| Salesforce CPQ  | 230.6.0.1        | 230.6.0.1      | No               | ESBaseCodeLWC |