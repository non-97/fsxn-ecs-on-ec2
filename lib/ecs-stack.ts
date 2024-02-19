import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class EcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpcId = "vpc-043c0858ea33e8ec2";
    const sourceVolume = "fsxn-vol1";
    const sourcePath = "/mnt/fsxn/vol1";
    const containerPath = "/vol1";
    const junctionPath = "vol1";
    const nfsDnsName =
      "svm-0a277039fa1e73d6a.fs-0130e4e832527894e.fsx.us-east-1.amazonaws.com";

    // VPC
    const vpc = cdk.aws_ec2.Vpc.fromLookup(this, "Vpc", {
      vpcId,
    });

    // ECS Cluster
    const cluster = new cdk.aws_ecs.Cluster(this, "Cluster", {
      vpc,
      containerInsights: true,
    });

    // Container Instance
    cluster
      .addCapacity("DefaultAutoScalingGroupCapacity", {
        instanceType: new cdk.aws_ec2.InstanceType("t3.small"),
        machineImage: cdk.aws_ec2.MachineImage.fromSsmParameter(
          "/aws/service/ecs/optimized-ami/amazon-linux-2023/recommended/image_id"
        ),
        maxCapacity: 1,
        minCapacity: 1,
        associatePublicIpAddress: true,
        vpcSubnets: { subnetType: cdk.aws_ec2.SubnetType.PUBLIC },
        ssmSessionPermissions: true,
      })
      .userData.addCommands(
        `mkdir -p ${sourcePath}`,
        `echo -e "${nfsDnsName}:${junctionPath}\t${sourcePath}\tnfs\tnfsvers=4,_netdev,noresvport,defaults\t0\t0" | tee -a /etc/fstab`,
        `systemctl daemon-reload`,
        `mount -a`,
        "df -hT"
      );

    // Task Definition
    const taskDefinition = new cdk.aws_ecs.Ec2TaskDefinition(
      this,
      "TaskDefinition"
    );

    taskDefinition.addVolume({
      name: sourceVolume,
      host: {
        sourcePath,
      },
    });

    taskDefinition
      .addContainer("SampleContainer", {
        image: cdk.aws_ecs.ContainerImage.fromRegistry(
          "amazon/amazon-ecs-sample"
        ),
        memoryLimitMiB: 256,
      })
      .addMountPoints({
        sourceVolume,
        containerPath,
        readOnly: false,
      });

    // ECS Service
    new cdk.aws_ecs.Ec2Service(this, "Service", {
      cluster,
      taskDefinition,
      desiredCount: 2,
      circuitBreaker: { enable: true },
      enableExecuteCommand: true,
    });
  }
}
