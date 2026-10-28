import { CfnOutput, Stack, StackProps, SecretValue } from 'aws-cdk-lib';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import { Construct } from 'constructs';
import { ProjectConfig } from './config';
import { BackendStack } from './backend-stack';

export interface FrontendStackProps extends StackProps {
  config: ProjectConfig;
  backend: BackendStack;
}

/**
 * Amplify Hosting for the Vite + React app in /frontend, connected to GitHub.
 * Every push to the configured branch builds and deploys the site.
 *
 * Prerequisite (one time): store a GitHub personal access token in Secrets Manager
 * under the name set in `githubTokenSecretName`. See the root README.
 */
export class FrontendStack extends Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);
    const { config, backend } = props;

    const app = new amplify.CfnApp(this, 'App', {
      name: `${config.projectName}-web`,
      repository: `https://github.com/${config.githubOwner}/${config.githubRepo}`,
      accessToken: SecretValue.secretsManager(config.githubTokenSecretName).unsafeUnwrap(),
      platform: 'WEB',
      buildSpec: [
        'version: 1',
        'applications:',
        '  - appRoot: frontend',
        '    frontend:',
        '      phases:',
        '        preBuild:',
        '          commands:',
        '            - npm ci',
        '        build:',
        '          commands:',
        '            - npm run build',
        '      artifacts:',
        '        baseDirectory: dist',
        '        files:',
        "          - '**/*'",
        '      cache:',
        '        paths:',
        '          - node_modules/**/*',
      ].join('\n'),
      // Single-page app: send unknown paths to index.html
      customRules: [
        {
          source: '</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>',
          target: '/index.html',
          status: '200',
        },
      ],
      environmentVariables: [
        { name: 'AMPLIFY_MONOREPO_APP_ROOT', value: 'frontend' },
        { name: 'VITE_PROJECT_NAME', value: config.projectName },
        { name: 'VITE_API_URL', value: backend.api.apiEndpoint },
        { name: 'VITE_REGION', value: backend.region },
        { name: 'VITE_USER_POOL_ID', value: backend.userPool.userPoolId },
        { name: 'VITE_USER_POOL_CLIENT_ID', value: backend.userPoolClient.userPoolClientId },
        ...(backend.realtime ? [{ name: 'VITE_WS_URL', value: backend.realtime.stage.url }] : []),
      ],
    });

    const branch = new amplify.CfnBranch(this, 'Branch', {
      appId: app.attrAppId,
      branchName: config.githubBranch,
      enableAutoBuild: true,
      stage: 'PRODUCTION',
    });

    new CfnOutput(this, 'AmplifyAppId', { value: app.attrAppId });
    new CfnOutput(this, 'SiteUrl', {
      value: `https://${branch.branchName}.${app.attrDefaultDomain}`,
    });
  }
}
