import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";
import * as cloudflare from "@pulumi/cloudflare";

// Configuration
const config = new pulumi.Config();
const stackName = pulumi.getStack();
const projectName = "chemical-marketing";

// VPC and Networking
const vpc = new aws.ec2.Vpc("main", {
  cidrBlock: "10.0.0.0/16",
  enableDnsHostnames: true,
  enableDnsSupport: true,
  tags: {
    Name: `${projectName}-vpc`,
  },
});

// EKS Cluster
const eksCluster = new aws.eks.Cluster("main", {
  roleArn: aws.iam.Role.assumeRolePolicy,
  vpcConfig: {
    subnetIds: vpc.privateSubnetIds,
  },
  version: "1.27",
  tags: {
    Name: `${projectName}-cluster`,
  },
});

// AI Processing Cluster
const aiCluster = new k8s.Provider("ai-cluster", {
  kubeconfig: eksCluster.kubeconfig,
});

// Video Processing Pipeline
const videoQueue = new aws.sqs.Queue("video-generation", {
  visibilityTimeoutSeconds: 3600, // 1 hour for long videos
  messageRetentionSeconds: 1209600, // 14 days
  tags: {
    Name: `${projectName}-video-queue`,
  },
});

// Temporal Workflow Cluster
const temporal = new aws.ecs.Cluster("workflows", {
  name: `${projectName}-temporal`,
  capacityProviders: ["FARGATE"],
  defaultCapacityProviderStrategies: [{
    capacityProvider: "FARGATE",
    weight: 100,
  }],
});

// Edge Caching with Cloudflare
const edgeZone = new cloudflare.Zone("chemical-marketing", {
  zone: "chemical-marketing.com",
  plan: "enterprise",
});

// RDS for PostgreSQL
const db = new aws.rds.Instance("main", {
  engine: "postgres",
  instanceClass: "db.r6g.large",
  allocatedStorage: 100,
  dbName: "chemical_marketing",
  username: config.requireSecret("dbUsername"),
  password: config.requireSecret("dbPassword"),
  skipFinalSnapshot: true,
  tags: {
    Name: `${projectName}-db`,
  },
});

// Redis for Caching
const redis = new aws.elasticache.Cluster("main", {
  engine: "redis",
  nodeType: "cache.r6g.large",
  numCacheNodes: 2,
  parameterGroupName: "default.redis6.x",
  tags: {
    Name: `${projectName}-redis`,
  },
});

// S3 for Media Storage
const mediaBucket = new aws.s3.Bucket("media", {
  acl: "private",
  versioning: {
    enabled: true,
  },
  lifecycleRules: [{
    enabled: true,
    expiration: {
      days: 90,
    },
  }],
  tags: {
    Name: `${projectName}-media`,
  },
});

// CloudFront Distribution
const cdn = new aws.cloudfront.Distribution("main", {
  enabled: true,
  origins: [{
    domainName: mediaBucket.bucketRegionalDomainName,
    originId: "S3Origin",
    s3OriginConfig: {
      originAccessIdentity: "origin-access-identity/cloudfront/XXXXXXXX",
    },
  }],
  defaultCacheBehavior: {
    targetOriginId: "S3Origin",
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods: ["GET", "HEAD", "OPTIONS"],
    cachedMethods: ["GET", "HEAD", "OPTIONS"],
    forwardedValues: {
      queryString: false,
      cookies: {
        forward: "none",
      },
    },
    minTtl: 0,
    defaultTtl: 3600,
    maxTtl: 86400,
  },
  restrictions: {
    geoRestriction: {
      restrictionType: "none",
    },
  },
  viewerCertificate: {
    cloudfrontDefaultCertificate: true,
  },
  tags: {
    Name: `${projectName}-cdn`,
  },
});

// Export values
export const clusterEndpoint = eksCluster.endpoint;
export const dbEndpoint = db.endpoint;
export const redisEndpoint = redis.cacheNodes[0].address;
export const cdnDomain = cdn.domainName;
export const edgeZoneId = edgeZone.id; 