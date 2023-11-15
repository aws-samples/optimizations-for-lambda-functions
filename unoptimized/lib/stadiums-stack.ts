import { dirname, join } from 'path';
import { fileURLToPath } from 'node:url';
import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { aws_rds as rds } from 'aws-cdk-lib';
import { Runtime, Tracing, Architecture, RuntimeFamily } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction,NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { HttpApi, HttpMethod} from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration} from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { AnyPrincipal, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commonEnvVariables = {
    POWERTOOLS_SERVICE_NAME: 'NFL-stadiums-unoptimized',
    POWERTOOLS_METRICS_NAMESPACE: 'NFLStadiums-unoptimized',
    LOG_LEVEL: 'DEBUG',
}

const commonProps: Partial<NodejsFunctionProps> = {
  runtime: Runtime.NODEJS_18_X,
  memorySize: 256,
  tracing: Tracing.ACTIVE,
  architecture: Architecture.X86_64,
  timeout: Duration.seconds(10),
  logRetention: RetentionDays.ONE_DAY,
  environment: {
    ...commonEnvVariables
  },
  bundling: {
    banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
    minify: true,
    format: OutputFormat.ESM,
    tsconfig: join(__dirname, '../tsconfig.json'),
    nodeModules: [ 'pg', 'pg-hstore', '@aws-lambda-powertools/logger', '@aws-lambda-powertools/tracer', '@aws-lambda-powertools/metrics' ],
    externalModules: []
  }
};

export class StadiumsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const dbUsername = StringParameter.valueForStringParameter(this, "/lambda-optimized/dbUsername"); 
    const dbName = StringParameter.valueForStringParameter(this, "/lambda-optimized/dbName");

    const vpc = new ec2.Vpc(this, "StadiumsVpc", {
      subnetConfiguration: [
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        }
      ]
    });

    const rdsSecret = new Secret(this, 'RdsProxyExampleSecret', {
      secretName: `${id}-rds-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: dbUsername}),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
      }
    });

    // Create a security group to be used on the lambda functions
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'Lambda Security Group', {
      vpc
    });

    // Create a security group to be used on the RDS proxy
    const rdsProxySecurityGroup = new ec2.SecurityGroup(this, 'Only Allow Access From Lambda', {
      vpc
    });
    rdsProxySecurityGroup.addIngressRule(lambdaSecurityGroup, ec2.Port.tcp(5432), 'allow lambda connection to rds proxy');

    // Create a security group to be used on the RDS instances
    const rdsSecurityGroup = new ec2.SecurityGroup(this, 'Only Allow Access From RDS Proxy', {
      vpc
    });
    rdsSecurityGroup.addIngressRule(rdsProxySecurityGroup, ec2.Port.tcp(5432), 'allow db connections from the rds proxy');

    const vpcEndpointSSM = new ec2.InterfaceVpcEndpoint(this, `SSMVpcEndpoint`, {
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
      vpc: vpc,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    })

    vpcEndpointSSM.addToPolicy(new PolicyStatement({
      actions: [
        'ssm:Get*',
      ],
      resources: ['*'],
      principals: [new AnyPrincipal()]
    }))

    const rdsCredentials = rds.Credentials.fromSecret(rdsSecret);

    const postgreSql = new rds.DatabaseCluster(this, 'RDSProxyCluster', {
      defaultDatabaseName: dbName,
      clusterIdentifier: 'RDSProxyCluster',
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_15_3 }),
      credentials: rdsCredentials,
      writer: rds.ClusterInstance.provisioned('writer', {
        publiclyAccessible: false,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      }),
      serverlessV2MinCapacity: 5,
      serverlessV2MaxCapacity: 15,
      readers: [
        rds.ClusterInstance.serverlessV2('reader1'),
      ],
      securityGroups: [rdsSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      vpc,
    });    

    const rdsProxy = postgreSql.addProxy('rdsProxy', {
      secrets: [ rdsSecret ],
      securityGroups: [ rdsProxySecurityGroup ],
      debugLogging: true,
      iamAuth: true,
      vpc
    });

    const PGHost = new StringParameter(this, "PGHost", {
      parameterName: "/lambda-optimized/dbEndpoint",
      description: "DB endpoint",
      stringValue: rdsProxy.endpoint
    });

    const lambdaIAMRole = new Role(this, 'extensionforLambdaIAMRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for getting access to SSM',
      inlinePolicies: {
        "extensionsPolicy": new PolicyDocument({
          statements: [new PolicyStatement({
            actions: [
              'ssm:Get*',
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:PutLogEvents',
              'cloudwatch:PutMetricStream',
              'cloudwatch:PutMetricData',
              "ec2:DescribeNetworkInterfaces",
              "ec2:CreateNetworkInterface",
              "ec2:DeleteNetworkInterface",
              "ec2:DescribeInstances",
              "ec2:AttachNetworkInterface",
              "xray:PutTraceSegments",
              "xray:PutTelemetryRecords"
            ],
            resources: ['*']
          })],
        })
      }
    });
    
    const populateDBLambda: NodejsFunction = new NodejsFunction(this, `${id}-populateLambda`, {
      ...commonProps,
      handler: 'handler',
      retryAttempts: 0,
      entry: join(__dirname, '../lambda/populate.ts'),
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [ lambdaSecurityGroup ],
      role: lambdaIAMRole,
    });

    const getStadiumsDataLambda: NodejsFunction = new NodejsFunction(this, `${id}-getDataLambda`, {
      ...commonProps,
      retryAttempts: 0,
      handler: 'handler',
      entry: join(__dirname, '../lambda/getData.ts'),
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [ lambdaSecurityGroup ],
      role: lambdaIAMRole,
    });

    rdsProxy.grantConnect(populateDBLambda, dbUsername);
    rdsProxy.grantConnect(getStadiumsDataLambda, dbUsername);
    
    const httpApi: HttpApi = new HttpApi(this, 'StadiumsHttpApi');

    const getDataLambdaIntegration = new HttpLambdaIntegration('getStadiumsDataLambda', getStadiumsDataLambda);

    httpApi.addRoutes({
      path: '/',
      methods: [HttpMethod.GET],
      integration: getDataLambdaIntegration,
    });

    new CfnOutput(this, 'stadiumsEndpointUrl', {
      value: `${httpApi.url}`
    });
  };
}