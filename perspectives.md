Query:

https://app3.harness.io/gateway/ccm/api/perspective?routingId=HgTKqISVTX-kQSVsWCHEcA&perspectiveId=h3ais2fbQbyeD5g6qNY3xg&accountIdentifier=HgTKqISVTX-kQSVsWCHEcA

Response:
{
    "status": "SUCCESS",
    "data": {
        "uuid": "h3ais2fbQbyeD5g6qNY3xg",
        "name": "Domain - GIS ",
        "accountId": "HgTKqISVTX-kQSVsWCHEcA",
        "folderId": "AcQ0l6zUSjqDFr1Wu9Cp3g",
        "viewVersion": "v1",
        "viewTimeRange": {
            "viewTimeRangeType": "LAST_MONTH",
            "startTime": 0,
            "endTime": 0
        },
        "viewRules": [
            {
                "viewConditions": [
                    {
                        "type": "VIEW_ID_CONDITION",
                        "viewField": {
                            "fieldId": "_Ahbf0HGSsuDh4LnyCYlVw",
                            "fieldName": "Business Domains",
                            "identifier": "BUSINESS_MAPPING",
                            "identifierName": "Cost Categories"
                        },
                        "viewOperator": "IN",
                        "values": [
                            "GIS"
                        ]
                    },
                    {
                        "type": "VIEW_ID_CONDITION",
                        "viewField": {
                            "fieldId": "cloudProvider",
                            "fieldName": "Cloud Provider",
                            "identifier": "COMMON",
                            "identifierName": "Common"
                        },
                        "viewOperator": "IN",
                        "values": [
                            "AWS",
                            "AZURE",
                            "GCP"
                        ]
                    }
                ]
            }
        ],
        "dataSources": [
            "BUSINESS_MAPPING",
            "AWS",
            "GCP",
            "AZURE"
        ],
        "viewVisualization": {
            "granularity": null,
            "groupBy": {
                "fieldId": "QYu4vYaLRpWuzV6erSGPcA",
                "fieldName": "Business Units",
                "identifier": "BUSINESS_MAPPING",
                "identifierName": "Cost Categories"
            },
            "chartType": "STACKED_LINE_CHART"
        },
        "viewPreferences": {
            "showAnomalies": true,
            "includeOthers": false,
            "includeUnallocatedCost": false,
            "awsPreferences": {
                "includeDiscounts": false,
                "includeCredits": true,
                "includeRefunds": true,
                "includeTaxes": true,
                "awsCost": "NET_AMORTISED"
            },
            "gcpPreferences": {
                "includeDiscounts": true,
                "includeTaxes": true,
                "includePromotions": false,
                "includeNegotiatedSavings": true,
                "includeSubscriptionCredits": true,
                "includeSustainedUseDiscounts": true,
                "includeResourceBasedCudCredits": true,
                "includeLegacyBasedCudCredits": true,
                "includeSpendBasedCudDiscounts": true
            },
            "azureViewPreferences": {
                "costType": "AMORTIZED"
            }
        },
        "viewType": "CUSTOMER",
        "viewState": "COMPLETED",
        "totalCost": 4129107.55,
        "createdAt": 1752575911368,
        "lastUpdatedAt": 1774457958747,
        "createdBy": {
            "uuid": "e4Kb3qAMRS2v0rnV_KgJ7w",
            "name": "raghulkrishna.r@transunion.com",
            "email": "raghulkrishna.r@transunion.com",
            "externalUserId": null
        },
        "lastUpdatedBy": null
    },
    "metaData": null,
    "correlationId": "f5190943-ea35-48e7-986b-803802326f62"
}

Perspective metadata:
URL:
https://app3.harness.io/gateway/ccm/api/perspective?routingId=HgTKqISVTX-kQSVsWCHEcA&perspectiveId=gxOTo0pxQo2ddqCNSqzUig&accountIdentifier=HgTKqISVTX-kQSVsWCHEcA

Response:
{
    "status": "SUCCESS",
    "data": {
        "uuid": "gxOTo0pxQo2ddqCNSqzUig",
        "name": "Argus",
        "accountId": "HgTKqISVTX-kQSVsWCHEcA",
        "folderId": "4shVinS2T_Ob-0TGHQQC_w",
        "viewVersion": "v1",
        "viewTimeRange": {
            "viewTimeRangeType": "LAST_30",
            "startTime": 0,
            "endTime": 0
        },
        "viewRules": [
            {
                "viewConditions": [
                    {
                        "type": "VIEW_ID_CONDITION",
                        "viewField": {
                            "fieldId": "Hr-hS26aRiWvMQN_TEScMg",
                            "fieldName": "Mapped Product",
                            "identifier": "BUSINESS_MAPPING",
                            "identifierName": "Cost Categories"
                        },
                        "viewOperator": "IN",
                        "values": [
                            "argus",
                            "commerce signal"
                        ]
                    }
                ]
            }
        ],
        "dataSources": [
            "BUSINESS_MAPPING",
            "EXTERNAL_DATA"
        ],
        "viewVisualization": {
            "granularity": null,
            "groupBy": {
                "fieldId": "cloudproviderentityid",
                "fieldName": "Account Id",
                "identifier": "EXTERNAL_DATA",
                "identifierName": "External Data"
            },
            "chartType": "STACKED_LINE_CHART"
        },
        "viewPreferences": {
            "showAnomalies": true,
            "includeOthers": false,
            "includeUnallocatedCost": false,
            "awsPreferences": {
                "includeDiscounts": false,
                "includeCredits": true,
                "includeRefunds": true,
                "includeTaxes": true,
                "awsCost": "NET_AMORTISED"
            },
            "gcpPreferences": {
                "includeDiscounts": true,
                "includeTaxes": true,
                "includePromotions": false,
                "includeNegotiatedSavings": true,
                "includeSubscriptionCredits": true,
                "includeSustainedUseDiscounts": true,
                "includeResourceBasedCudCredits": true,
                "includeLegacyBasedCudCredits": true,
                "includeSpendBasedCudDiscounts": true
            },
            "azureViewPreferences": {
                "costType": "AMORTIZED"
            }
        },
        "viewType": "CUSTOMER",
        "viewState": "COMPLETED",
        "totalCost": 601770.14,
        "createdAt": 1751548207371,
        "lastUpdatedAt": 1774457958704,
        "createdBy": {
            "uuid": "gZsQrBS2SNmkO3RstAaBCw",
            "name": "chhavi.gupta@transunion.com",
            "email": "chhavi.gupta@transunion.com",
            "externalUserId": null
        },
        "lastUpdatedBy": null
    },
    "metaData": null,
    "correlationId": "6759af58-7a91-4854-8128-a0fcb1b0b902"
}