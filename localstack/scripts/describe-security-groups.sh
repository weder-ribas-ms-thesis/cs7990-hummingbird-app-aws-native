#!/bin/bash
set -eo pipefail

awslocal ec2 describe-security-groups --query 'SecurityGroups[].[GroupId,GroupName,Description]' --output table
