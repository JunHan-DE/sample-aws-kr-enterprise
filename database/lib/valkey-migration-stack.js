"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValkeyMigrationStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const elasticache = __importStar(require("aws-cdk-lib/aws-elasticache"));
class ValkeyMigrationStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // VPC with 2 AZs
        const vpc = new ec2.Vpc(this, 'ValkeyMigrationVpc', {
            maxAzs: 2,
            natGateways: 1,
            subnetConfiguration: [
                { name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
                { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
            ],
        });
        // Security Group for EC2 (Redis source)
        const redisSg = new ec2.SecurityGroup(this, 'RedisSg', {
            vpc,
            description: 'Security group for self-hosted Redis on EC2',
            allowAllOutbound: true,
        });
        // Security Group for ElastiCache (Valkey target)
        const valkeySg = new ec2.SecurityGroup(this, 'ValkeySg', {
            vpc,
            description: 'Security group for ElastiCache Valkey',
            allowAllOutbound: true,
        });
        // Allow ElastiCache to connect to EC2 Redis (for replication)
        redisSg.addIngressRule(valkeySg, ec2.Port.tcp(6379), 'Allow ElastiCache to replicate from Redis');
        // Allow EC2 to connect to ElastiCache (for verification)
        valkeySg.addIngressRule(redisSg, ec2.Port.tcp(6379), 'Allow EC2 to connect to ElastiCache');
        // EC2 Instance Connect Endpoint for bastion access
        new ec2.CfnInstanceConnectEndpoint(this, 'EicEndpoint', {
            subnetId: vpc.privateSubnets[0].subnetId,
            securityGroupIds: [redisSg.securityGroupId],
        });
        // User data script to install Redis 7.4.6
        const userData = ec2.UserData.forLinux();
        userData.addCommands('yum update -y', 'yum install -y gcc make', 'cd /tmp', 'curl -O http://download.redis.io/releases/redis-7.4.6.tar.gz', 'tar xzf redis-7.4.6.tar.gz', 'cd redis-7.4.6', 'make', 'make install', 
        // Configure Redis for online migration
        'mkdir -p /etc/redis', 'cat > /etc/redis/redis.conf << EOF', 'bind 0.0.0.0', 'protected-mode no', 'port 6379', 'daemonize yes', 'pidfile /var/run/redis_6379.pid', 'logfile /var/log/redis.log', 'EOF', '/usr/local/bin/redis-server /etc/redis/redis.conf');
        // EC2 Instance with Redis 7.4.6
        const redisInstance = new ec2.Instance(this, 'RedisInstance', {
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
            machineImage: ec2.MachineImage.latestAmazonLinux2023(),
            securityGroup: redisSg,
            userData,
        });
        // ElastiCache Subnet Group
        const subnetGroup = new elasticache.CfnSubnetGroup(this, 'ValkeySubnetGroup', {
            description: 'Subnet group for ElastiCache Valkey',
            subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
            cacheSubnetGroupName: 'valkey-migration-subnet-group',
        });
        // ElastiCache for Valkey (cluster-mode disabled, Multi-AZ, no TLS for online migration)
        const valkeyCluster = new elasticache.CfnReplicationGroup(this, 'ValkeyCluster', {
            replicationGroupDescription: 'ElastiCache for Valkey - Migration Target',
            engine: 'valkey',
            engineVersion: '8.2',
            cacheNodeType: 'cache.t3.medium',
            numCacheClusters: 2, // Primary + 1 Replica for Multi-AZ
            automaticFailoverEnabled: true,
            multiAzEnabled: true,
            transitEncryptionEnabled: false, // Required: must be disabled for online migration
            atRestEncryptionEnabled: false,
            cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
            securityGroupIds: [valkeySg.securityGroupId],
            port: 6379,
        });
        valkeyCluster.addDependency(subnetGroup);
        // Outputs
        new cdk.CfnOutput(this, 'RedisInstanceId', {
            value: redisInstance.instanceId,
            description: 'EC2 Instance ID running Redis 7.4.6',
        });
        new cdk.CfnOutput(this, 'RedisPrivateIp', {
            value: redisInstance.instancePrivateIp,
            description: 'Private IP of Redis instance (use for StartMigration)',
        });
        new cdk.CfnOutput(this, 'ValkeyPrimaryEndpoint', {
            value: valkeyCluster.attrPrimaryEndPointAddress,
            description: 'ElastiCache Valkey Primary Endpoint',
        });
        new cdk.CfnOutput(this, 'ValkeyReplicationGroupId', {
            value: valkeyCluster.ref,
            description: 'Replication Group ID (use for StartMigration)',
        });
    }
}
exports.ValkeyMigrationStack = ValkeyMigrationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsa2V5LW1pZ3JhdGlvbi1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZhbGtleS1taWdyYXRpb24tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyx5RUFBMkQ7QUFHM0QsTUFBYSxvQkFBcUIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNqRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGlCQUFpQjtRQUNqQixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ2xELE1BQU0sRUFBRSxDQUFDO1lBQ1QsV0FBVyxFQUFFLENBQUM7WUFDZCxtQkFBbUIsRUFBRTtnQkFDbkIsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFO2dCQUNuRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsbUJBQW1CLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRTthQUNsRjtTQUNGLENBQUMsQ0FBQztRQUVILHdDQUF3QztRQUN4QyxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRTtZQUNyRCxHQUFHO1lBQ0gsV0FBVyxFQUFFLDZDQUE2QztZQUMxRCxnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCLENBQUMsQ0FBQztRQUVILGlEQUFpRDtRQUNqRCxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUN2RCxHQUFHO1lBQ0gsV0FBVyxFQUFFLHVDQUF1QztZQUNwRCxnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCLENBQUMsQ0FBQztRQUVILDhEQUE4RDtRQUM5RCxPQUFPLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSwyQ0FBMkMsQ0FBQyxDQUFDO1FBQ2xHLHlEQUF5RDtRQUN6RCxRQUFRLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxxQ0FBcUMsQ0FBQyxDQUFDO1FBRTVGLG1EQUFtRDtRQUNuRCxJQUFJLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3RELFFBQVEsRUFBRSxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVE7WUFDeEMsZ0JBQWdCLEVBQUUsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDO1NBQzVDLENBQUMsQ0FBQztRQUVILDBDQUEwQztRQUMxQyxNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3pDLFFBQVEsQ0FBQyxXQUFXLENBQ2xCLGVBQWUsRUFDZix5QkFBeUIsRUFDekIsU0FBUyxFQUNULDhEQUE4RCxFQUM5RCw0QkFBNEIsRUFDNUIsZ0JBQWdCLEVBQ2hCLE1BQU0sRUFDTixjQUFjO1FBQ2QsdUNBQXVDO1FBQ3ZDLHFCQUFxQixFQUNyQixvQ0FBb0MsRUFDcEMsY0FBYyxFQUNkLG1CQUFtQixFQUNuQixXQUFXLEVBQ1gsZUFBZSxFQUNmLGlDQUFpQyxFQUNqQyw0QkFBNEIsRUFDNUIsS0FBSyxFQUNMLG1EQUFtRCxDQUNwRCxDQUFDO1FBRUYsZ0NBQWdDO1FBQ2hDLE1BQU0sYUFBYSxHQUFHLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQzVELEdBQUc7WUFDSCxVQUFVLEVBQUUsRUFBRSxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsRUFBRTtZQUM5RCxZQUFZLEVBQUUsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7WUFDaEYsWUFBWSxFQUFFLEdBQUcsQ0FBQyxZQUFZLENBQUMscUJBQXFCLEVBQUU7WUFDdEQsYUFBYSxFQUFFLE9BQU87WUFDdEIsUUFBUTtTQUNULENBQUMsQ0FBQztRQUVILDJCQUEyQjtRQUMzQixNQUFNLFdBQVcsR0FBRyxJQUFJLFdBQVcsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzVFLFdBQVcsRUFBRSxxQ0FBcUM7WUFDbEQsU0FBUyxFQUFFLEdBQUcsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztZQUM1RCxvQkFBb0IsRUFBRSwrQkFBK0I7U0FDdEQsQ0FBQyxDQUFDO1FBRUgsd0ZBQXdGO1FBQ3hGLE1BQU0sYUFBYSxHQUFHLElBQUksV0FBVyxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDL0UsMkJBQTJCLEVBQUUsMkNBQTJDO1lBQ3hFLE1BQU0sRUFBRSxRQUFRO1lBQ2hCLGFBQWEsRUFBRSxLQUFLO1lBQ3BCLGFBQWEsRUFBRSxpQkFBaUI7WUFDaEMsZ0JBQWdCLEVBQUUsQ0FBQyxFQUFFLG1DQUFtQztZQUN4RCx3QkFBd0IsRUFBRSxJQUFJO1lBQzlCLGNBQWMsRUFBRSxJQUFJO1lBQ3BCLHdCQUF3QixFQUFFLEtBQUssRUFBRSxrREFBa0Q7WUFDbkYsdUJBQXVCLEVBQUUsS0FBSztZQUM5QixvQkFBb0IsRUFBRSxXQUFXLENBQUMsb0JBQW9CO1lBQ3RELGdCQUFnQixFQUFFLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQztZQUM1QyxJQUFJLEVBQUUsSUFBSTtTQUNYLENBQUMsQ0FBQztRQUNILGFBQWEsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFekMsVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDekMsS0FBSyxFQUFFLGFBQWEsQ0FBQyxVQUFVO1lBQy9CLFdBQVcsRUFBRSxxQ0FBcUM7U0FDbkQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUN4QyxLQUFLLEVBQUUsYUFBYSxDQUFDLGlCQUFpQjtZQUN0QyxXQUFXLEVBQUUsdURBQXVEO1NBQ3JFLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0MsS0FBSyxFQUFFLGFBQWEsQ0FBQywwQkFBMEI7WUFDL0MsV0FBVyxFQUFFLHFDQUFxQztTQUNuRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDBCQUEwQixFQUFFO1lBQ2xELEtBQUssRUFBRSxhQUFhLENBQUMsR0FBRztZQUN4QixXQUFXLEVBQUUsK0NBQStDO1NBQzdELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXRIRCxvREFzSEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgZWxhc3RpY2FjaGUgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVsYXN0aWNhY2hlJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgY2xhc3MgVmFsa2V5TWlncmF0aW9uU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBWUEMgd2l0aCAyIEFac1xuICAgIGNvbnN0IHZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsICdWYWxrZXlNaWdyYXRpb25WcGMnLCB7XG4gICAgICBtYXhBenM6IDIsXG4gICAgICBuYXRHYXRld2F5czogMSxcbiAgICAgIHN1Ym5ldENvbmZpZ3VyYXRpb246IFtcbiAgICAgICAgeyBuYW1lOiAnUHVibGljJywgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLCBjaWRyTWFzazogMjQgfSxcbiAgICAgICAgeyBuYW1lOiAnUHJpdmF0ZScsIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsIGNpZHJNYXNrOiAyNCB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIFNlY3VyaXR5IEdyb3VwIGZvciBFQzIgKFJlZGlzIHNvdXJjZSlcbiAgICBjb25zdCByZWRpc1NnID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdSZWRpc1NnJywge1xuICAgICAgdnBjLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3Igc2VsZi1ob3N0ZWQgUmVkaXMgb24gRUMyJyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBTZWN1cml0eSBHcm91cCBmb3IgRWxhc3RpQ2FjaGUgKFZhbGtleSB0YXJnZXQpXG4gICAgY29uc3QgdmFsa2V5U2cgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ1ZhbGtleVNnJywge1xuICAgICAgdnBjLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgRWxhc3RpQ2FjaGUgVmFsa2V5JyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBBbGxvdyBFbGFzdGlDYWNoZSB0byBjb25uZWN0IHRvIEVDMiBSZWRpcyAoZm9yIHJlcGxpY2F0aW9uKVxuICAgIHJlZGlzU2cuYWRkSW5ncmVzc1J1bGUodmFsa2V5U2csIGVjMi5Qb3J0LnRjcCg2Mzc5KSwgJ0FsbG93IEVsYXN0aUNhY2hlIHRvIHJlcGxpY2F0ZSBmcm9tIFJlZGlzJyk7XG4gICAgLy8gQWxsb3cgRUMyIHRvIGNvbm5lY3QgdG8gRWxhc3RpQ2FjaGUgKGZvciB2ZXJpZmljYXRpb24pXG4gICAgdmFsa2V5U2cuYWRkSW5ncmVzc1J1bGUocmVkaXNTZywgZWMyLlBvcnQudGNwKDYzNzkpLCAnQWxsb3cgRUMyIHRvIGNvbm5lY3QgdG8gRWxhc3RpQ2FjaGUnKTtcblxuICAgIC8vIEVDMiBJbnN0YW5jZSBDb25uZWN0IEVuZHBvaW50IGZvciBiYXN0aW9uIGFjY2Vzc1xuICAgIG5ldyBlYzIuQ2ZuSW5zdGFuY2VDb25uZWN0RW5kcG9pbnQodGhpcywgJ0VpY0VuZHBvaW50Jywge1xuICAgICAgc3VibmV0SWQ6IHZwYy5wcml2YXRlU3VibmV0c1swXS5zdWJuZXRJZCxcbiAgICAgIHNlY3VyaXR5R3JvdXBJZHM6IFtyZWRpc1NnLnNlY3VyaXR5R3JvdXBJZF0sXG4gICAgfSk7XG5cbiAgICAvLyBVc2VyIGRhdGEgc2NyaXB0IHRvIGluc3RhbGwgUmVkaXMgNy40LjZcbiAgICBjb25zdCB1c2VyRGF0YSA9IGVjMi5Vc2VyRGF0YS5mb3JMaW51eCgpO1xuICAgIHVzZXJEYXRhLmFkZENvbW1hbmRzKFxuICAgICAgJ3l1bSB1cGRhdGUgLXknLFxuICAgICAgJ3l1bSBpbnN0YWxsIC15IGdjYyBtYWtlJyxcbiAgICAgICdjZCAvdG1wJyxcbiAgICAgICdjdXJsIC1PIGh0dHA6Ly9kb3dubG9hZC5yZWRpcy5pby9yZWxlYXNlcy9yZWRpcy03LjQuNi50YXIuZ3onLFxuICAgICAgJ3RhciB4emYgcmVkaXMtNy40LjYudGFyLmd6JyxcbiAgICAgICdjZCByZWRpcy03LjQuNicsXG4gICAgICAnbWFrZScsXG4gICAgICAnbWFrZSBpbnN0YWxsJyxcbiAgICAgIC8vIENvbmZpZ3VyZSBSZWRpcyBmb3Igb25saW5lIG1pZ3JhdGlvblxuICAgICAgJ21rZGlyIC1wIC9ldGMvcmVkaXMnLFxuICAgICAgJ2NhdCA+IC9ldGMvcmVkaXMvcmVkaXMuY29uZiA8PCBFT0YnLFxuICAgICAgJ2JpbmQgMC4wLjAuMCcsXG4gICAgICAncHJvdGVjdGVkLW1vZGUgbm8nLFxuICAgICAgJ3BvcnQgNjM3OScsXG4gICAgICAnZGFlbW9uaXplIHllcycsXG4gICAgICAncGlkZmlsZSAvdmFyL3J1bi9yZWRpc182Mzc5LnBpZCcsXG4gICAgICAnbG9nZmlsZSAvdmFyL2xvZy9yZWRpcy5sb2cnLFxuICAgICAgJ0VPRicsXG4gICAgICAnL3Vzci9sb2NhbC9iaW4vcmVkaXMtc2VydmVyIC9ldGMvcmVkaXMvcmVkaXMuY29uZicsXG4gICAgKTtcblxuICAgIC8vIEVDMiBJbnN0YW5jZSB3aXRoIFJlZGlzIDcuNC42XG4gICAgY29uc3QgcmVkaXNJbnN0YW5jZSA9IG5ldyBlYzIuSW5zdGFuY2UodGhpcywgJ1JlZGlzSW5zdGFuY2UnLCB7XG4gICAgICB2cGMsXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcbiAgICAgIGluc3RhbmNlVHlwZTogZWMyLkluc3RhbmNlVHlwZS5vZihlYzIuSW5zdGFuY2VDbGFzcy5UMywgZWMyLkluc3RhbmNlU2l6ZS5NRURJVU0pLFxuICAgICAgbWFjaGluZUltYWdlOiBlYzIuTWFjaGluZUltYWdlLmxhdGVzdEFtYXpvbkxpbnV4MjAyMygpLFxuICAgICAgc2VjdXJpdHlHcm91cDogcmVkaXNTZyxcbiAgICAgIHVzZXJEYXRhLFxuICAgIH0pO1xuXG4gICAgLy8gRWxhc3RpQ2FjaGUgU3VibmV0IEdyb3VwXG4gICAgY29uc3Qgc3VibmV0R3JvdXAgPSBuZXcgZWxhc3RpY2FjaGUuQ2ZuU3VibmV0R3JvdXAodGhpcywgJ1ZhbGtleVN1Ym5ldEdyb3VwJywge1xuICAgICAgZGVzY3JpcHRpb246ICdTdWJuZXQgZ3JvdXAgZm9yIEVsYXN0aUNhY2hlIFZhbGtleScsXG4gICAgICBzdWJuZXRJZHM6IHZwYy5wcml2YXRlU3VibmV0cy5tYXAoc3VibmV0ID0+IHN1Ym5ldC5zdWJuZXRJZCksXG4gICAgICBjYWNoZVN1Ym5ldEdyb3VwTmFtZTogJ3ZhbGtleS1taWdyYXRpb24tc3VibmV0LWdyb3VwJyxcbiAgICB9KTtcblxuICAgIC8vIEVsYXN0aUNhY2hlIGZvciBWYWxrZXkgKGNsdXN0ZXItbW9kZSBkaXNhYmxlZCwgTXVsdGktQVosIG5vIFRMUyBmb3Igb25saW5lIG1pZ3JhdGlvbilcbiAgICBjb25zdCB2YWxrZXlDbHVzdGVyID0gbmV3IGVsYXN0aWNhY2hlLkNmblJlcGxpY2F0aW9uR3JvdXAodGhpcywgJ1ZhbGtleUNsdXN0ZXInLCB7XG4gICAgICByZXBsaWNhdGlvbkdyb3VwRGVzY3JpcHRpb246ICdFbGFzdGlDYWNoZSBmb3IgVmFsa2V5IC0gTWlncmF0aW9uIFRhcmdldCcsXG4gICAgICBlbmdpbmU6ICd2YWxrZXknLFxuICAgICAgZW5naW5lVmVyc2lvbjogJzguMicsXG4gICAgICBjYWNoZU5vZGVUeXBlOiAnY2FjaGUudDMubWVkaXVtJyxcbiAgICAgIG51bUNhY2hlQ2x1c3RlcnM6IDIsIC8vIFByaW1hcnkgKyAxIFJlcGxpY2EgZm9yIE11bHRpLUFaXG4gICAgICBhdXRvbWF0aWNGYWlsb3ZlckVuYWJsZWQ6IHRydWUsXG4gICAgICBtdWx0aUF6RW5hYmxlZDogdHJ1ZSxcbiAgICAgIHRyYW5zaXRFbmNyeXB0aW9uRW5hYmxlZDogZmFsc2UsIC8vIFJlcXVpcmVkOiBtdXN0IGJlIGRpc2FibGVkIGZvciBvbmxpbmUgbWlncmF0aW9uXG4gICAgICBhdFJlc3RFbmNyeXB0aW9uRW5hYmxlZDogZmFsc2UsXG4gICAgICBjYWNoZVN1Ym5ldEdyb3VwTmFtZTogc3VibmV0R3JvdXAuY2FjaGVTdWJuZXRHcm91cE5hbWUsXG4gICAgICBzZWN1cml0eUdyb3VwSWRzOiBbdmFsa2V5U2cuc2VjdXJpdHlHcm91cElkXSxcbiAgICAgIHBvcnQ6IDYzNzksXG4gICAgfSk7XG4gICAgdmFsa2V5Q2x1c3Rlci5hZGREZXBlbmRlbmN5KHN1Ym5ldEdyb3VwKTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUmVkaXNJbnN0YW5jZUlkJywge1xuICAgICAgdmFsdWU6IHJlZGlzSW5zdGFuY2UuaW5zdGFuY2VJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRUMyIEluc3RhbmNlIElEIHJ1bm5pbmcgUmVkaXMgNy40LjYnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1JlZGlzUHJpdmF0ZUlwJywge1xuICAgICAgdmFsdWU6IHJlZGlzSW5zdGFuY2UuaW5zdGFuY2VQcml2YXRlSXAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1ByaXZhdGUgSVAgb2YgUmVkaXMgaW5zdGFuY2UgKHVzZSBmb3IgU3RhcnRNaWdyYXRpb24pJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWYWxrZXlQcmltYXJ5RW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogdmFsa2V5Q2x1c3Rlci5hdHRyUHJpbWFyeUVuZFBvaW50QWRkcmVzcyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRWxhc3RpQ2FjaGUgVmFsa2V5IFByaW1hcnkgRW5kcG9pbnQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ZhbGtleVJlcGxpY2F0aW9uR3JvdXBJZCcsIHtcbiAgICAgIHZhbHVlOiB2YWxrZXlDbHVzdGVyLnJlZixcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmVwbGljYXRpb24gR3JvdXAgSUQgKHVzZSBmb3IgU3RhcnRNaWdyYXRpb24pJyxcbiAgICB9KTtcbiAgfVxufVxuIl19