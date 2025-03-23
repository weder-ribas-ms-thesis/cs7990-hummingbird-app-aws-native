#!/bin/bash
set -eo pipefail

num_seconds=${1-600}

EPOCH=$(date -u +%s)
start=$(($EPOCH-600))
end=$(($EPOCH))

awslocal xray get-trace-summaries --start-time=$start --end-time=$end

TRACEIDS=$(awslocal xray get-trace-summaries --start-time=$start --end-time=$end --query 'TraceSummaries[*].Id' --output text)
awslocal xray batch-get-traces --trace-ids $TRACEIDS --query 'Traces[*]'
