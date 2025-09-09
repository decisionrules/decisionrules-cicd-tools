# DecisionRules.io CICD Tools

DecisionRules, the Business Rules Engine, enables connection to CICD Pipelines and thus enables easy involvement in DevOps processes of medium and larger organizations.

The repository includes custom scripts that help you transfer projects or spaces from one environment 
to another. These scripts support Public Cloud, Regional Clouds, Private Managed Clouds and On-Premise deployments.

A sample implementation of the CICD pipeline and basic processes can be found 
in [Azure DevOps CICD Pipelines](https://github.com/decisionrules/decisionrules-cicd-tools.git)


## Common Use-Cases
- Move one Space to another
- Move space to another environment
- Backup space to Git repository
- Restore space from GIT repository
- Create approval for project/space deployment
- Create deployment artifact
- Export space to S3 bucket

## Supported platforms
- [Azure DevOps](https://docs.decisionrules.io/doc/on-premise-docker/cd-ci-pipelines/azure-devops-cicd-pipelines)
- Bitbucket Pipelines
- GitHub Actions
- Jenkins
- Openshift Pipelines
- Probably other CI/CD Platforms



## Examples
### Prerequisites
- Installed Node 16+
- ```git clone https://github.com/decisionrules/decisionrules-cicd-tools```
- Tested on Ubuntu 22.04 LTS, but it will probably run on any linux/max/windows machine
- DecisionRules [Management API Key](https://docs.decisionrules.io/doc/api/api-keys/management-api-keys)


### Export Space
```
node export-space.js export.json SOURCE_ENV_URL SOURCE_SPACE_MANAGEMENT_APIKEY
```
**example:**
```
node export-space.js export.json https://api.decisionrules.io 4asd654sa65d46sa54d654sa54d6sa5d46sa5d4
```

### Clear Space
```
node clear-space.js DEST_ENV_URL DEST_SPACE_MANAGEMENT_APIKEY
```
**example:**
```
node clear-space.js https://api.decisionrules.io 4asd654sa65d46sa54d654sa54d6sa5d46sa5d4 
```

### Import Space
```
node import-space.js file_to_import.json DEST_ENV_URL DEST_SPACE_MANAGEMENT_APIKEY
```
**example:**
```
node import-space.js file_to_import.json https://api.decisionrules.io 4asd654sa65d46sa54d654sa54d6sa5d46sa5d4
```

### Compare Spaces
```
node compare-spaces.js file_1_to_compare.json file_2_to_compare.json [outputFile.json]
```
**example:**
```
node compare-space.js export_staging.json export_production.json comparison_result.json
```
## Platform examples:



### Azure DevOps Example
[Azure DevOps Documentation](https://docs.decisionrules.io/doc/on-premise-docker/cd-ci-pipelines/azure-devops-cicd-pipelines)
```
trigger: none

#External parameters of this YAML pipeline. You can select source environment and target environment
parameters:
- name: srcEnv
  displayName: "Source Environment"
  type: string
  default: "TEST"
  values: [ "PRODUCTION", "TEST" ]
- name: destEnv
  displayName: "Target Environment"
  type: string
  default: "PRODUCTION"
  values: [ "PRODUCTION", "TEST" ]

variables:
- group: dr-var

pool:
vmImage: ubuntu-latest



steps:
# Get DecisionRules CDCI Pipeline tools from Github
- script: |
  git clone https://github.com/decisionrules/decisionrules-cicd-tools.git
  cd decisionrules-cicd-tools
  npm install
  displayName: 'Prepare DecisionRules CICD tools'

# Create branchName variable which represents branch in github repo
- script: |
  echo "##vso[task.setvariable variable=branchName;]$(date '+%Y-%m-%d-%H-%M-%S')"
  displayName: 'Set variables'

# Create project folder
- script: |
  cd decisionrules-cicd-tools
  mkdir export
  displayName: 'Creating project folder'

# Export source space from source environment
- script: |
  cd decisionrules-cicd-tools
  npm run export export/export.json $(${{parameters.srcEnv}}_ENV_URL) $(${{parameters.srcEnv}}_SPACE_MANAGEMENT_APIKEY)
  displayName: 'Storing source project'

# Create repository, create branch for backup, commit and push exported space to git repository
- script: |
  mkdir repository && cd repository
  git clone $(GIT_REPO) .
  git config --global user.email "release@decisionrules.io"
  git config --global user.name "Release Pipeline Agent"
  git checkout -b release/$(branchName)
  cp ../decisionrules-cicd-tools/export/export.json .
  git add .
  git commit -a -m 'Storing release'
  git push --set-upstream origin release/$(branchName) --force
  displayName: 'Storing data to git'

# Also attach deployment artifact to the pipeline.
- task: PublishPipelineArtifact@1
  inputs:
  targetPath: 'decisionrules-cicd-tools/export/export.json'
  artifact: 'Exported Space'
  publishLocation: 'pipeline'
  displayName: 'Attach deployment artifact to the pipeline'

# Prepare target space for new import
- script: |
  cd decisionrules-cicd-tools
  npm run clear $(${{parameters.destEnv}}_ENV_URL) $(${{parameters.destEnv}}_SPACE_MANAGEMENT_APIKEY)
  displayName: 'Preparing target project'

# Upload tada to target space
- script: |
  cd decisionrules-cicd-tools
  npm run import export/export.json $(${{parameters.destEnv}}_ENV_URL) $(${{parameters.destEnv}}_SPACE_MANAGEMENT_APIKEY)
  displayName: 'Migrating to target project'
```


### Azure DevOps Example with space comparison
```
trigger: none

# External parameters of this YAML pipeline
parameters:
- name: srcEnv
  displayName: "Source Environment"
  type: string
  default: "TEST"
  values: [ "PRODUCTION", "TEST" ]
- name: destEnv
  displayName: "Target Environment"
  type: string
  default: "PRODUCTION"
  values: [ "PRODUCTION", "TEST" ]

variables:
- group: dr-var

stages:
- stage: CompareEnvironments
  displayName: 'Compare Environments'
  pool:
    vmImage: ubuntu-latest
  jobs:
  - job: CompareAndExport
    displayName: 'Export and Compare Spaces'
    steps:
    # Get DecisionRules CICD Pipeline tools from Github
    - script: |
        git clone https://github.com/decisionrules/decisionrules-cicd-tools.git
        cd decisionrules-cicd-tools
        npm install
      displayName: 'Prepare DecisionRules CICD tools'

    # Create directories
    - script: |
        cd decisionrules-cicd-tools
        mkdir -p export
        mkdir -p comparison
      displayName: 'Create directories'

    # Export source environment
    - script: |
        cd decisionrules-cicd-tools
        npm run export export/source_export.json $(${{parameters.srcEnv}}_ENV_URL) $(${{parameters.srcEnv}}_SPACE_MANAGEMENT_APIKEY)
      displayName: 'Export source environment (${{parameters.srcEnv}})'

    # Export destination environment
    - script: |
        cd decisionrules-cicd-tools
        npm run export export/destination_export.json $(${{parameters.destEnv}}_ENV_URL) $(${{parameters.destEnv}}_SPACE_MANAGEMENT_APIKEY)
      displayName: 'Export destination environment (${{parameters.destEnv}})'

    # Run comparison
    - script: |
        cd decisionrules-cicd-tools
        echo "======================================"
        echo "COMPARING ENVIRONMENTS"
        echo "======================================"
        echo "Source: ${{parameters.srcEnv}}"
        echo "Destination: ${{parameters.destEnv}}"
        echo "======================================"
        
        # Run comparison using npm script
        npm run compare export/source_export.json export/destination_export.json comparison/comparison_results.json
      displayName: 'Compare spaces'

    # Display comparison results
    - script: |
        cd decisionrules-cicd-tools
        echo ""
        echo "======================================"
        echo "COMPARISON RESULTS:"
        echo "======================================"
        cat comparison/comparison_results.json | python3 -m json.tool
        echo "======================================"
      displayName: 'Display comparison results'

    # Publish artifacts
    - task: PublishPipelineArtifact@1
      inputs:
        targetPath: 'decisionrules-cicd-tools/export/source_export.json'
        artifact: 'SourceExport'
      displayName: 'Publish source export'

    - task: PublishPipelineArtifact@1
      inputs:
        targetPath: 'decisionrules-cicd-tools/export/destination_export.json'
        artifact: 'DestinationExport'
      displayName: 'Publish destination export'

    - task: PublishPipelineArtifact@1
      inputs:
        targetPath: 'decisionrules-cicd-tools/comparison/comparison_results.json'
        artifact: 'ComparisonResults'
      displayName: 'Publish comparison results'

- stage: Migration
  displayName: 'Migration (Requires Approval)'
  dependsOn: CompareEnvironments
  pool:
    vmImage: ubuntu-latest
  jobs:
  - deployment: MigrateToTarget
    displayName: 'Migrate to Target Environment'
    environment: 'DecisionRules-${{parameters.destEnv}}'
    strategy:
      runOnce:
        deploy:
          steps:
          # Get DecisionRules CICD Pipeline tools from Github
          - script: |
              git clone https://github.com/decisionrules/decisionrules-cicd-tools.git
              cd decisionrules-cicd-tools
              npm install
            displayName: 'Prepare DecisionRules CICD tools'

          # Download source export artifact
          - download: current
            artifact: 'SourceExport'
            displayName: 'Download source export'

          # Prepare export file
          - script: |
              cd decisionrules-cicd-tools
              mkdir -p export
              cp "$(Pipeline.Workspace)/SourceExport/source_export.json" export/export.json
            displayName: 'Prepare export'

          # Clear destination
          - script: |
              cd decisionrules-cicd-tools
              npm run clear $(${{parameters.destEnv}}_ENV_URL) $(${{parameters.destEnv}}_SPACE_MANAGEMENT_APIKEY)
            displayName: 'Clear destination (${{parameters.destEnv}})'

          # Import to destination
          - script: |
              cd decisionrules-cicd-tools
              npm run import export/export.json $(${{parameters.destEnv}}_ENV_URL) $(${{parameters.destEnv}}_SPACE_MANAGEMENT_APIKEY)
            displayName: 'Import to destination (${{parameters.destEnv}})'

          # Final message
          - script: |
              echo "======================================"
              echo "✅ MIGRATION COMPLETED"
              echo "======================================"
              echo "Source: ${{parameters.srcEnv}}"
              echo "Destination: ${{parameters.destEnv}}"
              echo "Timestamp: $(date)"
              echo "======================================"
            displayName: 'Migration complete'
```