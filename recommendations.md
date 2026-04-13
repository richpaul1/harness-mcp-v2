URL:


https://app3.harness.io/gateway/ccm/api/graphql?accountIdentifier=HgTKqISVTX-kQSVsWCHEcA&routingId=HgTKqISVTX-kQSVsWCHEcA

Query:
{"query":"query PerspectiveRecommendations($filter: RecommendationFilterDTOInput) {\n  recommendationStatsV2(filter: $filter) {\n    totalMonthlyCost\n    totalMonthlySaving\n    count\n    __typename\n  }\n  recommendationsV2(filter: $filter) {\n    items {\n      clusterName\n      namespace\n      id\n      resourceType\n      resourceName\n      monthlyCost\n      monthlySaving\n      __typename\n    }\n    __typename\n  }\n}","operationName":"PerspectiveRecommendations","variables":{"filter":{"perspectiveFilters":[{"viewMetadataFilter":{"viewId":"h3ais2fbQbyeD5g6qNY3xg","isPreview":false}},{"timeFilter":{"field":{"fieldId":"startTime","fieldName":"startTime","identifier":"COMMON"},"operator":"AFTER","value":1772323200000}},{"timeFilter":{"field":{"fieldId":"startTime","fieldName":"startTime","identifier":"COMMON"},"operator":"BEFORE","value":1775001599000}}],"minSaving":1,"offset":0,"limit":10,"recommendationStates":["OPEN"]}}}

Response:
{
    "data": {
        "recommendationStatsV2": {
            "totalMonthlyCost": 1197965.40289553,
            "totalMonthlySaving": 600895.1317063902,
            "count": 1498,
            "__typename": "RecommendationOverviewStats"
        },
        "recommendationsV2": {
            "items": [
                {
                    "clusterName": null,
                    "namespace": "gfsdrs-fd-prod-a6d7",
                    "id": "68ee2d6e6b1f7ef26e79e561",
                    "resourceType": "GOVERNANCE",
                    "resourceName": "tu-stop-underutilized-instances-gcp",
                    "monthlyCost": 344607.96730399993,
                    "monthlySaving": 172303.98365199997,
                    "__typename": "RecommendationItemDTO"
                },
                {
                    "clusterName": null,
                    "namespace": "gfsdrs-fd-qa-073f",
                    "id": "69db7b4c5c73246fe3ff3c92",
                    "resourceType": "GOVERNANCE",
                    "resourceName": "tu-stop-underutilized-instances-gcp",
                    "monthlyCost": 143489.48764300003,
                    "monthlySaving": 71744.74382150001,
                    "__typename": "RecommendationItemDTO"
                },
                {
                    "clusterName": null,
                    "namespace": "rsfs-nife-prod-e3a5",
                    "id": "69db7b4b5c73246fe3ff3c42",
                    "resourceType": "GOVERNANCE",
                    "resourceName": "tu-stop-underutilized-instances-gcp",
                    "monthlyCost": 98790.31636300002,
                    "monthlySaving": 49395.15818150001,
                    "__typename": "RecommendationItemDTO"
                },
                {
                    "clusterName": null,
                    "namespace": "gfsdrs-fd-prod-a6d7",
                    "id": "69db7b4c5c73246fe3ff3caa",
                    "resourceType": "GOVERNANCE",
                    "resourceName": "Tu-gcp-stale-instances-age-30-days",
                    "monthlyCost": 11322.426785000001,
                    "monthlySaving": 11322.426785000001,
                    "__typename": "RecommendationItemDTO"
                },
                {
                    "clusterName": null,
                    "namespace": "actv-syn-prod-s2s-1588",
                    "id": "69db7b4b5c73246fe3ff3bd7",
                    "resourceType": "GOVERNANCE",
                    "resourceName": "tu-stop-underutilized-instances-gcp",
                    "monthlyCost": 16195.783695999997,
                    "monthlySaving": 8097.891847999998,
                    "__typename": "RecommendationItemDTO"
                },
                {
                    "clusterName": null,
                    "namespace": "gfsdrs-fd-prod-a6d7",
                    "id": "69db7b4d5c73246fe3ff3d95",
                    "resourceType": "GOVERNANCE",
                    "resourceName": "Tu-gcp-stale-instances-age-6-months",
                    "monthlyCost": 6322.588669000002,
                    "monthlySaving": 6322.588669000002,
                    "__typename": "RecommendationItemDTO"
                },
                {
                    "clusterName": null,
                    "namespace": "gfsdrs-fd-prod-a6d7",
                    "id": "69db7b4f5c73246fe3ff3f6c",
                    "resourceType": "GOVERNANCE",
                    "resourceName": "Tu-gcp-stale-instances-age-3-months",
                    "monthlyCost": 6322.588669000001,
                    "monthlySaving": 6322.588669000001,
                    "__typename": "RecommendationItemDTO"
                },
                {
                    "clusterName": null,
                    "namespace": "mta-mta-prod-mtaapp-19c7",
                    "id": "69db7b505c73246fe3ff4044",
                    "resourceType": "GOVERNANCE",
                    "resourceName": "tu-stop-underutilized-instances-gcp",
                    "monthlyCost": 11692.244585999999,
                    "monthlySaving": 5846.1222929999985,
                    "__typename": "RecommendationItemDTO"
                },
                {
                    "clusterName": null,
                    "namespace": "enum-edge-prod-services-080a",
                    "id": "69db7b4b5c73246fe3ff3c54",
                    "resourceType": "GOVERNANCE",
                    "resourceName": "tu-stop-underutilized-instances-gcp",
                    "monthlyCost": 11377.892567999997,
                    "monthlySaving": 5688.946284,
                    "__typename": "RecommendationItemDTO"
                },
                {
                    "clusterName": null,
                    "namespace": "gfsdrs-fd-ci-ef4d",
                    "id": "69db7b4f5c73246fe3ff3f70",
                    "resourceType": "GOVERNANCE",
                    "resourceName": "tu-stop-underutilized-instances-gcp",
                    "monthlyCost": 11372.507451,
                    "monthlySaving": 5686.2537255,
                    "__typename": "RecommendationItemDTO"
                }
            ],
            "__typename": "RecommendationsDTO"
        }
    }
}